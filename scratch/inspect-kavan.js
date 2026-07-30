const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const { Booking } = require("../models/Booking");
const { PaymentOrder } = require("../models/PaymentOrder");
const { User } = require("../models/User");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  // Find user Kavan Shah
  const user = await User.findOne({ phone: "7069679060" });
  if (!user) {
    console.log("User not found by phone 7069679060");
    process.exit(0);
  }
  console.log("Found User ID:", user._id, "Name:", user.name);

  // Find bookings
  const bookings = await Booking.find({ userId: user._id });
  console.log(`Found ${bookings.length} bookings:`);
  for (const b of bookings) {
    console.log(`Booking ID: ${b._id}, status: ${b.status}, paymentStatus: ${b.paymentStatus}, razorpayOrderId: ${b.razorpayOrderId}, createdAt: ${b.createdAt}`);
  }

  // Find PaymentOrders
  const orders = await PaymentOrder.find({ userId: user._id });
  console.log(`Found ${orders.length} PaymentOrders for user:`);
  for (const o of orders) {
    console.log(`Order ID: ${o._id}, razorpayOrderId: ${o.razorpayOrderId}, status: ${o.status}, purpose: ${o.purpose}, amount: ${o.amount}, metadata:`, o.metadata);
  }

  process.exit(0);
}

run();
