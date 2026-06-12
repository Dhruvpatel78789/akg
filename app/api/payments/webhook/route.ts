import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PaymentOrder } from "@/models/PaymentOrder";
import { resolveBookingIntent } from "@/lib/booking-intent-resolver";

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    
    console.log("Razorpay Webhook received:", body);
    
    const event = body.event;
    const paymentEntity = body.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || body.payload?.order?.entity?.id;
    const paymentId = paymentEntity?.id;

    if (!orderId) {
      return NextResponse.json({ success: true, message: "No order ID in webhook payload, skipped" });
    }

    // Update standard PaymentOrder status
    const order = await PaymentOrder.findOne({ razorpayOrderId: orderId });
    if (order) {
      if (event === "payment.captured" || event === "order.paid") {
        order.status = "PAID";
        order.razorpayPaymentId = paymentId;
        await order.save();
      } else if (event === "payment.failed") {
        order.status = "FAILED";
        order.razorpayPaymentId = paymentId;
        await order.save();
      }
    }

    // Resolve BookingIntent
    if (event === "payment.captured" || event === "order.paid") {
      const result = await resolveBookingIntent(orderId, paymentId, "PAID");
      console.log("Webhook BookingIntent resolution result:", result);
    } else if (event === "payment.failed") {
      const result = await resolveBookingIntent(orderId, paymentId || "failed", "FAILED");
      console.log("Webhook BookingIntent failure logged:", result);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Razorpay Webhook handler error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
