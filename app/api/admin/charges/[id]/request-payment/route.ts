import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { AdditionalCharge } from "@/models/AdditionalCharge";
import { Notification } from "@/models/Notification";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const admin = await requireAdmin("bookings", "overtimeCharges", true);
    if (admin.error) return admin.error;

    const { id } = await params;

    const charge = await AdditionalCharge.findById(id);
    if (!charge) {
      return NextResponse.json({ message: "Charge not found" }, { status: 404 });
    }

    charge.requestedByAdmin = true;
    await charge.save();

    // Create user notification about pending payment request
    await Notification.create({
      userId: charge.userId,
      title: "Payment Requested",
      message: `An admin has requested payment for: ${charge.reason}. Amount: ₹${charge.amount}. Please pay under Pending Payments.`,
      type: "PAYMENT_REQUESTED",
      clearable: false, // Pending payment notifications cannot be cleared manually
      cleared: false,
      relatedEntityType: "AdditionalCharge",
      relatedEntityId: charge._id,
    });

    return NextResponse.json({ success: true, charge });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to request payment" }, { status: 500 });
  }
}
