import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Court } from "@/models/court";
import { CourtBlock } from "@/models/CourtBlock";
import { Booking } from "@/models/Booking";

const schema = z.object({
  blockedFrom: z.string(),
  blockedTo: z.string(),
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;
  const body = await request.json();

  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid block details", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const court = await Court.findById(id);

  if (!court) {
    return NextResponse.json({ message: "Court not found" }, { status: 404 });
  }

  const blockedFrom = new Date(result.data.blockedFrom);
  const blockedTo = new Date(result.data.blockedTo);

  if (blockedTo <= blockedFrom) {
    return NextResponse.json(
      { message: "End date/time must be after start date/time" },
      { status: 400 }
    );
  }

  const overrideMode = body.overrideMode; // "KEEP" or "OVERRIDE"

  // Check for future overlapping bookings
  const overlappingBookings = await Booking.find({
    court: court.name,
    gameId: court.gameId,
    status: { $in: ["BOOKED", "STARTED"] },
    softDeleted: false,
    startTime: { $lt: blockedTo },
    endTime: { $gt: blockedFrom },
  });

  if (overlappingBookings.length > 0 && !overrideMode) {
    return NextResponse.json({
      hasBookings: true,
      bookingsCount: overlappingBookings.length,
      message: `Court ${court.name} has ${overlappingBookings.length} booking(s) during the selected period. Please choose how to proceed.`,
    });
  }

  if (overlappingBookings.length > 0 && overrideMode === "OVERRIDE") {
    // Mark overlapping bookings as reschedule required
    await Booking.updateMany(
      {
        court: court.name,
        gameId: court.gameId,
        status: { $in: ["BOOKED", "STARTED"] },
        softDeleted: false,
        startTime: { $lt: blockedTo },
        endTime: { $gt: blockedFrom },
      },
      { $set: { rescheduleRequired: true } }
    );

    // Send notifications to users
    const { Notification } = await import("@/models/Notification");
    for (const b of overlappingBookings) {
      const timeStr = b.startTime ? new Date(b.startTime as any).toLocaleString() : "";
      await Notification.create({
        userId: b.userId,
        title: "Reschedule Required",
        message: `Your booking for ${b.gameName} on court ${court.name} at ${timeStr} requires rescheduling due to a court maintenance block.`,
        type: "ALERT",
        relatedEntityId: b._id,
        relatedEntityType: "Booking",
      }).catch(() => {});
    }
  }

  const activeSession = await Booking.findOne({
    court: court.name,
    gameId: court.gameId,
    status: "STARTED",
    softDeleted: false,
  });

  const block = await CourtBlock.create({
    courtId: court._id,
    gameId: court.gameId,
    blockedFrom,
    blockedTo,
    reason: result.data.reason || "",
    status: activeSession ? "PENDING_AFTER_SESSION" : "ACTIVE",
    applyAfterCurrentSession: Boolean(activeSession),
    keepExistingBookings: overrideMode !== "OVERRIDE", // Defaults to true/Option A (KEEP)
  });

  return NextResponse.json(
    {
      message: activeSession
        ? "Court will be blocked after current session ends"
        : "Court block scheduled successfully",
      block,
    },
    { status: 201 }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;

  // Find all blocks for this court (including past, pending, etc.)
  const blocks = await CourtBlock.find({ courtId: id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ blocks });
}