import mongoose, { Schema, models } from "mongoose";

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, enum: ["FLAT", "PERCENTAGE"], required: true },
    value: { type: Number, required: true },
    minBookingAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 }, // For PERCENTAGE coupons

    // New Fields
    discountType: { type: String, enum: ["FLAT", "PERCENTAGE"] },
    discountValue: { type: Number },
    minimumOrderValue: { type: Number, default: 0 },
    maximumDiscount: { type: Number },

    applicableGames: { type: [Schema.Types.ObjectId], ref: "Game", default: [] },
    applicableUserTypes: { type: [String], default: [] },
    startDate: { type: Date },
    endDate: { type: Date },

    expiryDate: { type: Date },
    active: { type: Boolean, default: true },
    hidden: { type: Boolean, default: false },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    applicableOnMembership: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Pre-save hook to keep old and new fields perfectly in sync
CouponSchema.pre("save", function () {
  const doc = this as any;
  if (doc.discountType) {
    doc.type = doc.discountType;
  } else if (doc.type) {
    doc.discountType = doc.type;
  }

  if (doc.discountValue !== undefined) {
    doc.value = doc.discountValue;
  } else if (doc.value !== undefined) {
    doc.discountValue = doc.value;
  }

  if (doc.minimumOrderValue !== undefined) {
    doc.minBookingAmount = doc.minimumOrderValue;
  } else if (doc.minBookingAmount !== undefined) {
    doc.minimumOrderValue = doc.minBookingAmount;
  }

  if (doc.maximumDiscount !== undefined) {
    doc.maxDiscount = doc.maximumDiscount;
  } else if (doc.maxDiscount !== undefined) {
    doc.maximumDiscount = doc.maxDiscount;
  }
});

export const Coupon = models.Coupon || mongoose.model("Coupon", CouponSchema);
