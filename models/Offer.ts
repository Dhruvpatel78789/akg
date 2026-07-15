import mongoose, { Schema, models } from "mongoose";

const OfferSchema = new Schema(
  {
    name: { type: String, required: true },
    discountType: { type: String, enum: ["FLAT", "PERCENTAGE"], required: true },
    value: { type: Number, required: true },
    active: { type: Boolean, default: true },
    daysOfWeek: [{ type: Number }], // 0 = Sunday, 1 = Monday, etc.
    startHour: { type: Number, min: 0, max: 23 }, // e.g. 10 for 10:00
    endHour: { type: Number, min: 0, max: 23 }, // e.g. 15 for 15:00
    gameId: { type: Schema.Types.ObjectId, ref: "Game" }, // Optional limit to specific game
    applicableGames: { type: [Schema.Types.ObjectId], ref: "Game", default: [] },
    applyToAllGames: { type: Boolean, default: false },
    canCombine: { type: Boolean, default: false },
    allowedOfferIds: [{ type: Schema.Types.ObjectId }],
  },
  { timestamps: true }
);

export const Offer = models.Offer || mongoose.model("Offer", OfferSchema);
