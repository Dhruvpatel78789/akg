import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const now = new Date();
    const coupons = await Coupon.find({
      active: true,
      hidden: { $ne: true },
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: now } }
      ]
    }).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, coupons });
  } catch (err: any) {
    console.error("Error fetching player coupons:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
