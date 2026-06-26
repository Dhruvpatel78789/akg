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
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = await params;

    const charge = await AdditionalCharge.findById(id);
    if (!charge) {
      return NextResponse.json({ message: "Charge not found" }, { status: 404 });
    }

    charge.status = "SETTLED";
    charge.adminPaymentStatus = "PAID";
    charge.settledAt = new Date();
    charge.adminOverrideBy = admin.user._id;
    charge.adminOverrideAt = new Date();
    await charge.save();

    // Auto-clear any notifications related to this charge
    await Notification.updateMany(
      { relatedEntityId: charge._id, relatedEntityType: "AdditionalCharge" },
      { $set: { cleared: true } }
    );

    // Notify player that the charge was settled
    await Notification.create({
      userId: charge.userId,
      title: "Charge Settled",
      message: `Your pending charge of ₹${charge.amount} for "${charge.reason}" has been marked as settled/paid.`,
      type: "CHARGE_SETTLED",
      clearable: true,
      cleared: false,
      relatedEntityType: "AdditionalCharge",
      relatedEntityId: charge._id,
    });

    return NextResponse.json({ success: true, charge });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to settle charge" }, { status: 500 });
  }
}
