import mongoose, { Schema, models } from "mongoose";

const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["PLAN_PURCHASE", "COINS_PURCHASE", "SESSION_DEDUCTION", "REFUND"],
      required: true,
    },
    amount: Number,
    coins: Number,
    note: String,
    paymentMode: {
      type: String,
      enum: ["coins", "online", "cash"],
    },
    transactionId: String,
    refundAmount: { type: Number, default: 0 },
    referenceId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

export const Transaction =
  models.Transaction || mongoose.model("Transaction", TransactionSchema);