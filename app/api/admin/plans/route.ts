import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Plan } from "@/models/Plan";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";

const durationSchema = z.object({
  label: z.string().min(1),
  months: z.coerce.number().min(0).default(0),
  days: z.coerce.number().min(0).default(0),
  playersIncluded: z.coerce.number().min(1),
  discountType: z.enum(["PERCENTAGE", "FLAT"]),
  discountValue: z.coerce.number().min(0),
});

const planSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["FIXED", "COINS"]),

  gameId: z.string().optional(),
  allowUserTimeSelection: z.boolean().optional(),
  adminStartTime: z.string().optional(),
  adminEndTime: z.string().optional(),
  durations: z.array(durationSchema).optional(),

  coinsAmount: z.number().min(1).optional(),
  bonusCoins: z.number().min(0).optional(),
  price: z.number().min(1).optional(),
  dailyCoinSpendLimit: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

function calculateBasePrice(rule: any, playersIncluded: number) {
  if (rule.mode === "PER_PLAYER") {
    return playersIncluded * rule.pricePerPlayer;
  }

  return rule.baseCourtPrice + playersIncluded * rule.pricePerPlayer;
}

function calculateTotalDays(months: number, days: number) {
  return months * 30 + days;
}

function calculateFinalPrice(
  originalPrice: number,
  discountType: "PERCENTAGE" | "FLAT",
  discountValue: number
) {
  if (discountType === "PERCENTAGE") {
    return Math.max(0, originalPrice - (originalPrice * discountValue) / 100);
  }

  return Math.max(0, originalPrice - discountValue);
}

async function getPricingForPlayers(gameId: string, playersIncluded: number) {
  return PricingRule.findOne({
    gameId,
    active: true,
    minPlayers: { $lte: playersIncluded },
    maxPlayers: { $gte: playersIncluded },
  });
}

export async function GET() {
  await connectDB();

  const plans = await Plan.find({ softDeleted: false })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const body = await request.json();
  const result = planSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = result.data;

  if (data.type === "FIXED") {
    if (!data.gameId) {
      return NextResponse.json(
        { message: "Game is required for fixed plan" },
        { status: 400 }
      );
    }

    if (!data.durations || data.durations.length === 0) {
      return NextResponse.json(
        { message: "At least one duration option is required" },
        { status: 400 }
      );
    }

    const normalizedDurations = data.durations.map((duration) => ({
  ...duration,
  totalDays: calculateTotalDays(duration.months, duration.days),
}));

const invalidDuration = normalizedDurations.find(
  (duration) => duration.totalDays <= 0
);

if (invalidDuration) {
  return NextResponse.json(
    { message: "Duration must have at least 1 day or 1 month" },
    { status: 400 }
  );
}

const duplicateDuration = normalizedDurations.find(
  (duration, index) =>
    normalizedDurations.findIndex(
      (item) => item.totalDays === duration.totalDays
    ) !== index
);

if (duplicateDuration) {
  return NextResponse.json(
    { message: `Duplicate duration found: ${duplicateDuration.totalDays} days` },
    { status: 409 }
  );
}

    if (data.allowUserTimeSelection === false) {
      if (!data.adminStartTime || !data.adminEndTime) {
        return NextResponse.json(
          { message: "Admin start and end time are required" },
          { status: 400 }
        );
      }
    }

    const game = await Game.findById(data.gameId);

    if (!game) {
      return NextResponse.json({ message: "Game not found" }, { status: 404 });
    }

    const durations = [];

    for (const duration of normalizedDurations) {
  const pricingRule = await getPricingForPlayers(
    data.gameId,
    duration.playersIncluded
  );

  if (!pricingRule) {
    return NextResponse.json(
      {
        message: `No pricing rule found for ${duration.playersIncluded} player(s). First create pricing for this player count in Game Pricing Rules.`,
      },
      { status: 409 }
    );
  }

  const dailyPrice = calculateBasePrice(pricingRule, duration.playersIncluded);
  const originalPrice = dailyPrice * duration.totalDays;

  durations.push({
    ...duration,
    pricingRuleId: pricingRule._id,
    originalPrice,
    finalPrice: calculateFinalPrice(
      originalPrice,
      duration.discountType,
      duration.discountValue
    ),
  });
}

    const plan = await Plan.create({
      name: data.name,
      type: "FIXED",
      gameId: game._id,
      gameName: game.name,
      allowUserTimeSelection: data.allowUserTimeSelection ?? true,
      adminStartTime: data.adminStartTime,
      adminEndTime: data.adminEndTime,
      durations,
      active: data.active ?? true,
    });

    return NextResponse.json({ message: "Plan created", plan }, { status: 201 });
  }

  if (data.type === "COINS") {
    if (!data.coinsAmount || !data.price) {
      return NextResponse.json(
        { message: "Coins amount and price are required" },
        { status: 400 }
      );
    }

    const plan = await Plan.create({
      name: data.name,
      type: "COINS",
      coinsAmount: data.coinsAmount,
      bonusCoins: data.bonusCoins ?? 0,
      price: data.price,
      dailyCoinSpendLimit: data.dailyCoinSpendLimit ?? 0,
      active: data.active ?? true,
    });

    return NextResponse.json({ message: "Plan created", plan }, { status: 201 });
  }

  return NextResponse.json({ message: "Invalid plan type" }, { status: 400 });
}