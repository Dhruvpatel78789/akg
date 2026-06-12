import mongoose, { Schema, models } from "mongoose";

const SettingsSchema = new Schema(
  {
    exitQrToken: {
      type: String,
      default: "default-exit-qr-token-123",
    },
    visitorRescheduleHours: { type: Number, default: 24 },
    visitorCancellationHours: { type: Number, default: 24 },
    memberRescheduleHours: { type: Number, default: 24 },
    memberCancellationHours: { type: Number, default: 24 },
    billingLetterheadUrl: { type: String, default: "" },
    maxVisitorCoinUsagePercentage: { type: Number, default: 20 },
  },
  { timestamps: true }
);

export const Settings = models.Settings || mongoose.model("Settings", SettingsSchema);
