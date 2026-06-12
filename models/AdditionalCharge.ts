import mongoose, { Schema, models } from "mongoose";

const AdditionalChargeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "AWAITING_SETTLEMENT", "COLLECTED", "WAIVED", "SETTLED", "PAID", "FAILED"],
      default: "PENDING",
    },
    gatewayPaymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    adminPaymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "WAIVED"],
      default: "PENDING",
    },
    effectivePaymentStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    paidAt: { type: Date },
    adminOverrideBy: { type: Schema.Types.ObjectId, ref: "User" },
    adminOverrideAt: { type: Date },
    settledAt: Date,
  },
  { timestamps: true }
);

AdditionalChargeSchema.pre("save", function (this: any, next: any) {
  if (this.status === "PAID" && this.gatewayPaymentStatus === "PENDING" && this.adminPaymentStatus === "PENDING") {
    this.adminPaymentStatus = "PAID";
  }
  this.effectivePaymentStatus = (this.gatewayPaymentStatus === "PAID" || this.adminPaymentStatus === "PAID" || this.adminPaymentStatus === "WAIVED") ? "PAID" : "PENDING";
  if (this.effectivePaymentStatus === "PAID") {
    this.status = "PAID";
  }
  next();
});

export const AdditionalCharge =
  models.AdditionalCharge ||
  mongoose.model("AdditionalCharge", AdditionalChargeSchema);
