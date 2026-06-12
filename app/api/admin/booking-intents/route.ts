import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { BookingIntent } from "@/models/BookingIntent";

export async function GET(request: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const date = searchParams.get("date");

    const query: any = {};
    if (status) query.status = status;
    if (source) query.source = source.toUpperCase();
    if (date) query.date = date;

    const intents = await BookingIntent.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, intents });
  } catch (error: any) {
    console.error("Failed to list booking intents:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await request.json();
    const { intentId, status, adminNote } = body;

    if (!intentId) {
      return NextResponse.json({ success: false, message: "Missing intentId" }, { status: 400 });
    }

    const intent = await BookingIntent.findById(intentId);
    if (!intent) {
      return NextResponse.json({ success: false, message: "Booking intent not found" }, { status: 404 });
    }

    if (status) {
      intent.status = status;
    }

    if (adminNote !== undefined) {
      if (!intent.metadata) {
        intent.metadata = new Map();
      }
      intent.metadata.set("adminNote", adminNote);
    }

    await intent.save();

    return NextResponse.json({ success: true, intent });
  } catch (error: any) {
    console.error("Failed to update booking intent:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
