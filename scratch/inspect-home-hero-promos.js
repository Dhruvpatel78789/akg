const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { connectDB } = require("../lib/mongodb");
const mongoose = require("mongoose");

require("../models/Promotion");
const Promotion = mongoose.model("Promotion");

async function run() {
  await connectDB();
  console.log("Connected to MongoDB.");

  const promos = await Promotion.find({
    placement: "HOME_HERO"
  }).lean();

  console.log(`Found ${promos.length} HOME_HERO promotions:`);
  promos.forEach((p) => {
    console.log(`- ID: ${p._id}`);
    console.log(`  Title: ${p.title || "(No title)"}`);
    console.log(`  Type: ${p.type}`);
    console.log(`  MediaUrl: ${p.mediaUrl}`);
    console.log(`  Priority: ${p.priority}`);
    console.log(`  Active: ${p.active}, SoftDeleted: ${p.softDeleted}`);
    console.log(`  TargetAudience: ${p.targetAudience}`);
    console.log(`  StartDate: ${p.startDate}`);
    console.log(`  EndDate: ${p.endDate}`);
    console.log(`  DaysOfWeek: ${JSON.stringify(p.daysOfWeek)}`);
    console.log(`  FullDay: ${p.fullDay}, StartTime: ${p.startTime}, EndTime: ${p.endTime}`);
    console.log("---");
  });

  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
