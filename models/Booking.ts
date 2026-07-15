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
    subtotal: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    appliedPromotions: [
      {
        name: String,
        discountAmount: Number,
        type: { type: String, enum: ["AUTO_OFFER", "COUPON"] }
      }
    ],
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
    autoEnded: { type: Boolean, default: false },
    paymentMethod: {
      type: String,
      enum: ["RAZORPAY", "PAY_AT_COUNTER", "COINS", "MEMBERSHIP"],
      default: "RAZORPAY",
    },
    refundAmount: { type: Number, default: 0 },
    forceEnded: { type: Boolean, default: false },
    forceEndReason: { type: String },
    forceEndedBy: { type: Schema.Types.ObjectId, ref: "User" },
    intentCreatedAt: { type: Date },
    intentExpiresAt: { type: Date },
    rescheduleRequired: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BookingSchema.index({ gameId: 1, status: 1, softDeleted: 1, startTime: 1, endTime: 1 });
BookingSchema.index({ userId: 1 });

BookingSchema.pre("save", async function () {
  const doc = this as any;
  if (doc.paymentStatus === "PAID" && doc.gatewayPaymentStatus === "PENDING" && doc.adminPaymentStatus === "PENDING") {
    doc.adminPaymentStatus = "PAID";
  }
  doc.effectivePaymentStatus = (doc.gatewayPaymentStatus === "PAID" || doc.adminPaymentStatus === "PAID" || doc.adminPaymentStatus === "WAIVED") ? "PAID" : "PENDING";
  // Sync legacy paymentStatus for backward compatibility
  if (doc.effectivePaymentStatus === "PAID") {
    doc.paymentStatus = "PAID";
  }
});

BookingSchema.post("save", async function (doc: any) {
  try {
    const { createDependencyBlocksForBooking, clearDependencyBlocksForBooking } = await import("@/lib/dependency-helper");
    await clearDependencyBlocksForBooking(doc._id);

    if (doc.status === "BOOKED" || doc.status === "STARTED") {
      if (!doc.softDeleted) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const isActive = doc.paymentStatus === "PAID" ||
          doc.paymentMethod === "PAY_AT_COUNTER" ||
          (doc.paymentStatus === "PENDING" && doc.createdAt >= tenMinutesAgo) ||
          (doc.paymentStatus === "PENDING" && doc.intentExpiresAt && new Date(doc.intentExpiresAt) > new Date());

        if (isActive) {
          await createDependencyBlocksForBooking(doc);
        }
      }
    }
  } catch (err) {
    console.error("Booking post-save dependency block error:", err);
  }
});

const handlePostUpdate = async function (this: any) {
  try {
    const query = this.getQuery();
    const updatedDocs = await this.model.find(query);
    const { createDependencyBlocksForBooking, clearDependencyBlocksForBooking } = await import("@/lib/dependency-helper");
    for (const doc of updatedDocs) {
      await clearDependencyBlocksForBooking(doc._id);
      if (doc.status === "BOOKED" || doc.status === "STARTED") {
        if (!doc.softDeleted) {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          const isActive = doc.paymentStatus === "PAID" ||
            doc.paymentMethod === "PAY_AT_COUNTER" ||
            (doc.paymentStatus === "PENDING" && doc.createdAt >= tenMinutesAgo) ||
            (doc.paymentStatus === "PENDING" && doc.intentExpiresAt && new Date(doc.intentExpiresAt) > new Date());

          if (isActive) {
            await createDependencyBlocksForBooking(doc);
          }
        }
      }
    }
  } catch (err) {
    console.error("Booking post-update dependency block error:", err);
  }
};

BookingSchema.post("updateOne", handlePostUpdate);
BookingSchema.post("updateMany", handlePostUpdate);
BookingSchema.post("findOneAndUpdate", handlePostUpdate);

if (models.Booking) {
  delete (models as any).Booking;
}

export const Booking = mongoose.model("Booking", BookingSchema);