import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Plan } from "@/models/Plan";
import { Membership } from "@/models/Membership";

const schema = z.object({
  planId: z.string(),
  durationLabel: z.string(),
});

export async function POST(request: Request) {
  await connectDB();

  const authUser = await getAuthUser();

  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await User.findById(authUser.userId);
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 401 });
  }

  const body = await request.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.flatten() },
      { status: 400 }
    );
  }

  const { planId, durationLabel } = result.data;

  const plan = await Plan.findById(planId);

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  const duration = plan.durations.find(
    (item: any) => item.label === durationLabel
  );

  if (!duration) {
    return NextResponse.json(
      { message: "Invalid duration selected" },
      { status: 400 }
    );
  }

  const membership = await Membership.create({
    userId: authUser.userId,
    planId: plan._id,
    gameId: plan.gameId,
    gameName: plan.gameName,
    membershipType: plan.type,
    durationLabel: duration.label,
    months: duration.months,
    price: duration.discountedPrice,
    originalPrice: duration.originalPrice,
    status: "DRAFT",
    paymentStatus: "PENDING",
  });

  return NextResponse.json(
    {
      message: "Membership draft created",
      membership,
    },
    { status: 201 }
  );
}