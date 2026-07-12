import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { RecurringCourtBlock } from "@/models/RecurringCourtBlock";
import { Court } from "@/models/court";
import { Booking } from "@/models/Booking";
import { Notification } from "@/models/Notification";

const createSchema = z.object({
  gameId: z.string(),
  courtId: z.string(),
  startTime: z.string(), // "HH:mm"
  endTime: z.string(), // "HH:mm"
  daysOfWeek: z.array(z.string()), // ["MONDAY", "WEDNESDAY"]
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  active: z.boolean().default(true),
  resolutionType: z.enum(["KEEP", "RESCHEDULE"]).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    const query: any = { softDeleted: { $ne: true } };
    if (gameId) query.gameId = gameId;

    const blocks = await RecurringCourtBlock.find(query)
      .populate("courtId", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, blocks });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error || !admin.user) return admin.error || NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Invalid parameters", errors: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    const court = await Court.findById(data.courtId);
    if (!court) {
      return NextResponse.json({ success: false, message: "Court not found" }, { status: 404 });
    }

    // 1. Detect conflicts with future bookings
    const bookingsQuery: any = {
      gameId: data.gameId,
      court: court.name,
      startTime: { $gte: new Date() },
      softDeleted: false,
      status: { $in: ["BOOKED", "STARTED"] }
    };

    const futureBookings = await Booking.find(bookingsQuery).lean();
    const conflicts = futureBookings.filter((b) => {
      if (!b.startTime || !b.endTime) return false;
      // Date boundary check
      if (data.startDate && b.startTime < new Date(data.startDate)) return false;
      if (data.endDate && b.endTime > new Date(data.endDate)) return false;

      const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

      const checkOverlapForAnchorDate = (anchorDate: Date) => {
        const dayName = DAYS_OF_WEEK[anchorDate.getDay()];
        if (!data.daysOfWeek.includes(dayName)) return false;

        const [sh, sm] = data.startTime.split(":").map(Number);
        const [eh, em] = data.endTime.split(":").map(Number);

        const blockStart = new Date(anchorDate);
        blockStart.setHours(sh, sm, 0, 0);

        const blockEnd = new Date(anchorDate);
        blockEnd.setHours(eh, em, 0, 0);

        if (eh < sh || (eh === sh && em < sm)) {
          blockEnd.setDate(blockEnd.getDate() + 1);
        }

        if (!b.startTime || !b.endTime) return false;
        return b.startTime < blockEnd && b.endTime > blockStart;
      };

      const today = new Date(b.startTime);
      const yesterday = new Date(b.startTime);
      yesterday.setDate(yesterday.getDate() - 1);

      return checkOverlapForAnchorDate(today) || checkOverlapForAnchorDate(yesterday);
    });

    // If conflicts exist and no resolutionType has been chosen, block creation and return conflict info
    if (conflicts.length > 0 && !data.resolutionType) {
      return NextResponse.json({
        success: false,
        hasConflicts: true,
        conflictsCount: conflicts.length,
        conflicts: conflicts.map(c => ({
          _id: c._id,
          startTime: c.startTime,
          endTime: c.endTime,
          playersCount: c.playersCount
        })),
        message: `This recurring block conflicts with ${conflicts.length} future bookings.`
      });
    }

    // 2. Create the recurring block
    const block = await RecurringCourtBlock.create({
      gameId: data.gameId,
      courtId: data.courtId,
      startTime: data.startTime,
      endTime: data.endTime,
      daysOfWeek: data.daysOfWeek as any,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      reason: data.reason || "",
      active: data.active,
      createdBy: admin.user._id,
      softDeleted: false
    });

    // 3. Resolve conflicts if resolutionType is RESCHEDULE
    if (conflicts.length > 0 && data.resolutionType === "RESCHEDULE") {
      const conflictIds = conflicts.map(c => c._id);
      await Booking.updateMany(
        { _id: { $in: conflictIds } },
        { $set: { rescheduleRequired: true } }
      );

      // Notify users
      for (const b of conflicts) {
        const timeStr = b.startTime ? new Date(b.startTime as any).toLocaleString("en-IN") : "";
        await Notification.create({
          userId: b.userId,
          title: "Reschedule Required",
          message: `Your booking for ${b.gameName} on court ${court.name} at ${timeStr} requires rescheduling due to a recurring court block schedule.`,
          type: "ALERT",
          relatedEntityId: b._id,
          relatedEntityType: "Booking"
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, block });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
