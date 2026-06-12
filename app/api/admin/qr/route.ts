import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Settings } from "@/models/Settings";
import crypto from "crypto";

export async function GET() {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        exitQrToken: crypto.randomBytes(16).toString("hex"),
      });
    }

    return NextResponse.json({ success: true, exitQrToken: settings.exitQrToken });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load exit QR" }, { status: 500 });
  }
}

export async function POST() {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const newToken = crypto.randomBytes(16).toString("hex");
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ exitQrToken: newToken });
    } else {
      settings.exitQrToken = newToken;
      await settings.save();
    }

    return NextResponse.json({ success: true, exitQrToken: settings.exitQrToken });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to regenerate exit QR" }, { status: 500 });
  }
}
