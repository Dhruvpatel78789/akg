import mongoose, { Schema, models } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    contactPerson: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true },
    billingAddress: { type: String, required: true },
    gstNumber: { type: String },
    allowedGameIds: [{ type: Schema.Types.ObjectId, ref: "Game" }],
    discountPercentage: { type: Number, default: 0 },
    gameDiscounts: [
      {
        gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true },
        discountType: { type: String, enum: ["PERCENTAGE", "FLAT"], required: true },
        discountValue: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    colorCode: { type: String },
    softDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Company = models.Company || mongoose.model("Company", CompanySchema);
