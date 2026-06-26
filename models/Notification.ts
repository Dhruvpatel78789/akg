import mongoose, { Schema, models } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    type: { type: String, default: "GENERAL", index: true },
    clearable: { type: Boolean, default: true },
    cleared: { type: Boolean, default: false, index: true },
    relatedEntityType: { type: String },
    relatedEntityId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

export const Notification =
  models.Notification || mongoose.model("Notification", NotificationSchema);
