import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PaymentOrder } from "@/models/PaymentOrder";
import { Booking } from "@/models/Booking";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { razorpayOrderId, status } = body; // status: "FAILED", "CANCELLED", "PROCESSING"

    if (!razorpayOrderId || !status) {
      return NextResponse.json({ success: false, message: "Missing razorpayOrderId or status" }, { status: 400 });
    }

    const order = await PaymentOrder.findOne({ razorpayOrderId });
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    order.status = status;
    await order.save();

    // If bookingId is present in metadata, update booking payment status
    const bookingId = order.metadata?.get("bookingId");
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        if (status === "FAILED") {
          booking.paymentStatus = "FAILED";
        } else if (status === "CANCELLED") {
          booking.paymentStatus = "CANCELLED";
        } else if (status === "PROCESSING") {
          booking.paymentStatus = "PROCESSING";
        }
        await booking.save();
      }
    }

    return NextResponse.json({ success: true, message: `Status updated to ${status}` });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
