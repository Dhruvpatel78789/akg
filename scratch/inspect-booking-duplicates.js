const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const { Booking } = require("../models/Booking");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  const duplicates = await Booking.aggregate([
    {
      $group: {
        _id: {
          startTime: "$startTime",
          endTime: "$endTime",
          court: "$court",
          gameId: "$gameId"
        },
        count: { $sum: 1 },
        ids: { $push: "$_id" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  console.log(`Found ${duplicates.length} duplicate groups in Booking collection.`);
  duplicates.forEach((d) => {
    console.log(`Start: ${d._id.startTime} - Court: ${d._id.court} - Count: ${d.count}`);
  });

  process.exit(0);
}

run();
