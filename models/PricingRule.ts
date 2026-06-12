import mongoose, { Schema, models } from "mongoose";

const PricingRuleSchema = new Schema(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },

    minPlayers: {
      type: Number,
      required: true,
      min: 1,
    },

    maxPlayers: {
      type: Number,
      required: true,
      min: 1,
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    mode: {
      type: String,
      enum: ["PER_PLAYER", "COURT_BASE_PLUS_PLAYER"],
      required: true,
    },

    baseCourtPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    pricePerPlayer: {
      type: Number,
      required: true,
      min: 0,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

PricingRuleSchema.index({
  gameId: 1,
  durationMinutes: 1,
  minPlayers: 1,
  maxPlayers: 1,
});

export const PricingRule =
  models.PricingRule || mongoose.model("PricingRule", PricingRuleSchema);