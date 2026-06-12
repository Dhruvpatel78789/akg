import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Transaction } from "@/models/Transaction";

export async function GET() {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const transactions = await Transaction.find({ userId: authUser.userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load transactions" }, { status: 500 });
  }
}
