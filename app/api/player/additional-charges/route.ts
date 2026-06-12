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
      status: { $in: ["PENDING", "AWAITING_SETTLEMENT"] }
    })
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, charges });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load additional charges" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { chargeId } = body;

    if (!chargeId) {
      return NextResponse.json({ message: "Missing charge ID" }, { status: 400 });
    }

    const charge = await AdditionalCharge.findOne({
      _id: chargeId,
      userId: authUser.userId
    });

    if (!charge) {
      return NextResponse.json({ message: "Charge not found" }, { status: 404 });
    }

    if (charge.status !== "PENDING") {
      return NextResponse.json({ message: "Charge has already been paid or processed" }, { status: 400 });
    }

    charge.status = "AWAITING_SETTLEMENT";
    await charge.save();

    return NextResponse.json({ success: true, message: "Payment successful. Awaiting admin settlement." });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Payment processing failed" }, { status: 500 });
  }
}
