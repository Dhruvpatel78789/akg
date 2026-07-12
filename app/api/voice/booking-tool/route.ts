import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
import { PaymentOrder } from "@/models/PaymentOrder";
import { BookingIntent } from "@/models/BookingIntent";
import {
  checkCourtAvailability,
  getAlternativeSlots,
  calculateBasePrice,
  parseDateTime,
} from "@/lib/availability";
import { sendBookingPaymentLink } from "@/lib/whatsapp";
import mongoose from "mongoose";
import Razorpay from "razorpay";

function formatSuggestedSlots(slots: { date: string; startTime: string; endTime: string; }[]) {
  const formatted = slots.map(s => `${s.startTime} on ${s.date}`);
  if (formatted.length === 0) return "";
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} or ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, or ${formatted[formatted.length - 1]}`;
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { action, phone, gameId, gameName, date, startTime, playersCount } = body;

    if (!action) {
      return NextResponse.json({ success: false, message: "Missing action parameter" }, { status: 400 });
    }

    // Resolve Game
    let game: any = null;
    if (gameId && mongoose.Types.ObjectId.isValid(gameId)) {
      game = await Game.findById(gameId).lean();
    } else if (gameName) {
      game = await Game.findOne({ name: new RegExp(gameName, "i") }).lean();
    }

    if (!game) {
      // Fallback: get first active game if none matched
      game = await Game.findOne({ active: true }).lean();
      if (!game) {
        return NextResponse.json({ success: false, message: "No active games found in system" }, { status: 404 });
      }
    }

    if (game.fixedSlotBooking && startTime) {
      const { validateFixedSlot } = await import("@/lib/fixed-slots");
      if (!validateFixedSlot(startTime, game.duration)) {
        return NextResponse.json({
          success: false,
          message: "This game only allows fixed slot bookings. Please select a valid slot time."
        }, { status: 400 });
      }
    }

    const duration = game.duration || 60;
    const count = Number(playersCount || 1);

    // Calculate End Time
    const [sh, sm] = (startTime || "10:00").split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor(totalMinutes / 60) % 24;
    const em = totalMinutes % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    const crossMidnight = totalMinutes >= 1440;

    const start = parseDateTime(date || "2026-06-12", startTime || "10:00");
    const end = parseDateTime(date || "2026-06-12", endTime, crossMidnight ? 1 : 0);

    if (action === "check_availability") {
      // Find Pricing
      const rule = await PricingRule.findOne({
        gameId: game._id,
        active: true,
        minPlayers: { $lte: count },
        maxPlayers: { $gte: count },
        durationMinutes: duration,
      }).lean();

      if (!rule) {
        return NextResponse.json({
          available: false,
          message: `No pricing rule configured for ${count} players.`,
        });
      }

      const price = calculateBasePrice(rule, count);
      const avail = await checkCourtAvailability(game._id.toString(), start, end);

      if (!avail.available) {
        const suggestedSlots = await getAlternativeSlots(game._id.toString(), date || "2026-06-12", startTime || "10:00", duration, count);
        const listString = formatSuggestedSlots(suggestedSlots);
        const reason = listString 
          ? `The requested slot is unavailable. I can offer ${listString}. Which one would you prefer?`
          : (avail.reason || "All courts are fully booked or blocked for this slot");

        return NextResponse.json({
          available: false,
          reason,
          price,
          gameId: game._id.toString(),
          gameName: game.name,
          date: date || "2026-06-12",
          startTime: startTime || "10:00",
          endTime,
          suggestedSlots,
        });
      }

      return NextResponse.json({
        available: true,
        price,
        gameId: game._id.toString(),
        gameName: game.name,
        date: date || "2026-06-12",
        startTime: startTime || "10:00",
        endTime,
        suggestedSlots: [],
      });
    }

    if (action === "create_booking_intent") {
      if (!phone) {
        return NextResponse.json({ success: false, message: "Phone number is required to create intent" }, { status: 400 });
      }

      // Re-verify availability
      const avail = await checkCourtAvailability(game._id.toString(), start, end);
      if (!avail.available) {
        const suggestedSlots = await getAlternativeSlots(game._id.toString(), date || "2026-06-12", startTime || "10:00", duration, count);
        const listString = formatSuggestedSlots(suggestedSlots);
        const reason = listString 
          ? `The requested slot is unavailable. I can offer ${listString}. Which one would you prefer?`
          : (avail.reason || "Slot is not available");

        return NextResponse.json({
          success: false,
          available: false,
          reason,
          suggestedSlots,
        }, { status: 400 });
      }

      const rule = await PricingRule.findOne({
        gameId: game._id,
        active: true,
        minPlayers: { $lte: count },
        maxPlayers: { $gte: count },
        durationMinutes: duration,
      }).lean();

      if (!rule) {
        return NextResponse.json({ success: false, message: "No pricing rule configured" }, { status: 400 });
      }

      const price = calculateBasePrice(rule, count);

      // Create Razorpay Order
      const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockkeyid123";
      const keySecret = process.env.RAZORPAY_KEY_SECRET || "mocksecret123";
      let orderId = "";

      if (keyId.startsWith("rzp_test_mock")) {
        orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
      } else {
        try {
          const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
          });

          const response = await razorpay.orders.create({
            amount: Math.round(price * 100),
            currency: "INR",
            receipt: "receipt_voice_" + Date.now(),
          });
          orderId = response.id;
        } catch (err: any) {
          console.error("Razorpay order creation failed during voice request:", err);
          orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
        }
      }

      const paymentOrder = await PaymentOrder.create({
        purpose: "BOOKING_INTENT",
        amount: price,
        razorpayOrderId: orderId,
        status: "CREATED",
        metadata: {
          phone,
          gameName: game.name,
          source: "VOICE",
        },
      });

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const intent = await BookingIntent.create({
        phone,
        gameId: game._id,
        gameName: game.name,
        date: date || "2026-06-12",
        startTime: startTime || "10:00",
        endTime,
        playersCount: count,
        price,
        source: "VOICE",
        status: "PENDING_PAYMENT",
        paymentOrderId: paymentOrder._id.toString(),
        razorpayOrderId: orderId,
        expiresAt,
        metadata: {
          court: avail.courtName,
        },
      });

      const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      const checkoutLink = `${appBaseUrl}/payment/booking-intent/${intent._id}`;

      await sendBookingPaymentLink(phone, {
        gameName: game.name,
        date: date || "2026-06-12",
        startTime: startTime || "10:00",
        price,
        link: checkoutLink,
      });

      return NextResponse.json({
        success: true,
        message: "Payment link sent on WhatsApp. Please ask the customer to complete payment there.",
        intentId: intent._id,
        paymentLink: checkoutLink,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Voice booking tool API failed:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
