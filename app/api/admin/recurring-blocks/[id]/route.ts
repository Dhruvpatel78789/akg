import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { RecurringCourtBlock } from "@/models/RecurringCourtBlock";
import { Court } from "@/models/court";
import { Booking } from "@/models/Booking";
import { Notification } from "@/models/Notification";

const updateSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  daysOfWeek: z.array(z.string()).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  active: z.boolean().optional(),
  resolutionType: z.enum(["KEEP", "RESCHEDULE"]).optional().nullable(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Invalid parameters", errors: parsed.error.format() }, { status: 400 });
    }

    const block = await RecurringCourtBlock.findById(id);
    if (!block || block.softDeleted) {
      return NextResponse.json({ success: false, message: "Recurring block not found" }, { status: 404 });
    }

    const data = parsed.data;

    // Check for conflicts if any scheduling parameters are modified
    const isSchedulingModified =
      data.startTime !== undefined ||
      data.endTime !== undefined ||
      data.daysOfWeek !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined;

    if (isSchedulingModified && data.active !== false) {
      const court = await Court.findById(block.courtId);
      if (court) {
        const finalStartTime = data.startTime ?? block.startTime;
        const finalEndTime = data.endTime ?? block.endTime;
        const finalDaysOfWeek = data.daysOfWeek ?? block.daysOfWeek;
        const finalStartDate = data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : block.startDate;
        const finalEndDate = data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : block.endDate;

        // Detect conflicts with future bookings
        const bookingsQuery: any = {
          gameId: block.gameId,
          court: court.name,
          startTime: { $gte: new Date() },
          softDeleted: false,
          status: { $in: ["BOOKED", "STARTED"] }
        };

        const futureBookings = await Booking.find(bookingsQuery).lean();
        const conflicts = futureBookings.filter((b) => {
          if (!b.startTime || !b.endTime) return false;
          if (finalStartDate && b.startTime < finalStartDate) return false;
          if (finalEndDate && b.endTime > finalEndDate) return false;

          const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

          const checkOverlapForAnchorDate = (anchorDate: Date) => {
            const dayName = DAYS_OF_WEEK[anchorDate.getDay()];
            if (!finalDaysOfWeek.includes(dayName)) return false;

            const [sh, sm] = finalStartTime.split(":").map(Number);
            const [eh, em] = finalEndTime.split(":").map(Number);

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

        // Apply resolution
        if (conflicts.length > 0 && data.resolutionType === "RESCHEDULE") {
          const conflictIds = conflicts.map(c => c._id);
          await Booking.updateMany(
            { _id: { $in: conflictIds } },
            { $set: { rescheduleRequired: true } }
          );

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
      }
    }

    // Update block fields
    if (data.startTime !== undefined) block.startTime = data.startTime;
    if (data.endTime !== undefined) block.endTime = data.endTime;
    if (data.daysOfWeek !== undefined) block.daysOfWeek = data.daysOfWeek as any;
    if (data.startDate !== undefined) block.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) block.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.reason !== undefined) block.reason = data.reason || "";
    if (data.active !== undefined) block.active = data.active;

    await block.save();

    return NextResponse.json({ success: true, block });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = await params;
    const block = await RecurringCourtBlock.findById(id);
    if (!block || block.softDeleted) {
      return NextResponse.json({ success: false, message: "Recurring block not found" }, { status: 404 });
    }

    block.softDeleted = true;
    await block.save();

    return NextResponse.json({ success: true, message: "Recurring block soft-deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
