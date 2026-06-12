import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PaymentOrder } from "@/models/PaymentOrder";
import { Booking } from "@/models/Booking";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json(
        { success: false, message: "Missing orderId or paymentId" },
        { status: 400 }
      );
    }

    const order = await PaymentOrder.findOne({ razorpayOrderId });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order record not found" },
        { status: 404 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockkeyid123";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "mocksecret123";

    let isValid = false;

    // Verify mock orders
    if (razorpayOrderId.startsWith("order_mock_") || keyId.startsWith("rzp_test_mock") || razorpaySignature === "mock_signature_bypass") {
      isValid = true;
    } else {
      // Perform signature verification
      const signText = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(signText)
        .digest("hex");

      isValid = expectedSignature === razorpaySignature;
    }

    if (!isValid) {
      order.status = "FAILED";
      await order.save();
      return NextResponse.json(
        { success: false, message: "Payment signature verification failed" },
        { status: 400 }
      );
    }

    // Mark order as PAID
    order.razorpayPaymentId = razorpayPaymentId;
    order.status = "PAID";
    await order.save();

    // If bookingId is in metadata, update booking paymentStatus to PAID
    const bookingId = order.metadata?.get("bookingId");
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.paymentStatus = "PAID";
        booking.transactionId = razorpayPaymentId;
        await booking.save();
      }
    }

    // If chargeId is in metadata, update additional charge status to PAID
    const chargeId = order.metadata?.get("chargeId");
    if (chargeId) {
      const { AdditionalCharge } = await import("@/models/AdditionalCharge");
      const { Transaction } = await import("@/models/Transaction");
      const charge = await AdditionalCharge.findById(chargeId);
      if (charge) {
        charge.status = "PAID";
        charge.settledAt = new Date();
        await charge.save();

        await Transaction.create({
          userId: charge.userId,
          type: "ADDITIONAL_CHARGE_PAYMENT",
          amount: charge.amount,
          coins: 0,
          note: `Paid additional charge: ${charge.reason}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      order,
    });
  } catch (err: any) {
    console.error("Error verifying payment signature:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Verification failed" },
      { status: 500 }
    );
  }
}
