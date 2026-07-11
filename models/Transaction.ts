import mongoose, { Schema, models } from "mongoose";

const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["PLAN_PURCHASE", "COINS_PURCHASE", "SESSION_DEDUCTION", "REFUND", "COINS_ADJUSTMENT", "MEMBERSHIP_PURCHASE", "COIN_PLAN_PURCHASE", "ADMIN_COIN_CREDIT", "ADDITIONAL_CHARGE_PAYMENT"],
      required: true,
    },
    amount: Number,
    coins: Number,
    note: String,
    paymentMode: {
      type: String,
      enum: ["coins", "online", "cash"],
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
    },
    transactionId: String,
    refundAmount: { type: Number, default: 0 },
    referenceId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

if (models.Transaction) {
  delete (models as any).Transaction;
}

export const Transaction = mongoose.model("Transaction", TransactionSchema);