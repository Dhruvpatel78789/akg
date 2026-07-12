import mongoose, { Schema, models } from "mongoose";

const RecurringCourtBlockSchema = new Schema(
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
    startTime: { type: String, required: true }, // e.g. "18:00"
    endTime: { type: String, required: true }, // e.g. "20:00"
    daysOfWeek: {
      type: [String],
      enum: ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
      required: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    reason: { type: String },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    softDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RecurringCourtBlockSchema.index({ gameId: 1, active: 1, softDeleted: 1 });

if (models.RecurringCourtBlock) {
  delete (models as any).RecurringCourtBlock;
}

export const RecurringCourtBlock = mongoose.model("RecurringCourtBlock", RecurringCourtBlockSchema);
