import mongoose, { Schema, models } from "mongoose";

const CourtHoldSchema = new Schema(
  {
    courtId: {
      type: Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    holdExpiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["HELD", "RELEASED", "CONFIRMED"],
      default: "HELD",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    paymentOrderId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove expired holds after their expiration time
CourtHoldSchema.index({ holdExpiresAt: 1 }, { expireAfterSeconds: 0 });

if (models.CourtHold) {
  delete (models as any).CourtHold;
}

export const CourtHold = mongoose.model("CourtHold", CourtHoldSchema);
