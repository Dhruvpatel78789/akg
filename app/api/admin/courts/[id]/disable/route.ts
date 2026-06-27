import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Booking } from "@/models/Booking";
import { Court } from "@/models/court";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const isDisabling = Boolean(body.disabled);
  const overrideMode = body.overrideMode; // "KEEP" or "OVERRIDE"

  const court = await Court.findById(id);
  if (!court) {
    return NextResponse.json({ message: "Court not found" }, { status: 404 });
  }

  // Detect affected bookings if disabling
  if (isDisabling) {
    const futureBookings = await Booking.find({
      court: court.name,
      gameId: court.gameId,
      startTime: { $gte: new Date() },
      status: { $in: ["BOOKED", "STARTED"] },
      softDeleted: false,
    });

    if (futureBookings.length > 0 && !overrideMode) {
      return NextResponse.json({
        hasBookings: true,
        bookingsCount: futureBookings.length,
        message: `Court ${court.name} has ${futureBookings.length} upcoming booking(s). Please choose how to proceed.`,
      });
    }

    if (futureBookings.length > 0 && overrideMode === "OVERRIDE") {
      // Mark all affected bookings as reschedule required
      await Booking.updateMany(
        {
          court: court.name,
          gameId: court.gameId,
          startTime: { $gte: new Date() },
          status: { $in: ["BOOKED", "STARTED"] },
          softDeleted: false,
        },
        { $set: { rescheduleRequired: true } }
      );
      
      // Send notifications to users (Mock trigger / notification implementation)
      const { Notification } = await import("@/models/Notification");
      for (const b of futureBookings) {
        const timeStr = b.startTime ? new Date(b.startTime as any).toLocaleString() : "";
        await Notification.create({
          userId: b.userId,
          title: "Reschedule Required",
          message: `Your booking for ${b.gameName} on court ${court.name} at ${timeStr} requires rescheduling because the court has been disabled.`,
          type: "ALERT",
          relatedEntityId: b._id,
          relatedEntityType: "Booking",
        }).catch(() => {});
      }
    }
  }

  court.disabled = isDisabling;
  court.active = !isDisabling;
  if (body.name) court.name = body.name;
  await court.save();

  return NextResponse.json({ message: "Court updated", court });
}