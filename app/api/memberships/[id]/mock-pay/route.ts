import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";
import { Transaction } from "@/models/Transaction";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const authUser = await getAuthUser();

  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await User.findById(authUser.userId);
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 401 });
  }

  const { id } = await params;

  const membership = await Membership.findOne({
    _id: id,
    userId: authUser.userId,
  });

  if (!membership) {
    return NextResponse.json(
      { message: "Membership not found" },
      { status: 404 }
    );
  }

  if (!membership.termsAccepted) {
    return NextResponse.json(
      { message: "Terms must be accepted before payment" },
      { status: 400 }
    );
  }

  membership.status = "ACTIVE";
  membership.paymentStatus = "PAID";

  await membership.save();

  await Transaction.create({
    userId: authUser.userId,
    type: "PLAN_PURCHASE",
    amount: membership.price,
    note: `${membership.gameName} membership purchased`,
  });

  return NextResponse.json({
    message: "Payment successful",
    membership,
  });
}