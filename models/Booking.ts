import mongoose, { Schema, models } from "mongoose";

const BookingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    companyEmployeeId: { type: Schema.Types.ObjectId, ref: "CompanyEmployee" },
    gameId: { type: Schema.Types.ObjectId, ref: "Game" },
    gameName: String,
    court: String,
    startTime: Date,
    endTime: Date,
    exitedTime: Date,
    status: {
      type: String,
      enum: ["BOOKED", "STARTED", "COMPLETED", "CANCELLED"],
      default: "BOOKED",
    },
    coinCost: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    playersCount: { type: Number, default: 1 },
    crossMidnight: { type: Boolean, default: false },
    softDeleted: { type: Boolean, default: false },
    playerType: {
      type: String,
      enum: ["MEMBER", "VISITOR", "COMPANY"],
      default: "MEMBER",
    },
    paymentMode: {
      type: String,
      enum: ["coins", "online", "cash"],
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "PROCESSING", "CANCELLED"],
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
    transactionId: { type: String },
    refundAmount: { type: Number, default: 0 },
    autoEnded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BookingSchema.pre("save", function (this: any, next: any) {
  if (this.paymentStatus === "PAID" && this.gatewayPaymentStatus === "PENDING" && this.adminPaymentStatus === "PENDING") {
    this.adminPaymentStatus = "PAID";
  }
  this.effectivePaymentStatus = (this.gatewayPaymentStatus === "PAID" || this.adminPaymentStatus === "PAID" || this.adminPaymentStatus === "WAIVED") ? "PAID" : "PENDING";
  // Sync legacy paymentStatus for backward compatibility
  if (this.effectivePaymentStatus === "PAID") {
    this.paymentStatus = "PAID";
  }
  next();
});

if (models.Booking) {
  delete (models as any).Booking;
}

export const Booking = mongoose.model("Booking", BookingSchema);