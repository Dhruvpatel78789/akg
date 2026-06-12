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
  },
  { timestamps: true }
);

export const Offer = models.Offer || mongoose.model("Offer", OfferSchema);
