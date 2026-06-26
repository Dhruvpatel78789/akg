import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BookingIntent } from "@/models/BookingIntent";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { Settings } from "@/models/Settings";
import { parseIST } from "@/lib/time";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;

    const intent = await BookingIntent.findById(id);
    if (!intent) {
      return NextResponse.json({ success: false, message: "Booking intent not found" }, { status: 404 });
    }

    if (intent.status === "CONFIRMED" || intent.status === "PAID") {
      return NextResponse.json({ success: false, message: "Booking is already paid/confirmed" }, { status: 400 });
    }

    const now = new Date();
    if (intent.expiresAt && new Date(intent.expiresAt) < now) {
      return NextResponse.json({ success: false, message: "Booking session has expired" }, { status: 400 });
    }

    // Validate Pay at Counter Allowed Window
    const settings = await Settings.findOne() || { payAtCounterWindowMinutes: 30 };
    const limitMins = settings.payAtCounterWindowMinutes ?? 30;

    const [sh, sm] = intent.startTime.split(":").map(Number);
    const start = parseIST(intent.date, intent.startTime);
    const minutesUntilBooking = (start.getTime() - Date.now()) / (60 * 1000);

    if (minutesUntilBooking > limitMins || minutesUntilBooking < -15) {
      return NextResponse.json({
        success: false,
        message: `Pay at Counter is available only for bookings within ${limitMins} minutes.`
      }, { status: 400 });
    }

    const [eh, em] = intent.endTime.split(":").map(Number);
    const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);
    const end = parseIST(intent.date, intent.endTime, crossMidnight ? 1 : 0);

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

    const courtName = intent.metadata?.get("court") || (intent.metadata as any)?.court;

    // Create Pay at Counter Booking
    const booking = await Booking.create({
      userId: user._id,
      gameId: intent.gameId,
      gameName: intent.gameName,
      court: courtName,
      startTime: start,
      endTime: end,
      price: intent.price,
      coinCost: 0,
      playersCount: intent.playersCount,
      crossMidnight,
      playerType: "VISITOR",
      paymentMethod: "PAY_AT_COUNTER",
      paymentMode: "cash",
      paymentStatus: "PENDING",
      gatewayPaymentStatus: "PENDING",
      adminPaymentStatus: "PENDING",
      effectivePaymentStatus: "PENDING",
      status: "BOOKED",
    });

    // Mark BookingIntent as CONFIRMED
    intent.status = "CONFIRMED";
    intent.bookingId = booking._id;
    await intent.save();

    // Check if coupon is applied to create CouponUsage
    const couponId = intent.metadata?.get?.("couponId") || (intent.metadata as any)?.couponId;
    if (couponId) {
      const { Coupon } = await import("@/models/Coupon");
      const { CouponUsage } = await import("@/models/CouponUsage");
      const coupon = await Coupon.findById(couponId);
      if (coupon) {
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save();

        const discountAmt = Number(intent.metadata?.get?.("discount") || (intent.metadata as any)?.discount || 0);
        await CouponUsage.create({
          couponId: coupon._id,
          userId: user._id,
          bookingId: booking._id,
          discountAmount: discountAmt,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Booking confirmed with Pay at Counter option",
      bookingId: booking._id,
    });
  } catch (error: any) {
    console.error("Pay at Counter booking intent failed:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
