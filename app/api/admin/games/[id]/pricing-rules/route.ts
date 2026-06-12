import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { PricingRule } from "@/models/PricingRule";
import { Game } from "@/models/Game";

const schema = z.object({
  minPlayers: z.coerce.number().min(1),
  maxPlayers: z.coerce.number().min(1),
  durationMinutes: z.coerce.number().min(1),
  mode: z.enum(["PER_PLAYER", "COURT_BASE_PLUS_PLAYER"]),
  baseCourtPrice: z.coerce.number().min(0).default(0),
  pricePerPlayer: z.coerce.number().min(0),
});

function hasOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMin <= bMax && bMin <= aMax;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { id } = await params;

  const rules = await PricingRule.find({
    gameId: id,
    active: true,
  })
    .sort({ durationMinutes: 1, minPlayers: 1 })
    .lean();

  return NextResponse.json({ rules });
}

export async function POST(
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

  const data = result.data;

  if (data.minPlayers > data.maxPlayers) {
    return NextResponse.json(
      { message: "Minimum players cannot be greater than maximum players" },
      { status: 400 }
    );
  }

  const game = await Game.findById(id);

  if (!game) {
    return NextResponse.json({ message: "Game not found" }, { status: 404 });
  }

  if (data.durationMinutes < game.duration) {
    return NextResponse.json(
      {
        message: `Duration must be at least ${game.duration} minutes`,
      },
      { status: 400 }
    );
  }

  if (data.durationMinutes > game.maximumDuration) {
    return NextResponse.json(
      {
        message: `Duration cannot exceed ${game.maximumDuration} minutes`,
      },
      { status: 400 }
    );
  }

  if (data.durationMinutes % game.duration !== 0) {
    return NextResponse.json(
      {
        message: `Duration must be in multiples of ${game.duration} minutes`,
      },
      { status: 400 }
    );
  }

  const existingRules = await PricingRule.find({
    gameId: id,
    active: true,
    durationMinutes: data.durationMinutes,
  }).lean();

  const conflictingRule = existingRules.find((rule) =>
    hasOverlap(
      data.minPlayers,
      data.maxPlayers,
      rule.minPlayers,
      rule.maxPlayers
    )
  );

  if (conflictingRule) {
    return NextResponse.json(
      {
        message: `Conflict: ${conflictingRule.minPlayers}-${conflictingRule.maxPlayers} players already exists for ${data.durationMinutes} minutes`,
      },
      { status: 409 }
    );
  }

  const rule = await PricingRule.create({
    gameId: id,
    minPlayers: data.minPlayers,
    maxPlayers: data.maxPlayers,
    durationMinutes: data.durationMinutes,
    mode: data.mode,
    baseCourtPrice: data.baseCourtPrice,
    pricePerPlayer: data.pricePerPlayer,
    active: true,
  });

  return NextResponse.json(
    { message: "Pricing rule created", rule },
    { status: 201 }
  );
}