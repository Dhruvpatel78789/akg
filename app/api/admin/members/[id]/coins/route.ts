import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const { action, amount, reason } = body;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    if (action === "FREEZE") {
      const available = user.coinsAvailable || 0;
      user.coinsFrozen = (user.coinsFrozen || 0) + available;
      user.coinsAvailable = 0;
      user.coins = 0;
      user.coinsFrozenReason = reason || "Frozen by administrator";
      user.coinsFrozenAt = new Date();
      await user.save();

      return NextResponse.json({ success: true, message: "Member coins frozen successfully", user });
    } else if (action === "UNFREEZE") {
      const frozen = user.coinsFrozen || 0;
      user.coinsAvailable = (user.coinsAvailable || 0) + frozen;
      user.coinsFrozen = 0;
      user.coins = user.coinsAvailable;
      user.coinsFrozenReason = "";
      user.coinsFrozenAt = undefined;
      await user.save();

      return NextResponse.json({ success: true, message: "Member coins unfrozen successfully", user });
    } else if (action === "ADD") {
      const adjustmentAmount = Number(amount || 0);
      user.coinsAvailable = (user.coinsAvailable || 0) + adjustmentAmount;
      user.coins = user.coinsAvailable;
      await user.save();

      await Transaction.create({
        userId: user._id,
        type: "COINS_ADJUSTMENT",
        amount: 0,
        coins: adjustmentAmount,
        note: `Admin adjustment: added ${adjustmentAmount} coins. Reason: ${reason || "None specified"}`,
      });

      return NextResponse.json({ success: true, message: `${adjustmentAmount} coins added to wallet`, user });
    } else if (action === "DEDUCT") {
      const adjustmentAmount = Number(amount || 0);
      user.coinsAvailable = Math.max(0, (user.coinsAvailable || 0) - adjustmentAmount);
      user.coins = user.coinsAvailable;
      await user.save();

      await Transaction.create({
        userId: user._id,
        type: "COINS_ADJUSTMENT",
        amount: 0,
        coins: -adjustmentAmount,
        note: `Admin adjustment: deducted ${adjustmentAmount} coins. Reason: ${reason || "None specified"}`,
      });

      return NextResponse.json({ success: true, message: `${adjustmentAmount} coins deducted from wallet`, user });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
