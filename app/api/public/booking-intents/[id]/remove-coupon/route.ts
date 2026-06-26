import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BookingIntent } from "@/models/BookingIntent";
import { PaymentOrder } from "@/models/PaymentOrder";
import Razorpay from "razorpay";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;

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

    const originalPriceStr = intent.metadata?.get("originalPrice") || (intent.metadata as any)?.originalPrice;
    if (!originalPriceStr) {
      return NextResponse.json({ success: true, message: "No coupon applied to remove", finalPrice: intent.price });
    }

    const restoredPrice = Number(originalPriceStr);

    // Create new Razorpay order for the original price
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockkeyid123";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "mocksecret123";
    let orderId = "";

    if (keyId.startsWith("rzp_test_mock")) {
      orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
    } else {
      try {
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });

        const response = await razorpay.orders.create({
          amount: Math.round(restoredPrice * 100),
          currency: "INR",
          receipt: "receipt_intent_" + Date.now(),
        });
        orderId = response.id;
      } catch (err: any) {
        console.error("Razorpay order creation failed during coupon remove:", err);
        orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
      }
    }

    // Create PaymentOrder Record
    const paymentOrder = await PaymentOrder.create({
      purpose: "BOOKING_INTENT",
      amount: restoredPrice,
      razorpayOrderId: orderId,
      status: "CREATED",
      metadata: {
        phone: intent.phone,
        gameName: intent.gameName,
      },
    });

    // Remove coupon entries
    if (intent.metadata) {
      intent.metadata.delete("couponId");
      intent.metadata.delete("couponCode");
      intent.metadata.delete("discount");
      intent.metadata.delete("originalPrice");
    }

    intent.price = restoredPrice;
    intent.paymentOrderId = paymentOrder._id.toString();
    intent.razorpayOrderId = orderId;
    await intent.save();

    return NextResponse.json({
      success: true,
      message: "Coupon removed successfully",
      finalPrice: restoredPrice,
      razorpayOrderId: orderId,
    });
  } catch (error: any) {
    console.error("Failed to remove coupon from booking intent:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
