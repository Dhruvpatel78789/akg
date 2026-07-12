import mongoose, { Schema, models } from "mongoose";

const DependencyBlockSchema = new Schema(
  {
    sourceBookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    sourceGameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },
    blockedGameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    courtId: {
      type: Schema.Types.ObjectId,
      ref: "Court",
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    createdAutomatically: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

if (models.DependencyBlock) {
  delete (models as any).DependencyBlock;
}

export const DependencyBlock = mongoose.model("DependencyBlock", DependencyBlockSchema);
