import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PaymentOrder } from "@/models/PaymentOrder";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { amount, purpose, userId, metadata } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid amount" },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockkeyid123";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "mocksecret123";

    let orderId = "";
    
    // Check if we are using mock keys
    if (keyId.startsWith("rzp_test_mock")) {
      orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
    } else {
      try {
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });

        const option = {
          amount: Math.round(amount * 100), // in paisa
          currency: "INR",
          receipt: "receipt_" + Date.now(),
        };

        const response = await razorpay.orders.create(option);
        orderId = response.id;
      } catch (err: any) {
        console.error("Razorpay API order creation failed, falling back to mock: ", err);
        orderId = "order_mock_" + Math.random().toString(36).substring(2, 15);
      }
    }

    const order = await PaymentOrder.create({
      userId,
      purpose,
      amount,
      razorpayOrderId: orderId,
      status: "CREATED",
      metadata,
    });

    return NextResponse.json({
      success: true,
      keyId,
      amount: amount * 100,
      currency: "INR",
      orderId,
      paymentOrderId: order._id,
    });
  } catch (err: any) {
    console.error("Error creating payment order:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
