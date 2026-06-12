import mongoose, { Schema, models } from "mongoose";

const PaymentAuditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payableId: { type: Schema.Types.ObjectId, required: true },
    payableType: { type: String, required: true, enum: ["Booking", "AdditionalCharge"] },
    oldStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    reason: { type: String },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const PaymentAuditLog =
  models.PaymentAuditLog ||
  mongoose.model("PaymentAuditLog", PaymentAuditLogSchema);
