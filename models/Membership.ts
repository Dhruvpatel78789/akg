import mongoose, { Schema, models } from "mongoose";

const MembershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    gameId: { type: Schema.Types.ObjectId, ref: "Game" },

    gameName: String,
    membershipType: {
      type: String,
      enum: ["FIXED", "FLEXIBLE", "COINS"],
      default: "FIXED",
    },

    durationLabel: String,
    months: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    totalDays: { type: Number, default: 0 },

    startDate: { type: Date, default: Date.now },
    startTime: Date,
    endTime: Date,
    sessionMinutes: { type: Number, default: 0 },
    bufferMinutes: { type: Number, default: 0 },

    price: Number,
    originalPrice: Number,

    status: {
      type: String,
      enum: ["DRAFT", "PENDING_PAYMENT", "ACTIVE", "CANCELLED", "EXPIRED"],
      default: "DRAFT",
    },

    termsAccepted: { type: Boolean, default: false },
    termsAcceptedAt: Date,

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    createdByAdminId: { type: Schema.Types.ObjectId, ref: "User" },
    paidConfirmedByAdminId: { type: Schema.Types.ObjectId, ref: "User" },
    paymentMethod: String,
    paidAt: Date,
  },
  { timestamps: true }
);

export const Membership =
  models.Membership || mongoose.model("Membership", MembershipSchema);