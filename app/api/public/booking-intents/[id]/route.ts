import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BookingIntent } from "@/models/BookingIntent";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    await connectDB();
    const { id } = await params;

    const intent = await BookingIntent.findById(id).lean();
    if (!intent) {
      return NextResponse.json({ success: false, message: "Booking intent not found" }, { status: 404 });
    }

    const now = new Date();
    const isExpired = intent.expiresAt && new Date(intent.expiresAt) < now;

    return NextResponse.json({
      success: true,
      intent,
      isExpired,
    });
  } catch (error: any) {
    console.error("Failed to fetch booking intent:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
