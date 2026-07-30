const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const { Booking } = require("../models/Booking");
const { PaymentOrder } = require("../models/PaymentOrder");
const { updateBookingStatuses } = require("../lib/booking-status-updater");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  // 1. Find all PaymentOrders with type = 'booking' and link them to their Booking
  const orders = await PaymentOrder.find({
    purpose: { $in: ["MEMBER_BOOKING", "booking", "ADDITIONAL_CHARGE"] }
  }).lean();

  console.log(`Checking ${orders.length} orders for linking...`);
  let linkedCount = 0;

  for (const order of orders) {
    const metadata = order.metadata || {};
    const bookingId = metadata.bookingId;
    if (!bookingId) continue;

    const booking = await Booking.findById(bookingId);
    if (booking && !booking.razorpayOrderId && order.razorpayOrderId) {
      booking.razorpayOrderId = order.razorpayOrderId;
      await booking.save();
      linkedCount++;
      console.log(`Linked booking ${booking._id} to Razorpay Order ID: ${order.razorpayOrderId}`);
    }
  }

  console.log(`Linked ${linkedCount} legacy bookings with their Razorpay Order IDs.`);

  // 2. Now run the auto-reconciliation engine
  console.log("Running auto-reconciliation engine...");
  await updateBookingStatuses();
  console.log("Auto-reconciliation complete.");

  // 3. Print final status of Kavan Shah's bookings
  const bookings = await Booking.find({
    _id: { $in: ["6a6b05dda998e44ff25fb7e5", "6a6b10be932ba5f5c2b61cde"] }
  });
  console.log("Final Kavan Shah bookings status:");
  for (const b of bookings) {
    console.log(`Booking ID: ${b._id}, status: ${b.status}, paymentStatus: ${b.paymentStatus}, razorpayOrderId: ${b.razorpayOrderId}`);
  }

  process.exit(0);
}

run();
