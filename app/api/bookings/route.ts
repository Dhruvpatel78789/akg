import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: true, bookings: [] });
}

export async function POST() {
  return NextResponse.json({ success: true, message: "Booking created" });
}
