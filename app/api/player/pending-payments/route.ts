import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { AdditionalCharge } from "@/models/AdditionalCharge";

export async function GET() {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const charges = await AdditionalCharge.find({
      userId: authUser.userId,
      status: "PENDING",
      requestedByAdmin: true,
    })
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, charges });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load pending payments" }, { status: 500 });
  }
}
