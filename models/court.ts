import mongoose, { Schema, models } from "mongoose";

const CourtSchema = new Schema(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },
    name: { type: String, required: true },
    active: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CourtSchema.index({ gameId: 1, active: 1, disabled: 1 });

export const Court = models.Court || mongoose.model("Court", CourtSchema);