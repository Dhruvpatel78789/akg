import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { AdditionalCharge } from "@/models/AdditionalCharge";

import { Game } from "@/models/Game";

import { SessionEntry } from "@/models/SessionEntry";

export async function GET() {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    // Recalculate any pending/awaiting settlement overtime charges using the new pro-rata formula
    const pendingCharges = await AdditionalCharge.find({
      status: { $in: ["PENDING", "AWAITING_SETTLEMENT"] }
    }).populate("bookingId");

    for (const charge of pendingCharges) {
      const booking: any = charge.bookingId;
      if (!booking || !booking.startTime || !booking.endTime || !booking.exitedTime) continue;

      const game = await Game.findById(booking.gameId).lean();
      if (!game) continue;

      const minDuration = game.duration || 60;
      const bookedDurationMs = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
      const bookedDurationMinutes = Math.floor(bookedDurationMs / (60 * 1000));

      const playDurationMs = new Date(booking.exitedTime).getTime() - new Date(booking.startTime).getTime();
      const playDurationMinutes = Math.floor(playDurationMs / (60 * 1000));

      const extraMinutes = playDurationMinutes - bookedDurationMinutes;
      if (extraMinutes <= 0) continue;

      const extraUnits = Math.ceil(extraMinutes / minDuration);
      const rateBasis = booking.price || booking.coinCost || 0;
      const newAmount = Math.round(((rateBasis / (bookedDurationMinutes || 60)) * minDuration) * extraUnits);

      if (newAmount > 0 && charge.amount !== newAmount) {
        charge.amount = newAmount;
        charge.reason = `Overtime charge: played ${playDurationMinutes} minutes (booked ${bookedDurationMinutes} minutes) for ${booking.playersCount || 1} player(s). Extra: ${extraMinutes} mins (${extraUnits} unit(s)) based on pro-rata rate calculation.`;
        await charge.save();
      }
    }

    const charges = await AdditionalCharge.find({})
      .populate("userId", "name phone email")
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    const companyOvertime = await SessionEntry.find({ entryType: "OVERTIME", softDeleted: false })
      .populate("userId", "name phone email role")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .populate("companyId", "name")
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, charges, companyOvertime });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load additional charges" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await request.json();
    const { chargeId, status, companyEntryId, companyOvertimeStatus } = body;

    if (companyEntryId) {
      if (!companyOvertimeStatus || !["PENDING", "REVIEWED", "INCLUDED"].includes(companyOvertimeStatus)) {
        return NextResponse.json({ message: "Invalid companyOvertimeStatus" }, { status: 400 });
      }
      const entry = await SessionEntry.findById(companyEntryId);
      if (!entry) {
        return NextResponse.json({ message: "Company entry not found" }, { status: 404 });
      }
      entry.companyOvertimeStatus = companyOvertimeStatus;
      await entry.save();
      return NextResponse.json({ success: true, entry });
    }

    if (!chargeId || !status || !["PENDING", "AWAITING_SETTLEMENT", "COLLECTED", "WAIVED", "SETTLED"].includes(status)) {
      return NextResponse.json({ message: "Invalid parameters" }, { status: 400 });
    }

    const charge = await AdditionalCharge.findById(chargeId);
    if (!charge) {
      return NextResponse.json({ message: "Charge not found" }, { status: 404 });
    }

    charge.status = status;
    if (status === "SETTLED") {
      charge.settledAt = new Date();
    }
    await charge.save();

    return NextResponse.json({ success: true, charge });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update charge" }, { status: 500 });
  }
}
