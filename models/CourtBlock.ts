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
    keepExistingBookings: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CourtBlockSchema.index({ gameId: 1, status: 1, blockedFrom: 1, blockedTo: 1 });

export const CourtBlock =
  models.CourtBlock || mongoose.model("CourtBlock", CourtBlockSchema);