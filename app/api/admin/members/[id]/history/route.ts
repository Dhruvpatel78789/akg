import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";
import { Booking } from "@/models/Booking";
import { Transaction } from "@/models/Transaction";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = await params;

    const user = await User.findById(id).lean();
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const memberships = await Membership.find({ userId: id }).sort({ createdAt: -1 }).lean();
    const bookings = await Booking.find({ userId: id }).sort({ startTime: -1 }).lean();
    const transactions = await Transaction.find({ userId: id }).sort({ createdAt: -1 }).lean();

    // Played sessions (status = COMPLETED)
    const playedSessions = bookings.filter((b) => b.status === "COMPLETED");
    
    // Total playtime calculations (sum of duration of completed bookings)
    let totalPlaytimeMinutes = 0;
    playedSessions.forEach((b) => {
      if (b.startTime && b.endTime) {
        const diff = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
        totalPlaytimeMinutes += Math.max(0, Math.floor(diff / (1000 * 60)));
      }
    });
    const totalHoursPlayed = Number((totalPlaytimeMinutes / 60).toFixed(1));

    // Refunds and cancellations counts
    const refunds = transactions.filter((t) => t.type === "REFUND");
    const cancellations = bookings.filter((b) => b.status === "CANCELLED");

    return NextResponse.json({
      success: true,
      profile: {
        user,
        memberships,
        bookings,
        playedSessions,
        totalHoursPlayed,
        transactions,
        refunds,
        cancellations,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load member history" }, { status: 500 });
  }
}
