import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { PricingRule } from "@/models/PricingRule";

const schema = z.object({
  playersIncluded: z.coerce.number().min(1),
  months: z.coerce.number().min(0).default(0),
  days: z.coerce.number().min(0).default(0),
});

function calculateDailyPrice(rule: any, playersIncluded: number) {
  if (rule.mode === "PER_PLAYER") {
    return playersIncluded * rule.pricePerPlayer;
  }

  return rule.baseCourtPrice + playersIncluded * rule.pricePerPlayer;
}

function calculateTotalDays(months: number, days: number) {
  return months * 30 + days;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { id } = await params;
  const body = await request.json();

  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid pricing preview input" },
      { status: 400 }
    );
  }

  const { playersIncluded, months, days } = result.data;
  const totalDays = calculateTotalDays(months, days);

  if (totalDays <= 0) {
    return NextResponse.json(
      { message: "Duration must have at least 1 day or 1 month" },
      { status: 400 }
    );
  }

  const rule = await PricingRule.findOne({
    gameId: id,
    active: true,
    minPlayers: { $lte: playersIncluded },
    maxPlayers: { $gte: playersIncluded },
  }).lean();

  if (!rule) {
    return NextResponse.json(
      {
        message: `No pricing rule found for ${playersIncluded} player(s). Create pricing rule first.`,
        price: null,
        rule: null,
      },
      { status: 404 }
    );
  }

  const dailyPrice = calculateDailyPrice(rule, playersIncluded);
  const price = dailyPrice * totalDays;

  return NextResponse.json({
    price,
    rule,
  });
}