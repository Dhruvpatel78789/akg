import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Booking } from "@/models/Booking";
import { BookingRequest } from "@/models/BookingRequest";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";
import { updateBookingStatuses } from "@/lib/booking-status-updater";
import { Notification } from "@/models/Notification";

export async function GET() {
  try {
    await connectDB();

    const admin = await requireAdmin("bookings", "advancedBookings", false);
    if (admin.error) return admin.error;

    // Automate future bookings -> active sessions -> completed history transitions
    await updateBookingStatuses();

    const now = new Date();

    const advancedBookings = await Booking.find({
      status: "BOOKED",
      startTime: { $gt: now },
      paymentStatus: "PAID",
      softDeleted: false,
    })
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .sort({ startTime: 1 })
      .lean();

    const ongoingSessions = await Booking.find({
      status: "STARTED",
      paymentStatus: "PAID",
      softDeleted: false,
    })
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .sort({ startTime: 1 })
      .lean();

    const bookingHistory = await Booking.find({
      status: { $in: ["COMPLETED", "CANCELLED"] },
      paymentStatus: "PAID",
      softDeleted: false,
    })
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .sort({ endTime: -1 })
      .limit(200)
      .lean();

    const pendingPayments = await Booking.find({
      paymentStatus: "PENDING",
      softDeleted: false,
    })
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .sort({ createdAt: -1 })
      .lean();

    const failedPayments = await Booking.find({
      paymentStatus: "FAILED",
      softDeleted: false,
    })
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .sort({ createdAt: -1 })
      .lean();

    const cancellationRequests = await BookingRequest.find({
      type: "CANCELLATION",
    })
      .populate("userId", "name phone email role")
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    const timeChangeRequests = await BookingRequest.find({
      type: "TIME_CHANGE",
    })
      .populate("userId", "name phone email role")
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      advancedBookings,
      ongoingSessions,
      bookingHistory,
      pendingPayments,
      failedPayments,
      cancellationRequests,
      timeChangeRequests,
    });
  } catch (err: any) {
    console.error("GET bookings error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await request.json();
    const { requestId, bookingId, action, status } = body; // status can be "APPROVED" or "REJECTED"

    // Handle Direct Admin Actions (Edit/Cancel)
    if (bookingId && action) {
      if (action === "UPDATE") {
        const { startTime, endTime, court } = body;
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          return NextResponse.json({ message: "Booking not found" }, { status: 404 });
        }

        if (startTime) booking.startTime = new Date(startTime);
        if (endTime) booking.endTime = new Date(endTime);
        if (court) booking.court = court;
        await booking.save();

        // Create notification for player
        await Notification.create({
          userId: booking.userId,
          title: "Booking Updated by Admin",
          message: `Your booking for ${booking.gameName} has been rescheduled to ${new Date(booking.startTime as any).toLocaleString("en-IN")} - ${new Date(booking.endTime as any).toLocaleTimeString("en-IN")}.`,
        });

        return NextResponse.json({ success: true, message: "Booking updated successfully" });
      }

      if (action === "CANCEL") {
        const { refundAmount } = body;
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          return NextResponse.json({ message: "Booking not found" }, { status: 404 });
        }

        booking.status = "CANCELLED";
        booking.refundAmount = Number(refundAmount || 0);
        
        const totalCost = booking.coinCost || booking.price || 0;
        if (booking.refundAmount > 0) {
          booking.paymentStatus = booking.refundAmount === totalCost ? "REFUNDED" : "PARTIALLY_REFUNDED";
        }

        await booking.save();

        // Log transaction record for refund if refundAmount > 0
        if (booking.refundAmount > 0) {
          if (booking.coinCost > 0) {
            // Refund coins
            const user = await User.findById(booking.userId);
            if (user) {
              user.coins = (user.coins || 0) + booking.refundAmount;
              await user.save();
            }
            await Transaction.create({
              userId: booking.userId,
              type: "REFUND",
              amount: 0,
              coins: booking.refundAmount,
              paymentMode: "coins",
              refundAmount: booking.refundAmount,
              referenceId: booking._id,
              note: `Refund of ${booking.refundAmount} coins for cancelled booking ${booking._id}`,
            });
          } else {
            // Refund cash or online
            await Transaction.create({
              userId: booking.userId,
              type: "REFUND",
              amount: booking.refundAmount,
              coins: 0,
              paymentMode: booking.paymentMode || "online",
              refundAmount: booking.refundAmount,
              referenceId: booking._id,
              note: `Refund of ₹${booking.refundAmount} for cancelled booking ${booking._id}`,
            });
          }
        }

        // Create notification for player
        await Notification.create({
          userId: booking.userId,
          title: "Booking Cancelled by Admin",
          message: `Your booking for ${booking.gameName} on ${new Date(booking.startTime as any).toLocaleDateString("en-IN")} has been cancelled. Refund: ${booking.coinCost > 0 ? `${booking.refundAmount} coins` : `₹${booking.refundAmount}`}.`,
        });

        return NextResponse.json({ success: true, message: "Booking cancelled successfully" });
      }
    }

    if (!requestId || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ message: "Invalid parameters" }, { status: 400 });
    }

    const bookingRequest = await BookingRequest.findById(requestId).populate("bookingId");
    if (!bookingRequest) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    if (bookingRequest.status !== "PENDING") {
      return NextResponse.json({ message: "Request has already been processed" }, { status: 400 });
    }

    bookingRequest.status = status;
    await bookingRequest.save();

    const booking = await Booking.findById(bookingRequest.bookingId);
    if (!booking) {
      return NextResponse.json({ message: "Associated booking not found" }, { status: 404 });
    }

    if (status === "APPROVED") {
      if (bookingRequest.type === "CANCELLATION") {
        booking.status = "CANCELLED";
        await booking.save();

        // Refund coins if booking used coins
        if (booking.coinCost > 0) {
          const user = await User.findById(booking.userId);
          if (user) {
            user.coins = (user.coins || 0) + booking.coinCost;
            await user.save();

            await Transaction.create({
              userId: user._id,
              type: "REFUND", // using correct REFUND type
              amount: 0,
              coins: booking.coinCost,
              paymentMode: "coins",
              referenceId: booking._id,
              note: `Refund for approved cancellation request of booking ${booking._id}`,
            });
          }
        }
      } else if (bookingRequest.type === "TIME_CHANGE") {
        if (bookingRequest.requestedStartTime && bookingRequest.requestedEndTime) {
          booking.startTime = bookingRequest.requestedStartTime;
          booking.endTime = bookingRequest.requestedEndTime;
          await booking.save();
        }
      }
    }

    return NextResponse.json({ success: true, message: `Request successfully ${status.toLowerCase()}` });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to process request" }, { status: 500 });
  }
}