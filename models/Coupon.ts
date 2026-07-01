import mongoose, { Schema, models } from "mongoose";

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, enum: ["FLAT", "PERCENTAGE"], required: true },
    value: { type: Number, required: true },
    minBookingAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 }, // For PERCENTAGE coupons
    expiryDate: { type: Date },
    active: { type: Boolean, default: true },
    hidden: { type: Boolean, default: false },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    applicableOnMembership: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Coupon = models.Coupon || mongoose.model("Coupon", CouponSchema);
