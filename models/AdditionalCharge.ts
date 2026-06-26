import mongoose, { Schema, models } from "mongoose";

const AdditionalChargeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    requestedByAdmin: { type: Boolean, default: false },
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
    additionalUnits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AdditionalChargeSchema.pre("save", async function () {
  const doc = this as any;
  if (doc.status === "PAID" && doc.gatewayPaymentStatus === "PENDING" && doc.adminPaymentStatus === "PENDING") {
    doc.adminPaymentStatus = "PAID";
  }
  doc.effectivePaymentStatus = (doc.gatewayPaymentStatus === "PAID" || doc.adminPaymentStatus === "PAID" || doc.adminPaymentStatus === "WAIVED") ? "PAID" : "PENDING";
  if (doc.effectivePaymentStatus === "PAID") {
    doc.status = "PAID";
  }
});

if (models.AdditionalCharge) {
  delete (models as any).AdditionalCharge;
}

export const AdditionalCharge = mongoose.model("AdditionalCharge", AdditionalChargeSchema);
