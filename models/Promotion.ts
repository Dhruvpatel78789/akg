import mongoose, { Schema, models } from "mongoose";

const PromotionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["TEXT", "IMAGE", "VIDEO"],
      required: true,
    },
    title: {
      type: String,
      required: function (this: any) {
        return this.type === "TEXT";
      },
    },
    subtitle: String,
    description: String,
    ctaText: String,
    ctaLink: String,
    mediaUrl: String,
    thumbnailUrl: String,
    altText: String,
    backgroundColor: String,
    textColor: String,
    accentColor: String,
    placement: {
      type: String,
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ["ALL", "VISITOR", "PLAYER", "MEMBER", "COIN_USER", "COMPANY_USER", "ADMIN"],
      default: "ALL",
    },
    priority: {
      type: Number,
      default: 0,
    },
    startDate: Date,
    endDate: Date,
    startTime: String,
    endTime: String,
    daysOfWeek: [Number],
    fullDay: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    softDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const Promotion =
  models.Promotion ||
  mongoose.model("Promotion", PromotionSchema);