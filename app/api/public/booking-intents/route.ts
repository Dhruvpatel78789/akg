import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
import { PaymentOrder } from "@/models/PaymentOrder";
import { BookingIntent } from "@/models/BookingIntent";
import { checkCourtAvailability } from "@/app/api/public/availability/check/route";
import { sendBookingPaymentLink } from "@/lib/whatsapp";
import mongoose from "mongoose";
import Razorpay from "razorpay";

const inputSchema = z.object({
  phone: z.string().min(10),
  customerName: z.string().optional(),
  gameId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  playersCount: z.number().int().min(1),
  source: z.enum(["WHATSAPP", "VOICE"]),
});

function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (addDays > 0) {
    date.setDate(date.getDate() + addDays);
  }
  return date;
}

function calculateBasePrice(rule: any, playersIncluded: number) {
  if (rule.mode === "PER_PLAYER") {
    return playersIncluded * rule.pricePerPlayer;
  }
  return rule.baseCourtPrice + playersIncluded * rule.pricePerPlayer;
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const parsed = inputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid input", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phone, customerName, gameId, date, startTime, playersCount, source } = parsed.data;

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ success: false, message: "Game not found" }, { status: 404 });
    }

    const duration = game.duration || 60;

    // Calculate End Time
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor(totalMinutes / 60) % 24;
    const em = totalMinutes % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    const crossMidnight = totalMinutes >= 1440;

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

    if (start.getTime() < Date.now() - 3 * 60 * 1000) {
      return NextResponse.json({ success: false, message: "Cannot book a slot in the past." }, { status: 400 });
    }

    // Pricing Rule Check
    const rule = await PricingRule.findOne({
      gameId: new mongoose.Types.ObjectId(gameId),
      active: true,
      minPlayers: { $lte: playersCount },
      maxPlayers: { $gte: playersCount },
      durationMinutes: duration,
    }).lean();

    if (!rule) {
      return NextResponse.json({
        success: false,
        message: `No pricing rule configured for ${playersCount} player(s) and ${duration} minutes.`,
      }, { status: 400 });
    }

    const price = calculateBasePrice(rule, playersCount);

    // Court Availability Check
    const avail = await checkCourtAvailability(gameId, start, end);
    if (!avail.available) {
      return NextResponse.json({ success: false, message: avail.reason || "Slot is not available" }, { status: 409 });
    }

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
          amount: Math.round(price * 100), // in paise
          currency: "INR",
          receipt: "receipt_intent_" + Date.now(),
        });
        orderId = response.id;
      } catch (err: any) {
        console.error("Razorpay order creation failed, falling back to mock: ", err);
        orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
      }
    }

    // Create PaymentOrder Record
    const paymentOrder = await PaymentOrder.create({
      purpose: "BOOKING_INTENT",
      amount: price,
      razorpayOrderId: orderId,
      status: "CREATED",
      metadata: {
        phone,
        gameName: game.name,
      },
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Expires in 15 minutes

    // Create BookingIntent Record
    const intent = await BookingIntent.create({
      phone,
      customerName,
      gameId: game._id,
      gameName: game.name,
      date,
      startTime,
      endTime,
      playersCount,
      price,
      source,
      status: "PENDING_PAYMENT",
      paymentOrderId: paymentOrder._id.toString(),
      razorpayOrderId: orderId,
      expiresAt,
      metadata: {
        court: avail.courtName,
      },
    });

    // Generate Checkout/Payment Link
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const checkoutLink = `${appBaseUrl}/payment/booking-intent/${intent._id}`;

    // Send WhatsApp payment link message
    await sendBookingPaymentLink(phone, {
      gameName: game.name,
      date,
      startTime,
      price,
      link: checkoutLink,
    });

    return NextResponse.json({
      success: true,
      message: "Payment link sent on WhatsApp",
      intentId: intent._id,
      paymentLink: checkoutLink,
    });
  } catch (error: any) {
    console.error("Booking Intent creation failed:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
