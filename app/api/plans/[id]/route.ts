import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Plan } from "@/models/Plan";
import { Game } from "@/models/Game";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { id } = await params;

  const plan = await Plan.findOne({
    _id: id,
    active: true,
    softDeleted: false,
  }).lean();

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  const game = plan.gameId
    ? await Game.findById(plan.gameId)
        .select("name duration maximumDuration")
        .lean()
    : null;

  return NextResponse.json({
    plan: {
      ...plan,
      game,
    },
  });
}