const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const mongoose = require("mongoose");

// Register models
require("../models/User");
require("../models/Plan");
require("../models/Membership");
require("../models/Booking");

const Booking = mongoose.model("Booking");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  // Get DK Patel member bookings
  const userId = new mongoose.Types.ObjectId("6a29304d384534501340d7f4");
  const bookings = await Booking.find({ userId, playerType: "MEMBER" }).sort({ startTime: 1 }).lean();
  
  console.log(`DK Patel Member Bookings (${bookings.length}):`);
  bookings.slice(0, 10).forEach(b => {
    console.log(`Booking ID: ${b._id}`);
    console.log(`  start: ${new Date(b.startTime).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}`);
    console.log(`  end: ${new Date(b.endTime).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}`);
    console.log(`  createdAt: ${new Date(b.createdAt).toISOString()}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error("Error running script:", err);
  process.exit(1);
});
