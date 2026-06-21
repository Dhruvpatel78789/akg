import { Booking } from "@/models/Booking";
import { BookingIntent } from "@/models/BookingIntent";
import { User } from "@/models/User";
import { Game } from "@/models/Game";
import { checkCourtAvailability } from "@/app/api/public/availability/check/route";
import { sendBookingConfirmation, sendBookingFailed } from "@/lib/whatsapp";
import mongoose from "mongoose";

export async function resolveBookingIntent(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  paymentStatus: "PAID" | "FAILED"
) {
  // Find intent by razorpayOrderId
  const intent = await BookingIntent.findOne({ razorpayOrderId });
  if (!intent) {
    return { success: false, message: "Intent not found" };
  }

  // Idempotency: If already confirmed or paid, skip
  if (intent.status === "CONFIRMED" || intent.status === "PAID") {
    return { success: true, message: "Intent already processed as PAID/CONFIRMED", bookingId: intent.bookingId };
  }
  if (intent.status === "FAILED") {
    return { success: true, message: "Intent already processed as FAILED" };
  }

  if (paymentStatus === "FAILED") {
    intent.status = "FAILED";
    intent.razorpayPaymentId = razorpayPaymentId;
    await intent.save();

    await sendBookingFailed(intent.phone, "Payment transaction failed.");
    return { success: true, message: "Intent updated to FAILED" };
  }

  // Find Game details
  const game = await Game.findById(intent.gameId).lean();
  if (!game) {
    intent.status = "ADMIN_REVIEW";
    await intent.save();
    return { success: false, message: "Game not found during resolution" };
  }

  const [sh, sm] = intent.startTime.split(":").map(Number);
  const [eh, em] = intent.endTime.split(":").map(Number);
  const start = parseDateTime(intent.date, intent.startTime);
  const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);
  const end = parseDateTime(intent.date, intent.endTime, crossMidnight ? 1 : 0);

  // Re-check slot availability
  const avail = await checkCourtAvailability(intent.gameId.toString(), start, end);

  if (!avail.available) {
    intent.status = "ADMIN_REVIEW";
    intent.razorpayPaymentId = razorpayPaymentId;
    await intent.save();

    await sendBookingFailed(
      intent.phone,
      "the selected slot is no longer available. Our customer service team will contact you shortly to reschedule or issue a refund"
    );
    return { success: true, message: "Slot unavailable, marked intent as ADMIN_REVIEW" };
  }

  // Find or create Visitor User
  let user = await User.findOne({ phone: intent.phone });
  if (!user) {
    const finalEmail = `${intent.phone}_${Date.now()}@visitor.akshargamezone.com`;
    user = await User.create({
      name: intent.customerName || "Voice/WA Visitor",
      phone: intent.phone,
      email: finalEmail,
      role: "VISITOR",
      passwordHash: "visitor_dummy_password_hash",
    });
  }

  // Create actual Booking
  const booking = await Booking.create({
    userId: user._id,
    gameId: intent.gameId,
    gameName: intent.gameName,
    court: avail.courtName,
    startTime: start,
    endTime: end,
    price: intent.price,
    coinCost: 0,
    playersCount: intent.playersCount,
    crossMidnight,
    playerType: "VISITOR",
    paymentMode: "online",
    paymentStatus: "PAID",
    gatewayPaymentStatus: "PAID",
    effectivePaymentStatus: "PAID",
    razorpayOrderId,
    razorpayPaymentId,
    transactionId: razorpayPaymentId,
    paidAt: new Date(),
  });

  // Mark BookingIntent as CONFIRMED
  intent.status = "CONFIRMED";
  intent.bookingId = booking._id;
  intent.razorpayPaymentId = razorpayPaymentId;
  await intent.save();

  // Send WhatsApp confirmation
  await sendBookingConfirmation(intent.phone, {
    gameName: intent.gameName,
    court: avail.courtName,
    date: intent.date,
    startTime: intent.startTime,
    endTime: intent.endTime,
    playersCount: intent.playersCount,
  });

  return { success: true, message: "Booking created and intent confirmed", bookingId: booking._id };
}

import { parseIST } from "@/lib/time";

function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  return parseIST(dateStr, timeStr, addDays);
}
