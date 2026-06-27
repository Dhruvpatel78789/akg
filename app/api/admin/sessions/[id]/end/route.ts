import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Booking } from "@/models/Booking";
import { Notification } from "@/models/Notification";
import { SessionAuditLog } from "@/models/SessionAuditLog";
import { processOvertimeAndExit } from "@/lib/overtime-calculator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const admin = await requireAdmin("bookings", "ongoingSessions", true);
    if (admin.error) return admin.error;

    const { id } = await params;

    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json({ message: "Session booking not found" }, { status: 404 });
    }

    if (booking.status !== "STARTED") {
      return NextResponse.json({ message: "Session is not currently active" }, { status: 400 });
    }

    let forceEnd = false;
    let reason = "";
    let applyCharges = true;
    let notifyUser = true;

    try {
      const body = await request.json();
      forceEnd = !!body.forceEnd;
      reason = body.reason || "";
      if (body.applyCharges !== undefined) applyCharges = !!body.applyCharges;
      if (body.notifyUser !== undefined) notifyUser = !!body.notifyUser;
    } catch {}

    const now = new Date();

    if (!forceEnd) {
      // 1. Normal End Session
      await processOvertimeAndExit(booking._id.toString(), now, false);

      // Notify player
      await Notification.create({
        userId: booking.userId,
        title: "Session Ended by Admin",
        message: `Your session for ${booking.gameName} was ended by the administrator. Exit time: ${now.toLocaleTimeString("en-IN")}.`,
        type: "SESSION_ENDED",
        clearable: true,
        cleared: false,
        relatedEntityType: "Booking",
        relatedEntityId: booking._id,
      });

      // Audit Log
      await SessionAuditLog.create({
        action: "END_SESSION",
        adminId: admin.user._id,
        bookingId: booking._id,
        timestamp: now,
      });
    } else {
      // 2. Force End Session (Administrative override)
      if (!reason) {
        return NextResponse.json({ message: "Reason is required for Force End" }, { status: 400 });
      }

      booking.status = "COMPLETED";
      booking.exitedTime = now;
      booking.forceEnded = true;
      booking.forceEndReason = reason;
      booking.forceEndedBy = admin.user._id;
      await booking.save();

      if (applyCharges) {
        // Calculate and apply overtime normally
        await processOvertimeAndExit(booking._id.toString(), now, true);
      }

      if (notifyUser) {
        await Notification.create({
          userId: booking.userId,
          title: "Session Terminated by Admin",
          message: `Your active session for ${booking.gameName} was terminated by the administrator. Reason: ${reason}.`,
          type: "SESSION_ENDED",
          clearable: true,
          cleared: false,
          relatedEntityType: "Booking",
          relatedEntityId: booking._id,
        });
      }

      // Audit Log
      await SessionAuditLog.create({
        action: "FORCE_END_SESSION",
        adminId: admin.user._id,
        bookingId: booking._id,
        reason,
        applyCharges,
        notifyUser,
        timestamp: now,
      });
    }

    // Fetch the updated booking with populated fields to return it
    const updatedBooking = await Booking.findById(id)
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .lean();

    return NextResponse.json({
      success: true,
      message: forceEnd ? "Session force-ended successfully" : "Session ended successfully",
      booking: updatedBooking,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to process session end" }, { status: 500 });
  }
}
