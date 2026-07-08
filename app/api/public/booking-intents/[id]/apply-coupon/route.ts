import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BookingIntent } from "@/models/BookingIntent";
import { Coupon } from "@/models/Coupon";
import { CouponUsage } from "@/models/CouponUsage";
import { User } from "@/models/User";
import { PaymentOrder } from "@/models/PaymentOrder";
import Razorpay from "razorpay";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ success: false, message: "Missing coupon code" }, { status: 400 });
    }

    const intent = await BookingIntent.findById(id);
    if (!intent) {
      return NextResponse.json({ success: false, message: "Booking intent not found" }, { status: 404 });
    }

    if (intent.status === "CONFIRMED" || intent.status === "PAID") {
      return NextResponse.json({ success: false, message: "Booking is already paid/confirmed" }, { status: 400 });
    }

    const now = new Date();
    if (intent.expiresAt && new Date(intent.expiresAt) < now) {
      return NextResponse.json({ success: false, message: "Booking session has expired" }, { status: 400 });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });
    if (!coupon) {
      return NextResponse.json({ success: false, message: "Invalid or inactive coupon code" }, { status: 404 });
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      return NextResponse.json({ success: false, message: "Coupon has expired" }, { status: 400 });
    }

    // Determine original price to check minimum amount
    const originalPriceStr = intent.metadata?.get("originalPrice") || (intent.metadata as any)?.originalPrice;
    const originalPrice = originalPriceStr ? Number(originalPriceStr) : intent.price;

    const minVal = coupon.minimumOrderValue ?? coupon.minBookingAmount ?? 0;
    if (originalPrice < minVal) {
      return NextResponse.json({
        success: false,
        message: `This coupon is valid only on orders of ₹${minVal} or more.`
      }, { status: 400 });
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ success: false, message: "Coupon usage limit reached" }, { status: 400 });
    }

    // Check usage by this phone number
    const matchedUser = await User.findOne({ phone: intent.phone });
    if (matchedUser) {
      const priorUsage = await CouponUsage.findOne({ couponId: coupon._id, userId: matchedUser._id });
      if (priorUsage) {
        return NextResponse.json({ success: false, message: "This phone number has already used this coupon code" }, { status: 400 });
      }
    }

    // Calculate discount
    let discount = 0;
    const type = coupon.discountType || coupon.type;
    const value = coupon.discountValue ?? coupon.value ?? 0;
    const maxDiscount = coupon.maximumDiscount ?? coupon.maxDiscount;

    if (type === "FLAT") {
      discount = value;
      if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount > 0) {
        discount = Math.min(discount, maxDiscount);
      }
    } else if (type === "PERCENTAGE") {
      discount = (originalPrice * value) / 100;
      if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount > 0) {
        discount = Math.min(discount, maxDiscount);
      }
    }
    discount = Math.min(discount, originalPrice);
    const finalPrice = Math.max(0, originalPrice - discount);

    // Create a new Razorpay Order for the discounted price
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockkeyid123";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "mocksecret123";
    let orderId = "";

    if (finalPrice <= 0) {
      orderId = "order_free_coupon_" + Math.random().toString(36).substring(2, 10);
    } else if (keyId.startsWith("rzp_test_mock")) {
      orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
    } else {
      try {
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });

        const response = await razorpay.orders.create({
          amount: Math.round(finalPrice * 100), // in paise
          currency: "INR",
          receipt: "receipt_intent_" + Date.now(),
        });
        orderId = response.id;
      } catch (err: any) {
        console.error("Razorpay order creation failed during coupon apply, falling back to mock:", err);
        orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
      }
    }

    // Create a new PaymentOrder Record
    const paymentOrder = await PaymentOrder.create({
      purpose: "BOOKING_INTENT",
      amount: finalPrice,
      razorpayOrderId: orderId,
      status: "CREATED",
      metadata: {
        phone: intent.phone,
        gameName: intent.gameName,
      },
    });

    // Update BookingIntent
    if (!intent.metadata) {
      intent.metadata = new Map();
    }
    if (!intent.metadata.has("originalPrice")) {
      intent.metadata.set("originalPrice", originalPrice.toString());
    }
    intent.metadata.set("couponId", coupon._id.toString());
    intent.metadata.set("couponCode", coupon.code);
    intent.metadata.set("discount", discount.toString());
    
    intent.price = finalPrice;
    intent.paymentOrderId = paymentOrder._id.toString();
    intent.razorpayOrderId = orderId;
    await intent.save();

    return NextResponse.json({
      success: true,
      message: "Coupon applied successfully",
      discountAmount: discount,
      finalPrice,
      razorpayOrderId: orderId,
    });
  } catch (error: any) {
    console.error("Failed to apply coupon on booking intent:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
