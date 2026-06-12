import mongoose, { Schema, models } from "mongoose";

const PaymentOrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    purpose: { type: String, required: true }, // e.g. "VISITOR_BOOKING", "MEMBER_BOOKING", "MEMBERSHIP", "COINS", "OVERTIME"
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    status: {
      type: String,
      enum: ["CREATED", "PAID", "FAILED", "EXPIRED"],
      default: "CREATED",
    },
    metadata: { type: Schema.Types.Map, of: String },
  },
  { timestamps: true }
);

export const PaymentOrder = models.PaymentOrder || mongoose.model("PaymentOrder", PaymentOrderSchema);
