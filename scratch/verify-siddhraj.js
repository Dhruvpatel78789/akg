const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const mongoose = require("mongoose");

// Register models
require("../models/User");
require("../models/Plan");
require("../models/Membership");
require("../models/Booking");

const Membership = mongoose.model("Membership");
const Booking = mongoose.model("Booking");
const { formatToISTDate, formatToISTTime } = require("../lib/time");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  const userId = new mongoose.Types.ObjectId("6a2d2ac541b6517e5d4fd2e3");
  const m = await Membership.findOne({ userId, membershipType: "FIXED", status: "ACTIVE" }).lean();
  
  if (m) {
    console.log("=== MEMBERSHIP ===");
    console.log(`ID: ${m._id}`);
    console.log(`startDate (IST): ${formatToISTDate(m.startDate)}`);
    console.log(`startTime (IST): ${formatToISTTime(m.startTime)}`);
    console.log(`endTime (IST): ${formatToISTTime(m.endTime)}`);
  } else {
    console.log("No active FIXED membership for Siddhraj");
  }

  const bookings = await Booking.find({ userId, playerType: "MEMBER" }).sort({ startTime: 1 }).lean();
  console.log(`\n=== BOOKINGS (${bookings.length}) ===`);
  bookings.forEach((b, idx) => {
    console.log(`${idx + 1}. Booking ID: ${b._id}`);
    console.log(`   Start: ${new Date(b.startTime).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}`);
    console.log(`   End:   ${new Date(b.endTime).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error("Error running script:", err);
  process.exit(1);
});
