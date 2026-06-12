import mongoose, { Schema, models } from "mongoose";

const BookingRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },

    type: {
      type: String,
      enum: ["CANCELLATION", "TIME_CHANGE"],
      required: true,
    },

    requestedStartTime: Date,
    requestedEndTime: Date,

    reason: String,

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export const BookingRequest =
  models.BookingRequest ||
  mongoose.model("BookingRequest", BookingRequestSchema);