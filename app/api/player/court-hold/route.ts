import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Court } from "@/models/court";
import { Booking } from "@/models/Booking";
import { CourtBlock } from "@/models/CourtBlock";
import { RecurringCourtBlock } from "@/models/RecurringCourtBlock";
import { CourtHold } from "@/models/CourtHold";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    await connectDB();

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { courtId, startTime, endTime, paymentOrderId } = await request.json();

    if (!courtId || !startTime || !endTime) {
      return NextResponse.json({ success: false, message: "Missing required hold parameters" }, { status: 400 });
    }

    const bookingStart = new Date(startTime);
    const bookingEnd = new Date(endTime);

    // Validate court existence and status
    const court = await Court.findById(courtId);
    if (!court || !court.active || court.disabled) {
      return NextResponse.json({
        available: false,
        message: "This court is disabled or unavailable. Please select another court."
      }, { status: 409 });
    }

    // Server-side check: revalidate overlapping bookings
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const overlappingBooking = await Booking.findOne({
      court: court.name,
      status: { $in: ["BOOKED", "STARTED"] },
      softDeleted: false,
      startTime: { $lt: bookingEnd },
      endTime: { $gt: bookingStart },
      $or: [
        { paymentStatus: "PAID" },
        { paymentMethod: "PAY_AT_COUNTER" },
        { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } },
        { paymentStatus: "PENDING", intentExpiresAt: { $gt: new Date() } }
      ]
    }).lean();

    if (overlappingBooking) {
      return NextResponse.json({
        available: false,
        message: "This court was just booked by another player. Please select another court or time."
      }, { status: 409 });
    }

    // Revalidate court blocks
    const overlappingBlock = await CourtBlock.findOne({
      courtId: court._id,
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      blockedFrom: { $lt: bookingEnd },
      blockedTo: { $gt: bookingStart }
    }).lean();

    if (overlappingBlock) {
      return NextResponse.json({
        available: false,
        message: "This court is blocked during the selected slot. Please select another court."
      }, { status: 409 });
    }

    // Revalidate recurring blocks
    const recurringBlocks = await RecurringCourtBlock.find({
      courtId: court._id,
      active: true,
      softDeleted: { $ne: true }
    }).lean();

    const hasRecurringOverlap = recurringBlocks.some((rb: any) => {
      if (rb.startDate && bookingStart < new Date(rb.startDate)) return false;
      if (rb.endDate && bookingEnd > new Date(rb.endDate)) return false;

      const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const checkOverlapForAnchorDate = (anchorDate: Date) => {
        const dayName = DAYS_OF_WEEK[anchorDate.getDay()];
        if (!rb.daysOfWeek.includes(dayName)) return false;

        const [sh, sm] = rb.startTime.split(":").map(Number);
        const [eh, em] = rb.endTime.split(":").map(Number);

        const blockStart = new Date(anchorDate);
        blockStart.setHours(sh, sm, 0, 0);

        const blockEnd = new Date(anchorDate);
        blockEnd.setHours(eh, em, 0, 0);

        if (eh < sh || (eh === sh && em < sm)) {
          blockEnd.setDate(blockEnd.getDate() + 1);
        }
        return bookingStart < blockEnd && bookingEnd > blockStart;
      };

      const today = new Date(bookingStart);
      const yesterday = new Date(bookingStart);
      yesterday.setDate(yesterday.getDate() - 1);
      return checkOverlapForAnchorDate(today) || checkOverlapForAnchorDate(yesterday);
    });

    if (hasRecurringOverlap) {
      return NextResponse.json({
        available: false,
        message: "This court is blocked during the selected slot. Please select another court."
      }, { status: 409 });
    }

    // Revalidate overlapping holds (excluding holds from the same user or payment session if applicable)
    const overlappingHold = await CourtHold.findOne({
      courtId: court._id,
      startTime: { $lt: bookingEnd },
      endTime: { $gt: bookingStart },
      holdExpiresAt: { $gt: new Date() },
      status: "HELD",
      paymentOrderId: { $ne: paymentOrderId }
    }).lean();

    if (overlappingHold) {
      return NextResponse.json({
        available: false,
        message: "This court is temporarily held by another player. Please select another court or time."
      }, { status: 409 });
    }

    // Safe to create hold
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes grace period
    const hold = await CourtHold.create({
      courtId: court._id,
      startTime: bookingStart,
      endTime: bookingEnd,
      holdExpiresAt,
      status: "HELD",
      userId: authUser.userId,
      paymentOrderId
    });

    return NextResponse.json({
      success: true,
      holdId: hold._id.toString(),
      message: "Court hold registered successfully."
    });
  } catch (error: any) {
    console.error("Court hold creation error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
