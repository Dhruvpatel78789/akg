import mongoose, { Schema, models } from "mongoose";

const AdminAuditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String },
    details: { type: Schema.Types.Map, of: String },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const AdminAuditLog =
  models.AdminAuditLog || mongoose.model("AdminAuditLog", AdminAuditLogSchema);
