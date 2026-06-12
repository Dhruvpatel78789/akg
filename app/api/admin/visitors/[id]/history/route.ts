import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Transaction } from "@/models/Transaction";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const admin = await requireAdmin("visitorCoins", "coinHistory", false);
    if (admin.error) return admin.error;

    const { id } = await params;
    const history = await Transaction.find({ userId: id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, history });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
