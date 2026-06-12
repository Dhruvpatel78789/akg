import mongoose, { Schema, models } from "mongoose";

const CouponUsageSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    discountAmount: { type: Number, required: true },
  },
  { timestamps: true }
);

export const CouponUsage = models.CouponUsage || mongoose.model("CouponUsage", CouponUsageSchema);
