import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PaymentOrder } from "@/models/PaymentOrder";
import { resolveBookingIntent } from "@/lib/booking-intent-resolver";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    await connectDB();
    const rawBody = await request.text();
    
    // Webhook signature verification
    const signature = request.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (secret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error("Razorpay webhook signature verification failed.");
        return NextResponse.json({ success: false, message: "Invalid webhook signature" }, { status: 400 });
      }
    }

    const body = JSON.parse(rawBody);
    console.log("Razorpay Webhook received and verified:", body);
    
    const event = body.event;
    const paymentEntity = body.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || body.payload?.order?.entity?.id;
    const paymentId = paymentEntity?.id;

    if (!orderId) {
      return NextResponse.json({ success: true, message: "No order ID in webhook payload, skipped" });
    }

    const isPaidEvent = event === "payment.captured" || event === "order.paid";
    const isFailedEvent = event === "payment.failed";

    // Update standard PaymentOrder status
    const order = await PaymentOrder.findOne({ razorpayOrderId: orderId });
    if (order) {
      if (isPaidEvent) {
        // If already paid, avoid double-processing
        if (order.status !== "PAID") {
          order.status = "PAID";
          order.razorpayPaymentId = paymentId;
          await order.save();

          // Resolve Booking
          const bookingId = order.metadata?.get("bookingId");
          if (bookingId) {
            const { Booking } = await import("@/models/Booking");
            const { Transaction } = await import("@/models/Transaction");
            const booking = await Booking.findById(bookingId);
            if (booking && booking.paymentStatus !== "PAID") {
              booking.paymentStatus = "PAID";
              booking.status = "BOOKED";
              booking.transactionId = paymentId;
              booking.paidAt = new Date();
              await booking.save();

              await Transaction.create({
                userId: booking.userId,
                type: "SESSION_DEDUCTION",
                amount: order.amount || booking.price || 0,
                coins: 0,
                note: `Online payment booking for ${booking.gameName} on court ${booking.court || "N/A"}`,
                paymentMode: "online",
                paymentStatus: "PAID",
              });
            }
          }

          // Resolve Additional Charge
          const chargeId = order.metadata?.get("chargeId");
          if (chargeId) {
            const { AdditionalCharge } = await import("@/models/AdditionalCharge");
            const { Transaction } = await import("@/models/Transaction");
            const { Notification } = await import("@/models/Notification");
            const charge = await AdditionalCharge.findById(chargeId);
            if (charge && charge.status !== "PAID") {
              charge.status = "PAID";
              charge.settledAt = new Date();
              await charge.save();

              // Clear associated notification
              await Notification.updateMany(
                { relatedEntityId: charge._id, relatedEntityType: "AdditionalCharge" },
                { $set: { cleared: true } }
              );

              await Transaction.create({
                userId: charge.userId,
                type: "ADDITIONAL_CHARGE_PAYMENT",
                amount: charge.amount,
                coins: 0,
                note: `Paid additional charge: ${charge.reason}`,
              });
            }
          }
        }
      } else if (isFailedEvent) {
        order.status = "FAILED";
        order.razorpayPaymentId = paymentId;
        await order.save();
      }
    }

    // Resolve BookingIntent (voice/wa visitors)
    if (isPaidEvent) {
      const result = await resolveBookingIntent(orderId, paymentId, "PAID");
      console.log("Webhook BookingIntent resolution result:", result);
    } else if (isFailedEvent) {
      const result = await resolveBookingIntent(orderId, paymentId || "failed", "FAILED");
      console.log("Webhook BookingIntent failure logged:", result);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Razorpay Webhook handler error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
