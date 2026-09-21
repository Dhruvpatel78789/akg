import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BookingIntent } from "@/models/BookingIntent";
import { Booking } from "@/models/Booking";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    await connectDB();
    const { id } = await params;

    let intent: any = await BookingIntent.findById(id).lean();

    if (!intent) {
      // Fallback: Check if id corresponds to a Booking with PENDING payment
      const booking = await Booking.findById(id).lean();
      if (booking) {
        intent = {
          _id: booking._id,
          phone: "",
          customerName: booking.gameName || "Game Booking",
          gameId: booking.gameId,
          gameName: booking.gameName || "Game",
          date: booking.startTime ? new Date(booking.startTime).toISOString().split("T")[0] : "",
          startTime: booking.startTime ? new Date(booking.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
          endTime: booking.endTime ? new Date(booking.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
          playersCount: booking.playersCount || 1,
          price: booking.price || booking.subtotal || 0,
          source: "WEBSITE",
          status: booking.paymentStatus === "PAID" ? "PAID" : "PENDING_PAYMENT",
          razorpayOrderId: booking.razorpayOrderId,
          bookingId: booking._id,
          expiresAt: booking.intentExpiresAt || new Date(Date.now() + 15 * 60 * 1000),
        };
      }
    }

    if (!intent) {
      return NextResponse.json({ success: false, message: "Booking intent not found" }, { status: 404 });
    }

    const now = new Date();
    const isExpired = intent.expiresAt && new Date(intent.expiresAt) < now;

    return NextResponse.json({
      success: true,
      intent,
      isExpired,
    });
  } catch (error: any) {
    console.error("Failed to fetch booking intent:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
