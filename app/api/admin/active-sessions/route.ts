import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Booking } from "@/models/Booking";
import { Notification } from "@/models/Notification";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
import { AdditionalCharge } from "@/models/AdditionalCharge";
import { processOvertimeAndExit } from "@/lib/overtime-calculator";

export async function GET() {
  try {
    await connectDB();
    const admin = await requireAdmin("bookings", "ongoingSessions", false);
    if (admin.error) return admin.error;

    const activeSessions = await Booking.find({
      status: "STARTED",
      paymentStatus: "PAID",
      softDeleted: false,
    })
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .sort({ startTime: 1 })
      .lean();

    return NextResponse.json({ success: true, activeSessions });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch active sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin("bookings", "ongoingSessions", true);
    if (admin.error) return admin.error;

    const body = await request.json();
    const { bookingId, forceEnd } = body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ message: "Session booking not found" }, { status: 404 });
    }

    if (booking.status !== "STARTED") {
      return NextResponse.json({ message: "Session is not currently active" }, { status: 400 });
    }

    const now = new Date();
    await processOvertimeAndExit(booking._id.toString(), now, forceEnd);

    // Notify player
    await Notification.create({
      userId: booking.userId,
      title: forceEnd ? "Session Force-Ended by Admin" : "Session Ended by Admin",
      message: forceEnd 
        ? `Your active session for ${booking.gameName} has been force-ended by the administrator.`
        : `Your session for ${booking.gameName} was ended by the administrator. Exit time: ${now.toLocaleTimeString("en-IN")}.`,
    });

    return NextResponse.json({
      success: true,
      message: forceEnd ? "Session force-ended successfully" : "Session ended successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to process session end" }, { status: 500 });
  }
}
