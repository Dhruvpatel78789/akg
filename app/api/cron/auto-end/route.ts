import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { updateBookingStatuses } from "@/lib/booking-status-updater";

export async function GET() {
  try {
    await connectDB();
    await updateBookingStatuses();

    // Auto freeze expired user coins
    const { User } = await import("@/models/User");
    const expiredUsers = await User.find({
      coinPlanExpiryDate: { $lt: new Date() },
      coinsAvailable: { $gt: 0 },
    });
    for (const u of expiredUsers) {
      u.coinsFrozen = u.coinsAvailable;
      u.coinsAvailable = 0;
      u.coins = 0;
      u.coinsFrozenReason = `Plan expired on ${u.coinPlanExpiryDate ? new Date(u.coinPlanExpiryDate).toLocaleDateString("en-IN") : "unknown date"}`;
      u.coinsFrozenAt = new Date();
      await u.save();
    }

    // Auto expire unpaid booking intents
    const { BookingIntent } = await import("@/models/BookingIntent");
    await BookingIntent.updateMany(
      {
        status: "PENDING_PAYMENT",
        expiresAt: { $lt: new Date() },
      },
      {
        $set: { status: "EXPIRED" }
      }
    );

    return NextResponse.json({ success: true, message: "Booking statuses, coin expirations, and intent expirations automated successfully." });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Automation failed" }, { status: 500 });
  }
}
