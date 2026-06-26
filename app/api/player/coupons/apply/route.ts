import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import { CouponUsage } from "@/models/CouponUsage";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    const body = await req.json();
    const { code, bookingAmount } = body;

    if (!code || !bookingAmount) {
      return NextResponse.json({ success: false, message: "Missing code or bookingAmount" }, { status: 400 });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });
    if (!coupon) {
      return NextResponse.json({ success: false, message: "Invalid or inactive coupon code" }, { status: 404 });
    }

    // Expiry check
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return NextResponse.json({ success: false, message: "Coupon code has expired" }, { status: 400 });
    }

    // Min amount check
    if (bookingAmount < coupon.minBookingAmount) {
      return NextResponse.json({ success: false, message: `Minimum booking amount to use this coupon is ₹${coupon.minBookingAmount}` }, { status: 400 });
    }

    // Check if applying for membership but coupon is not allowed on membership
    const { isMembershipPurchase } = body;
    if (isMembershipPurchase && !coupon.applicableOnMembership) {
      return NextResponse.json({ success: false, message: "This coupon is only valid for game bookings, not membership recharges." }, { status: 400 });
    }

    // Usage limit check
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ success: false, message: "Coupon usage limit reached" }, { status: 400 });
    }

    // User-specific usage limit check (e.g. max once per user)
    if (authUser) {
      const priorUsage = await CouponUsage.findOne({ couponId: coupon._id, userId: authUser.userId });
      if (priorUsage) {
        return NextResponse.json({ success: false, message: "You have already used this coupon code" }, { status: 400 });
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === "FLAT") {
      discount = coupon.value;
    } else if (coupon.type === "PERCENTAGE") {
      discount = (bookingAmount * coupon.value) / 100;
      if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    }

    // Ensure discount doesn't exceed booking amount
    discount = Math.min(discount, bookingAmount);

    return NextResponse.json({
      success: true,
      couponId: coupon._id,
      code: coupon.code,
      discountAmount: discount,
      finalAmount: bookingAmount - discount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
