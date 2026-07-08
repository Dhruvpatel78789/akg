import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Coupon } from "@/models/Coupon";
import { CouponUsage } from "@/models/CouponUsage";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    const body = await req.json();
    const { code, bookingAmount, isMembershipPurchase, gameId } = body;

    if (!code || bookingAmount === undefined) {
      return NextResponse.json({ success: false, valid: false, message: "Missing code or bookingAmount" }, { status: 400 });
    }

    const billAmount = Number(bookingAmount);

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return NextResponse.json({ success: false, valid: false, message: "Invalid coupon code" }, { status: 404 });
    }

    if (!coupon.active) {
      return NextResponse.json({ success: false, valid: false, message: "This coupon is currently inactive" }, { status: 400 });
    }

    const now = new Date();

    // Start Date check
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return NextResponse.json({ success: false, valid: false, message: "This coupon is not active yet" }, { status: 400 });
    }

    // End Date / Expiry check
    const expiry = coupon.endDate || coupon.expiryDate;
    if (expiry && new Date(expiry) < now) {
      return NextResponse.json({ success: false, valid: false, message: "Coupon code has expired" }, { status: 400 });
    }

    // Applicable Game check
    if (gameId && coupon.applicableGames && coupon.applicableGames.length > 0) {
      const isApplicable = coupon.applicableGames.some((gId: any) => gId.toString() === gameId.toString());
      if (!isApplicable) {
        return NextResponse.json({ success: false, valid: false, message: "This coupon is not applicable to the selected game" }, { status: 400 });
      }
    }

    // User Type check
    if (authUser) {
      const user = await User.findById(authUser.userId).lean();
      const userRole = user?.role || "MEMBER"; // default to MEMBER
      if (coupon.applicableUserTypes && coupon.applicableUserTypes.length > 0) {
        const isUserTypeApplicable = coupon.applicableUserTypes.some((role: string) => role.toUpperCase() === userRole.toUpperCase());
        if (!isUserTypeApplicable) {
          return NextResponse.json({ success: false, valid: false, message: "This coupon is not applicable to your account type" }, { status: 400 });
        }
      }
    }

    // Minimum order value check
    const minOrderVal = coupon.minimumOrderValue ?? coupon.minBookingAmount ?? 0;
    if (billAmount < minOrderVal) {
      return NextResponse.json({
        success: false,
        valid: false,
        message: `This coupon is valid only on orders of ₹${minOrderVal} or more.`
      }, { status: 400 });
    }

    // Applicable on membership plan check
    if (isMembershipPurchase && !coupon.applicableOnMembership) {
      return NextResponse.json({ success: false, valid: false, message: "This coupon is only valid for game bookings, not membership recharges." }, { status: 400 });
    }

    // Usage limit check
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ success: false, valid: false, message: "Coupon usage limit reached" }, { status: 400 });
    }

    // User-specific usage limit check
    if (authUser) {
      const priorUsage = await CouponUsage.findOne({ couponId: coupon._id, userId: authUser.userId });
      if (priorUsage) {
        return NextResponse.json({ success: false, valid: false, message: "You have already used this coupon code" }, { status: 400 });
      }
    }

    // Safe calculations
    const type = coupon.discountType || coupon.type;
    const value = coupon.discountValue ?? coupon.value ?? 0;
    const maxDiscount = coupon.maximumDiscount ?? coupon.maxDiscount;

    let discount = 0;
    if (type === "FLAT") {
      discount = value;
      if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount > 0) {
        discount = Math.min(discount, maxDiscount);
      }
    } else if (type === "PERCENTAGE") {
      discount = (billAmount * value) / 100;
      if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount > 0) {
        discount = Math.min(discount, maxDiscount);
      }
    }

    // Safety checks
    discount = Math.min(discount, billAmount);
    const payableAmount = Math.max(0, billAmount - discount);

    return NextResponse.json({
      success: true,
      valid: true,
      couponId: coupon._id,
      couponCode: coupon.code,
      discountType: type,
      discountValue: value,
      maxDiscount: maxDiscount || null,
      billAmount,
      discountAmount: discount,
      payableAmount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, valid: false, message: err.message }, { status: 500 });
  }
}
