import mongoose, { Schema, models } from "mongoose";

const CompanyBillItemSchema = new Schema({
  sessionEntryId: { type: Schema.Types.ObjectId, ref: "SessionEntry" },
  employeeName: { type: String, required: true },
  employeeId: { type: String, required: true },
  gameName: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  actualDuration: { type: Number, default: 0 },
  billableUnits: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
});

const CompanyBillSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    totalPlayers: { type: Number, required: true },
    totalSessions: { type: Number, required: true },
    subtotalAmount: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    letterPadHeader: { type: String },
    status: {
      type: String,
      enum: ["DRAFT", "GENERATED", "SENT", "PAID", "CANCELLED"],
      default: "DRAFT",
    },
    items: [CompanyBillItemSchema],
    softDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CompanyBill = models.CompanyBill || mongoose.model("CompanyBill", CompanyBillSchema);
