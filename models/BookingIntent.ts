import mongoose, { Schema, models } from "mongoose";

const BookingIntentSchema = new Schema(
  {
    phone: {
      type: String,
      required: true,
    },
    customerName: String,
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },
    gameName: {
      type: String,
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    startTime: {
      type: String, // HH:MM
      required: true,
    },
    endTime: {
      type: String, // HH:MM
      required: true,
    },
    playersCount: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      enum: ["WHATSAPP", "VOICE"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "PAID", "CONFIRMED", "FAILED", "EXPIRED", "ADMIN_REVIEW"],
      default: "PENDING_PAYMENT",
    },
    paymentOrderId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

if (models.BookingIntent) {
  delete (models as any).BookingIntent;
}

export const BookingIntent = mongoose.model("BookingIntent", BookingIntentSchema);
