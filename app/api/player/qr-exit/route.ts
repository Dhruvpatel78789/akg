import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Booking } from "@/models/Booking";
import { Settings } from "@/models/Settings";
import { Notification } from "@/models/Notification";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
import { AdditionalCharge } from "@/models/AdditionalCharge";
import { SessionEntry } from "@/models/SessionEntry";
import { processOvertimeAndExit } from "@/lib/overtime-calculator";

export async function GET(request: Request) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ message: "Missing QR code token" }, { status: 400 });
    }

    const settings = await Settings.findOne();
    if (!settings || settings.exitQrToken !== token) {
      return NextResponse.json({ message: "Invalid or expired Exit QR code scanned" }, { status: 403 });
    }

    let activeSessions = [];
    if (authUser.role === "COMPANY_EMPLOYEE") {
      const entries = await SessionEntry.find({
        companyEmployeeId: authUser.userId,
        status: "STARTED",
        softDeleted: false,
      }).lean();
      
      activeSessions = entries.map((e: any) => ({
        _id: e._id.toString(),
        gameId: e.gameId?.toString(),
        gameName: e.gameName,
        court: e.court,
        startTime: e.startTime,
        endTime: e.endTime,
        status: e.status,
      }));
    } else {
      activeSessions = await Booking.find({
        userId: authUser.userId,
        status: "STARTED",
        softDeleted: false,
      }).lean();
    }

    return NextResponse.json({ success: true, activeSessions });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to parse checkout session" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionIds, token } = body;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ message: "Select at least one session to end" }, { status: 400 });
    }

    const settings = await Settings.findOne();
    if (!settings || settings.exitQrToken !== token) {
      return NextResponse.json({ message: "Invalid or expired Exit QR code" }, { status: 403 });
    }

    const now = new Date();

    if (authUser.role === "COMPANY_EMPLOYEE") {
      const scannedEntries = await SessionEntry.find({
        _id: { $in: sessionIds },
        companyEmployeeId: authUser.userId,
        status: "STARTED",
      });

      if (scannedEntries.length === 0) {
        return NextResponse.json({ message: "No active corporate sessions found to exit" }, { status: 404 });
      }

      const groupIds = scannedEntries.map(e => e.bookingGroupId).filter(Boolean);

      const entriesToComplete = await SessionEntry.find({
        bookingGroupId: { $in: groupIds },
        status: "STARTED",
      });

      for (const e of entriesToComplete) {
        if (e.bookingId) {
          await processOvertimeAndExit(e.bookingId.toString(), now, false);
        }
      }

      return NextResponse.json({ success: true, message: `Successfully ended corporate session group(s)` });
    }

    // Normal player flow
    const bookings = await Booking.find({
      _id: { $in: sessionIds },
      userId: authUser.userId,
      status: "STARTED",
    });

    for (const b of bookings) {
      if (b._id) {
        await processOvertimeAndExit(b._id.toString(), now, false);
      }
    }

    return NextResponse.json({ success: true, message: `Successfully ended ${bookings.length} session(s)` });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Checkout execution failed" }, { status: 500 });
  }
}
