const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const { PaymentOrder } = require("../models/PaymentOrder");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  // Find by metadata.bookingId
  const orders = await PaymentOrder.find({
    $or: [
      { "metadata.bookingId": "6a6b05dda998e44ff25fb7e5" },
      { "metadata.bookingId": "6a6b10be932ba5f5c2b61cde" }
    ]
  });

  console.log(`Found ${orders.length} orders directly by bookingId:`);
  for (const o of orders) {
    console.log(`Order ID: ${o._id}, razorpayOrderId: ${o.razorpayOrderId}, status: ${o.status}, amount: ${o.amount}, metadata:`, o.metadata);
  }

  process.exit(0);
}

run();
