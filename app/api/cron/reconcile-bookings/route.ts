import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { updateBookingStatuses } from "@/lib/booking-status-updater";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    await updateBookingStatuses();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Cron reconcile-bookings error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
