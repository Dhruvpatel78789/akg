const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const { Booking } = require("../models/Booking");
const { Transaction } = require("../models/Transaction");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  // We want to update Kavan Shah's booking ID that was paid.
  // The first booking ID is: 6a6b05dda998e44ff25fb7e5
  const bookingId = "6a6b05dda998e44ff25fb7e5";
  const booking = await Booking.findById(bookingId);

  if (booking) {
    booking.paymentStatus = "PAID";
    booking.gatewayPaymentStatus = "PAID";
    booking.status = "BOOKED";
    booking.paidAt = new Date();
    await booking.save();
    console.log(`Successfully forced booking ${booking._id} status to PAID/BOOKED.`);

    // Create transaction if not present
    const existingTx = await Transaction.findOne({ note: { $regex: new RegExp(booking._id.toString()) } });
    if (!existingTx) {
      await Transaction.create({
        userId: booking.userId,
        type: "SESSION_DEDUCTION",
        amount: booking.price || 0,
        coins: 0,
        note: `Online payment booking for ${booking.gameName} on court ${booking.court || "N/A"} (Booking ID: ${booking._id})`,
        paymentMode: "online",
        paymentStatus: "PAID",
      });
      console.log("Created transaction record.");
    }
  } else {
    console.log("Booking not found!");
  }

  process.exit(0);
}

run();
