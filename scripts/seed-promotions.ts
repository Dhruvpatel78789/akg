import mongoose from "mongoose";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local if not already loaded
if (!process.env.MONGODB_URI) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    });
  }
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not defined in environment or .env.local");
  process.exit(1);
}

// Define Schema locally to avoid Next.js alias resolution issues
const PromotionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["TEXT", "IMAGE", "VIDEO"], required: true },
    title: String,
    subtitle: String,
    description: String,
    ctaText: String,
    ctaLink: String,
    mediaUrl: String,
    thumbnailUrl: String,
    altText: String,
    backgroundColor: String,
    textColor: String,
    accentColor: String,
    placement: { type: String, required: true },
    targetAudience: {
      type: String,
      enum: ["ALL", "VISITOR", "PLAYER", "MEMBER", "COIN_USER", "COMPANY_USER", "ADMIN"],
      default: "ALL",
    },
    priority: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    startTime: String,
    endTime: String,
    daysOfWeek: [Number],
    fullDay: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
    createdBy: mongoose.Schema.Types.ObjectId,
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

const Promotion = mongoose.models.Promotion || mongoose.model("Promotion", PromotionSchema);

const dashboardPromotions = [
  {
    type: "TEXT",
    title: "Extra Play Time",
    subtitle: "Get bonus minutes on selected slots",
    backgroundColor: "#D7E528",
    textColor: "#000000",
    accentColor: "#F5F4EC",
    placement: "PLAYER_DASHBOARD_TOP",
    targetAudience: "ALL",
    priority: 3,
    active: true,
  },
  {
    type: "TEXT",
    title: "New Turf Open",
    subtitle: "Book your preferred court today",
    backgroundColor: "#F6401E",
    textColor: "#FFFFFF",
    accentColor: "#111111",
    placement: "PLAYER_DASHBOARD_TOP",
    targetAudience: "ALL",
    priority: 2,
    active: true,
  },
  {
    type: "TEXT",
    title: "Coin Recharge Bonus",
    subtitle: "Recharge coins and get extra value",
    backgroundColor: "#93D1CC",
    textColor: "#000000",
    accentColor: "#03210F",
    placement: "PLAYER_DASHBOARD_TOP",
    targetAudience: "ALL",
    priority: 1,
    active: true,
  },
];

const homePromotions = [
  {
    type: "TEXT",
    title: "Weekend Tournament",
    subtitle: "Register now and win rewards",
    ctaText: "Register Now",
    ctaLink: "/player/tournament",
    backgroundColor: "#D7E528",
    textColor: "#000000",
    accentColor: "#F6401E",
    placement: "HOME_HERO",
    targetAudience: "ALL",
    priority: 3,
    active: true,
  },
  {
    type: "TEXT",
    title: "Member Plans",
    subtitle: "Fixed slots, flexible bookings, better pricing",
    ctaText: "View Plans",
    ctaLink: "/player/membership",
    backgroundColor: "#93D1CC",
    textColor: "#000000",
    accentColor: "#03210F",
    placement: "HOME_HERO",
    targetAudience: "ALL",
    priority: 2,
    active: true,
  },
  {
    type: "TEXT",
    title: "Recharge Coins",
    subtitle: "Buy coins and book faster",
    ctaText: "Buy Coins",
    ctaLink: "/player/membership",
    backgroundColor: "#F8D66D",
    textColor: "#000000",
    accentColor: "#F6401E",
    placement: "HOME_HERO",
    targetAudience: "ALL",
    priority: 1,
    active: true,
  },
];

async function seed() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(MONGODB_URI!);
    console.log("Connected to MongoDB database.");

    // Delete existing seeded promotions to avoid duplicates
    console.log("Cleaning up existing promotions in HOME_HERO and PLAYER_DASHBOARD_TOP...");
    await Promotion.deleteMany({
      placement: { $in: ["HOME_HERO", "PLAYER_DASHBOARD_TOP"] },
    });

    console.log("Seeding Player Dashboard promotions...");
    for (const promo of dashboardPromotions) {
      await Promotion.create(promo);
    }

    console.log("Seeding Home Hero promotions...");
    for (const promo of homePromotions) {
      await Promotion.create(promo);
    }

    console.log("Seeding complete successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seed();
