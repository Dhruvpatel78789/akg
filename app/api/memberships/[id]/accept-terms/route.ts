import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";

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

  membership.termsAccepted = true;
  membership.termsAcceptedAt = new Date();
  membership.status = "PENDING_PAYMENT";

  await membership.save();

  return NextResponse.json({
    message: "Terms accepted",
    membership,
  });
}