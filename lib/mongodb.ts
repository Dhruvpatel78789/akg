import mongoose from "mongoose";
import { NextResponse } from "next/server";

// Pre-register schemas to prevent Mongoose MissingSchemaErrors
import "@/models/User";
import "@/models/Plan";
import "@/models/Membership";
import "@/models/Booking";
import "@/models/Settings";
import "@/models/CourtHold";
import "@/models/Offer";
import "@/models/Coupon";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI missing in .env.local");
}

function sanitizeErrorMessage(message: string): string {
  const msg = message.toLowerCase();
  if (
    msg.includes("secureconnect") ||
    msg.includes("connecttimeoutms") ||
    msg.includes("mongoserverselectionerror") ||
    msg.includes("econnrefused") ||
    msg.includes("socket timed out") ||
    msg.includes("connection timed out") ||
    msg.includes("timed out after") ||
    msg.includes("socket 'secureconnect' timed out")
  ) {
    return "We are experiencing connection issues. Please try again later.";
  }
  return message;
}

// Global patch for NextResponse.json to ensure database timeout/socket errors are returned in plain English
if (NextResponse && typeof NextResponse.json === "function") {
  const originalJson = NextResponse.json;
  // @ts-ignore
  NextResponse.json = function <T>(body: T, init?: ResponseInit): any {
    const bodyObj = body as any;
    if (bodyObj && typeof bodyObj === "object") {
      if (bodyObj.message && typeof bodyObj.message === "string") {
        bodyObj.message = sanitizeErrorMessage(bodyObj.message);
      }
      if (bodyObj.error && typeof bodyObj.error === "string") {
        bodyObj.error = sanitizeErrorMessage(bodyObj.error);
      }
    }
    return originalJson.call(NextResponse, body, init);
  };
}

// Set global Mongoose configuration to avoid HMR strictPopulate issues.
mongoose.set("strictPopulate", false);

const cached = global as typeof globalThis & {
  mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

if (!cached.mongoose) {
  cached.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.mongoose?.conn) return cached.mongoose.conn;

  if (!cached.mongoose?.promise) {
    cached.mongoose!.promise = mongoose.connect(MONGODB_URI);
  }

  cached.mongoose!.conn = await cached.mongoose!.promise;
  return cached.mongoose!.conn;
}