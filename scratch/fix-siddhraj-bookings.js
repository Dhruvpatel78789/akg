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
const { parseIST, formatToISTDate } = require("../lib/time");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  const membershipId = new mongoose.Types.ObjectId("6a898ca432da57315d4dae74");
  const m = await Membership.findById(membershipId);

  if (!m) {
    console.error("Membership not found!");
    process.exit(1);
  }

  console.log("Found membership:", m._id);
  console.log("Current startDate:", m.startDate);
  console.log("Current startTime:", m.startTime);
  console.log("Current endTime:", m.endTime);

  // 1. Correct the membership start/end time to the timezone-safe IST mapping (19:00 - 20:30 IST)
  m.startTime = parseIST("2000-01-01", "19:00");
  m.endTime = parseIST("2000-01-01", "20:30");
  await m.save();
  console.log("Updated membership times in DB.");

  // 2. Clear any existing MEMBER bookings for the user to avoid duplicate runs
  const startDate = new Date(m.startDate);
  const totalDays = m.totalDays || 30;
  const endDate = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

  const deletedBookings = await Booking.deleteMany({
    userId: m.userId,
    gameId: m.gameId,
    playerType: "MEMBER",
    startTime: { $gte: startDate, $lte: endDate }
  });
  console.log(`Deleted ${deletedBookings.deletedCount} pre-existing member bookings in validity range.`);

  // 3. Generate the 30 daily booking slots in IST
  const startISTDateStr = formatToISTDate(m.startDate); // e.g. "2026-08-24"
  const startTimeVal = "19:00";
  const endTimeVal = "20:30";
  const [startH, startM] = startTimeVal.split(":").map(Number);
  const [endH, endM] = endTimeVal.split(":").map(Number);
  
  const bookingPromises = [];
  console.log(`Generating ${totalDays} booking slots starting from ${startISTDateStr} at ${startTimeVal} to ${endTimeVal} IST...`);

  for (let d = 0; d < totalDays; d++) {
    const currentDayStart = parseIST(startISTDateStr, startTimeVal, d);
    const currentDayEnd = parseIST(startISTDateStr, endTimeVal, d);
    
    if (endH < startH || (endH === startH && endM < startM)) {
      currentDayEnd.setDate(currentDayEnd.getDate() + 1);
    }
    
    bookingPromises.push(
      Booking.create({
        userId: m.userId,
        gameId: m.gameId,
        gameName: m.gameName,
        startTime: currentDayStart,
        endTime: currentDayEnd,
        price: 0,
        coinCost: 0,
        playersCount: 4, // standard Pickle Ball plan includes 4 players
        crossMidnight: endH < startH || (endH === startH && endM < startM),
        playerType: "MEMBER",
        paymentMode: "coins",
        paymentStatus: "PAID",
        status: "BOOKED",
      })
    );
  }

  await Promise.all(bookingPromises);
  console.log(`Successfully generated ${totalDays} fixed bookings for Siddhraj.`);

  process.exit(0);
}

run().catch(err => {
  console.error("Error running script:", err);
  process.exit(1);
});
