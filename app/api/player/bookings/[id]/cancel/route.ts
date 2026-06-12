import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Booking } from "@/models/Booking";
import { BookingRequest } from "@/models/BookingRequest";
import { Settings } from "@/models/Settings";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await Booking.findOne({ _id: id, userId: authUser.userId });
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "BOOKED") {
      return NextResponse.json({ message: "Only upcoming bookings can be cancelled" }, { status: 400 });
    }

    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const settings = await Settings.findOne() || {
      visitorCancellationHours: 24,
      memberCancellationHours: 24,
    };

    const cancelWindow = user.role === "VISITOR"
      ? (settings.visitorCancellationHours ?? 24)
      : (settings.memberCancellationHours ?? 24);

    const bookingStart = new Date(booking.startTime as any);
    const now = new Date();
    const diffHours = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours >= cancelWindow) {
      // Auto cancel and full refund
      booking.status = "CANCELLED";
      const totalCost = booking.coinCost || booking.price || 0;
      booking.refundAmount = totalCost;
      booking.paymentStatus = "REFUNDED";
      await booking.save();

      if (booking.coinCost > 0) {
        user.coins = (user.coins || 0) + booking.coinCost;
        await user.save();

        await Transaction.create({
          userId: user._id,
          type: "REFUND",
          amount: 0,
          coins: booking.coinCost,
          paymentMode: "coins",
          referenceId: booking._id,
          note: `Auto-refund for booking cancellation outside window`,
        });
      } else if (booking.price > 0) {
        await Transaction.create({
          userId: user._id,
          type: "REFUND",
          amount: booking.price,
          coins: 0,
          paymentMode: booking.paymentMode || "online",
          referenceId: booking._id,
          note: `Auto-refund for booking cancellation outside window`,
        });
      }

      return NextResponse.json({ success: true, autoCancelled: true, message: "Booking cancelled and refunded successfully." });
    } else {
      // Create cancellation request
      const existingRequest = await BookingRequest.findOne({
        bookingId: booking._id,
        type: "CANCELLATION",
        status: "PENDING",
      });

      if (existingRequest) {
        return NextResponse.json({ message: "A cancellation request is already pending for this booking." }, { status: 400 });
      }

      const bookingRequest = await BookingRequest.create({
        userId: user._id,
        bookingId: booking._id,
        type: "CANCELLATION",
        status: "PENDING",
        reason: "Request cancellation inside restriction window",
      });

      return NextResponse.json({ success: true, autoCancelled: false, bookingRequest, message: "Cancellation request submitted for admin approval." });
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to cancel booking" }, { status: 500 });
  }
}
