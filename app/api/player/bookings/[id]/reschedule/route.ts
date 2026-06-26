import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Booking } from "@/models/Booking";
import { BookingRequest } from "@/models/BookingRequest";
import { Settings } from "@/models/Settings";
import { User } from "@/models/User";
import { Court } from "@/models/court";
import { CourtBlock } from "@/models/CourtBlock";
import mongoose from "mongoose";

import { parseIST } from "@/lib/time";

function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  return parseIST(dateStr, timeStr, addDays);
}

async function checkAvailability(gameId: string, bookingStart: Date, bookingEnd: Date, excludeBookingId?: string) {
  const courts = await Court.find({ gameId, active: true, disabled: false }).lean();
  if (courts.length === 0) {
    return { available: false, reason: "No courts configured for this game" };
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const query: any = {
    gameId,
    status: { $in: ["BOOKED", "STARTED"] },
    softDeleted: false,
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart },
    $or: [
      { paymentStatus: "PAID" },
      { paymentMethod: "PAY_AT_COUNTER" },
      { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  const overlappingBookings = await Booking.find(query).lean();

  const overlappingBlocks = await CourtBlock.find({
    gameId,
    status: { $in: ["ACTIVE", "SCHEDULED"] },
    $or: [
      { blockedFrom: { $lt: bookingEnd }, blockedTo: { $gt: bookingStart } }
    ]
  }).lean();

  for (const court of courts) {
    const isBooked = overlappingBookings.some((b) => b.court === court.name);
    const isBlocked = overlappingBlocks.some((bl) => bl.courtId.toString() === court._id.toString());

    if (!isBooked && !isBlocked) {
      return { available: true, courtName: court.name };
    }
  }

  return { available: false, reason: "All courts are fully booked or blocked for the selected slot" };
}

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
      return NextResponse.json({ message: "Only upcoming bookings can be rescheduled" }, { status: 400 });
    }

    const body = await request.json();
    const { date, startTime, endTime } = body;

    if (!date || !startTime || !endTime) {
      return NextResponse.json({ message: "Missing new reschedule date or times" }, { status: 400 });
    }

    const { Game } = await import("@/models/Game");
    const game = await Game.findById(booking.gameId).lean();
    if (game && game.fixedSlotBooking) {
      const { validateFixedSlot } = await import("@/lib/fixed-slots");
      if (!validateFixedSlot(startTime, game.duration)) {
        return NextResponse.json({
          message: "This game only allows fixed slot bookings. Please select a valid slot time."
        }, { status: 400 });
      }
    }

    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

    const settings = await Settings.findOne() || {
      visitorRescheduleHours: 24,
      memberRescheduleHours: 24,
    };

    const rescheduleWindow = user.role === "VISITOR"
      ? (settings.visitorRescheduleHours ?? 24)
      : (settings.memberRescheduleHours ?? 24);

    const bookingStart = new Date(booking.startTime as any);
    const now = new Date();
    const diffHours = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours >= rescheduleWindow) {
      // Auto reschedule (outside restriction window)
      // Check slot availability
      const avail = await checkAvailability(booking.gameId!.toString(), start, end, booking._id.toString());
      if (!avail.available) {
        return NextResponse.json({ message: avail.reason || "The requested slot is fully booked." }, { status: 409 });
      }

      booking.startTime = start;
      booking.endTime = end;
      booking.court = avail.courtName;
      booking.crossMidnight = crossMidnight;
      await booking.save();

      return NextResponse.json({ success: true, autoRescheduled: true, message: "Booking rescheduled instantly." });
    } else {
      // Create reschedule request
      const existingRequest = await BookingRequest.findOne({
        bookingId: booking._id,
        type: "TIME_CHANGE",
        status: "PENDING",
      });

      if (existingRequest) {
        return NextResponse.json({ message: "A reschedule request is already pending for this booking." }, { status: 400 });
      }

      const bookingRequest = await BookingRequest.create({
        userId: user._id,
        bookingId: booking._id,
        type: "TIME_CHANGE",
        status: "PENDING",
        requestedStartTime: start,
        requestedEndTime: end,
        reason: "Requested reschedule inside restriction window",
      });

      return NextResponse.json({ success: true, autoRescheduled: false, bookingRequest, message: "Reschedule request submitted for admin approval." });
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to reschedule booking" }, { status: 500 });
  }
}
