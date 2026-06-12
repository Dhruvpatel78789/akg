import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const admin = await requireAdmin("visitorCoins", "addCoins", true);
    if (admin.error) return admin.error;

    const { id } = await params;
    const body = await req.json();
    const { action, amount, reason } = body;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, message: "Visitor not found" }, { status: 404 });
    }

    if (action === "ADD") {
      const adjustmentAmount = Number(amount || 0);
      user.rewardCoins = (user.rewardCoins || 0) + adjustmentAmount;
      await user.save();

      await Transaction.create({
        userId: user._id,
        type: "COINS_ADJUSTMENT",
        amount: 0,
        coins: adjustmentAmount,
        note: `Visitor Reward Coins added: ${adjustmentAmount}. Reason: ${reason || "None specified"}`,
      });

      return NextResponse.json({ success: true, message: `${adjustmentAmount} reward coins added`, user });
    } else if (action === "DEDUCT") {
      const adjustmentAmount = Number(amount || 0);
      user.rewardCoins = Math.max(0, (user.rewardCoins || 0) - adjustmentAmount);
      await user.save();

      await Transaction.create({
        userId: user._id,
        type: "COINS_ADJUSTMENT",
        amount: 0,
        coins: -adjustmentAmount,
        note: `Visitor Reward Coins deducted: ${adjustmentAmount}. Reason: ${reason || "None specified"}`,
      });

      return NextResponse.json({ success: true, message: `${adjustmentAmount} reward coins deducted`, user });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
