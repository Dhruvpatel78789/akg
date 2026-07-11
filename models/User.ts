import mongoose, { Schema, models } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    dob: { type: Date },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["PLAYER", "ADMIN", "VISITOR"],
      default: "PLAYER",
    },
    coins: { type: Number, default: 0 },
    coinsAvailable: { type: Number, default: 0 },
    coinsFrozen: { type: Number, default: 0 },
    coinsUsed: { type: Number, default: 0 },
    coinsExpired: { type: Number, default: 0 },
    coinsFrozenReason: { type: String, default: "" },
    coinsFrozenAt: { type: Date },
    rewardCoins: { type: Number, default: 0 },
    dailyCoinSpendLimit: { type: Number, default: 0 },
    coinPlanExpiryDate: { type: Date },
    totalCoinsInCycle: { type: Number, default: 0 },
    activePlanId: { type: Schema.Types.ObjectId, ref: "Plan" },
    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    canRescheduleFixedMembership: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    accountSource: {
      type: String,
      enum: [
        "SELF_REGISTERED",
        "VISITOR_BOOKING",
        "ADMIN_CREATED",
        "COMPANY_UPLOAD",
        "ADMIN_CONVERTED_VISITOR"
      ],
      default: "SELF_REGISTERED"
    },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function () {
  if (this.isModified("coins") && !this.isModified("coinsAvailable")) {
    this.coinsAvailable = this.coins;
  } else {
    this.coins = this.coinsAvailable;
  }
});

if (models.User) {
  delete (models as any).User;
}

export const User = mongoose.model("User", UserSchema);