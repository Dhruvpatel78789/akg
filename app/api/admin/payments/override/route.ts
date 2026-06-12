import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { AdditionalCharge } from "@/models/AdditionalCharge";
import { PaymentAuditLog } from "@/models/PaymentAuditLog";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const adminResult = await requireAdmin("bookings", undefined, true);
    if (adminResult.error) {
      return adminResult.error;
    }

    const { payableId, payableType, newStatus, reason, password } = await req.json();

    if (!payableId || !payableType || !newStatus || !password) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: payableId, payableType, newStatus, password" },
        { status: 400 }
      );
    }

    const allowedStatuses = ["PENDING", "PAID", "FAILED", "WAIVED"];
    if (!allowedStatuses.includes(newStatus)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment status" },
        { status: 400 }
      );
    }

    const adminUserDoc = await User.findById(adminResult.user._id);
    if (!adminUserDoc) {
      return NextResponse.json(
        { success: false, message: "Admin user not found" },
        { status: 404 }
      );
    }

    const isMatch = await bcrypt.compare(password, adminUserDoc.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "Invalid password. Override rejected." },
        { status: 401 }
      );
    }

    let payableDoc: any = null;
    let oldStatus = "PENDING";

    if (payableType === "Booking") {
      payableDoc = await Booking.findById(payableId);
      if (!payableDoc) {
        return NextResponse.json({ success: false, message: "Booking not found" }, { status: 404 });
      }
      oldStatus = payableDoc.adminPaymentStatus || "PENDING";
      payableDoc.adminPaymentStatus = newStatus;
      payableDoc.adminOverrideBy = adminResult.user._id;
      payableDoc.adminOverrideAt = new Date();
      if (newStatus === "PAID" || newStatus === "WAIVED") {
        payableDoc.paidAt = new Date();
      }
      await payableDoc.save();
    } else if (payableType === "AdditionalCharge") {
      payableDoc = await AdditionalCharge.findById(payableId);
      if (!payableDoc) {
        return NextResponse.json({ success: false, message: "Additional charge not found" }, { status: 404 });
      }
      oldStatus = payableDoc.adminPaymentStatus || "PENDING";
      payableDoc.adminPaymentStatus = newStatus;
      payableDoc.adminOverrideBy = adminResult.user._id;
      payableDoc.adminOverrideAt = new Date();
      if (newStatus === "PAID" || newStatus === "WAIVED") {
        payableDoc.paidAt = new Date();
      }
      await payableDoc.save();
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid payableType" },
        { status: 400 }
      );
    }

    await PaymentAuditLog.create({
      adminId: adminResult.user._id,
      payableId: payableDoc._id,
      payableType,
      oldStatus,
      newStatus,
      reason: reason || "",
      changedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Payment status updated successfully",
      payable: payableDoc,
    });
  } catch (err: any) {
    console.error("Payment override error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Override failed" },
      { status: 500 }
    );
  }
}
