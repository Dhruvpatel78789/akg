import mongoose, { Schema, models } from "mongoose";

const CompanyEmployeeSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String },
    dateOfBirth: { type: Date },
    department: { type: String },
    designation: { type: String },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    gender: { type: String },
    joiningDate: { type: Date },
    emergencyContact: { type: String },
    notes: { type: String },
    softDeleted: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Ensure that employeeId, mobile, and email are unique within the same company
CompanyEmployeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
CompanyEmployeeSchema.index({ companyId: 1, mobile: 1 }, { unique: true });
CompanyEmployeeSchema.index({ companyId: 1, email: 1 }, { unique: true });

export const CompanyEmployee = models.CompanyEmployee || mongoose.model("CompanyEmployee", CompanyEmployeeSchema);
