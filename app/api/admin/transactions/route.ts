import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Transaction } from "@/models/Transaction";

export async function GET() {
  try {
    await connectDB();

    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const transactions = await Transaction.find({})
      .populate("userId", "name phone email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ transactions });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load transactions" }, { status: 500 });
  }
}
