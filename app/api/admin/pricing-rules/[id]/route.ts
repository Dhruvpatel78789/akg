import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { PricingRule } from "@/models/PricingRule";

const schema = z.object({
  minPlayers: z.number().min(1).optional(),
  maxPlayers: z.number().min(1).optional(),
  mode: z.enum(["PER_PLAYER", "COURT_BASE_PLUS_PLAYER"]).optional(),
  baseCourtPrice: z.number().min(0).optional(),
  pricePerPlayer: z.number().min(0).optional(),
});

function hasOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMin <= bMax && bMin <= aMax;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;
  const body = await request.json();

  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existingRule = await PricingRule.findById(id);

  if (!existingRule) {
    return NextResponse.json({ message: "Rule not found" }, { status: 404 });
  }

  const nextRule = {
    minPlayers: result.data.minPlayers ?? existingRule.minPlayers,
    maxPlayers: result.data.maxPlayers ?? existingRule.maxPlayers,
    durationMinutes: existingRule.durationMinutes,
  };

  if (nextRule.minPlayers > nextRule.maxPlayers) {
    return NextResponse.json(
      { message: "Minimum players cannot be greater than maximum players" },
      { status: 400 }
    );
  }

  const otherRules = await PricingRule.find({
    _id: { $ne: id },
    gameId: existingRule.gameId,
    durationMinutes: nextRule.durationMinutes,
    active: true,
  }).lean();

  const conflict = otherRules.find((rule) =>
    hasOverlap(
      nextRule.minPlayers,
      nextRule.maxPlayers,
      rule.minPlayers,
      rule.maxPlayers
    )
  );

  if (conflict) {
    return NextResponse.json(
      {
        message: `Pricing rule conflicts with existing range ${conflict.minPlayers}-${conflict.maxPlayers}`,
      },
      { status: 409 }
    );
  }

  const rule = await PricingRule.findByIdAndUpdate(id, result.data, {
    new: true,
  });

  return NextResponse.json({ message: "Pricing rule updated", rule });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;

  const rule = await PricingRule.findByIdAndUpdate(
    id,
    { active: false },
    { new: true }
  );

  if (!rule) {
    return NextResponse.json({ message: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Pricing rule disabled", rule });
}