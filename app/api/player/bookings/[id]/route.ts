import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Booking } from "@/models/Booking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await Booking.findById(id).lean();

    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }

    // Check if it belongs to the user (unless they are admin)
    if (booking.userId.toString() !== authUser.userId && authUser.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const isExpired = booking.paymentStatus === "PENDING" && booking.intentExpiresAt && new Date(booking.intentExpiresAt) < now;

    return NextResponse.json({
      success: true,
      booking,
      isExpired: Boolean(isExpired),
    });
  } catch (error: any) {
    console.error("GET booking by ID error:", error);
    return NextResponse.json({ message: error.message || "Failed to load booking details" }, { status: 500 });
  }
}
