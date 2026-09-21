import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { updateBookingStatuses } from "@/lib/booking-status-updater";

export async function GET() {
  try {
    await connectDB();
    await updateBookingStatuses();

    // Auto freeze expired user coins
    const { User } = await import("@/models/User");
    const expiredUsersCount = await User.countDocuments({
      coinPlanExpiryDate: { $lt: new Date() },
      coinsAvailable: { $gt: 0 },
    });

    if (expiredUsersCount > 0) {
      await User.updateMany(
        {
          coinPlanExpiryDate: { $lt: new Date() },
          coinsAvailable: { $gt: 0 },
        },
        [
          {
            $set: {
              coinsFrozen: "$coinsAvailable",
              coinsAvailable: 0,
              coins: 0,
              coinsFrozenReason: "Plan expired",
              coinsFrozenAt: new Date(),
            }
          }
        ]
      );
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
