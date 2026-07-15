import mongoose, { Schema, models } from "mongoose";

const DurationSchema = new Schema(
  {
    label: { type: String, required: true },

    months: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    totalDays: { type: Number, required: true },

    playersIncluded: { type: Number, required: true },
    perDayDuration: { type: Number, default: 60 },

    originalPrice: { type: Number, required: true },
    pricingRuleId: {
      type: Schema.Types.ObjectId,
      ref: "PricingRule",
    },

    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FLAT"],
      default: "PERCENTAGE",
    },

    discountValue: { type: Number, default: 0 },
    finalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const PlanSchema = new Schema(
  {
    name: { type: String, required: true },

    type: {
      type: String,
      enum: ["FIXED", "COINS"],
      required: true,
    },

    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
    },

    gameName: String,

    allowUserTimeSelection: {
      type: Boolean,
      default: true,
    },

    adminStartTime: String,
    adminEndTime: String,

    durations: [DurationSchema],

    sessionDurationMode: {
      type: String,
      enum: ["FIXED", "FLEXIBLE"],
      default: "FIXED",
    },
    sessionDuration: { type: Number, default: 60 },
    minDuration: { type: Number, default: 30 },
    maxDuration: { type: Number, default: 180 },

    coinsAmount: Number,
    bonusCoins: { type: Number, default: 0 },
    validityDays: { type: Number, default: 30 },
    validityValue: { type: Number, default: 30 },
    validityUnit: { type: String, enum: ["DAYS", "MONTHS"], default: "DAYS" },
    coinValue: { type: Number, default: 1 },
    price: Number,
    dailyCoinSpendLimit: { type: Number, default: 0 },

    active: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Plan = models.Plan || mongoose.model("Plan", PlanSchema);