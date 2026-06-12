import mongoose, { Schema, models } from "mongoose";

const CourtBlockSchema = new Schema(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },

    courtId: {
      type: Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },

    blockedFrom: { type: Date, required: true },
    blockedTo: { type: Date, required: true },

    reason: String,

    status: {
      type: String,
      enum: ["ACTIVE", "SCHEDULED", "PENDING_AFTER_SESSION", "COMPLETED"],
      default: "SCHEDULED",
    },

    applyAfterCurrentSession: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CourtBlock =
  models.CourtBlock || mongoose.model("CourtBlock", CourtBlockSchema);