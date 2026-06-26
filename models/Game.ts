import mongoose, { Schema, models } from "mongoose";

const GameSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    duration: {
      type: Number,
      required: true,
    },

    maximumDuration: {
      type: Number,
      required: true,
    },

    bufferMinutes: {
      type: Number,
      default: 0,
    },

    fixedSlotBooking: {
      type: Boolean,
      default: false,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Game = models.Game || mongoose.model("Game", GameSchema);