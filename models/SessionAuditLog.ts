import mongoose, { Schema, models } from "mongoose";

const SessionAuditLogSchema = new Schema(
  {
    action: { type: String, required: true, enum: ["END_SESSION", "FORCE_END_SESSION"] },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    reason: { type: String },
    applyCharges: { type: Boolean },
    notifyUser: { type: Boolean },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const SessionAuditLog =
  models.SessionAuditLog || mongoose.model("SessionAuditLog", SessionAuditLogSchema);
