const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const { PaymentOrder } = require("../models/PaymentOrder");
const { Booking } = require("../models/Booking");
const mongoose = require("mongoose");

async function run() {
  try {
    await connectDB();
    console.log("Connected to MongoDB.");

    // Find all paid PaymentOrders
    const orders = await PaymentOrder.find({ status: "PAID" }).lean();
    console.log(`Found ${orders.length} paid orders to check.`);

    let updatedCount = 0;
    for (const order of orders) {
      const metadata = order.metadata || {};
      const bookingId = metadata.bookingId;

      if (!bookingId) continue;

      const booking = await Booking.findById(bookingId);
      if (booking) {
        let changed = false;
        
        if (!booking.razorpayOrderId && order.razorpayOrderId) {
          booking.razorpayOrderId = order.razorpayOrderId;
          changed = true;
        }
        if (!booking.razorpayPaymentId && order.razorpayPaymentId) {
          booking.razorpayPaymentId = order.razorpayPaymentId;
          booking.transactionId = order.razorpayPaymentId;
          changed = true;
        }
        if (booking.gatewayPaymentStatus !== "PAID") {
          booking.gatewayPaymentStatus = "PAID";
          changed = true;
        }

        if (changed) {
          await booking.save();
          updatedCount++;
          console.log(`Updated booking ${booking._id} for player ${booking.userId || "N/A"} with Order ID ${order.razorpayOrderId}`);
        }
      }
    }

    console.log(`Migration finished. Successfully updated ${updatedCount} legacy bookings.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
