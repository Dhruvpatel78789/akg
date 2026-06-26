import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
import mongoose from "mongoose";
import {
  parseDateTime,
  calculateBasePrice,
  checkCourtAvailability,
  getAlternativeSlots,
} from "@/lib/availability";

// Re-export for compatibility with other files (e.g. app/api/voice/booking-tool/route.ts)
export { checkCourtAvailability };

const inputSchema = z.object({
  gameId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: "Invalid gameId format",
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  playersCount: z.number().int().min(1),
});

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const parsed = inputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid input", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { gameId, date, startTime, playersCount } = parsed.data;

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ success: false, message: "Game not found" }, { status: 404 });
    }

    if (game.fixedSlotBooking) {
      const { validateFixedSlot } = await import("@/lib/fixed-slots");
      if (!validateFixedSlot(startTime, game.duration)) {
        return NextResponse.json({
          available: false,
          message: "This game only allows fixed slot bookings. Please select a valid slot time.",
          suggestedSlots: []
        }, { status: 400 });
      }
    }

    // Base duration in minutes from Game model
    const duration = game.duration || 60;

    // Calculate End Time
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor(totalMinutes / 60) % 24;
    const em = totalMinutes % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    const crossMidnight = totalMinutes >= 1440;

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

    if (start.getTime() < Date.now() - 5 * 60 * 1000) {
      return NextResponse.json({
        available: false,
        message: "Cannot check/book a slot in the past.",
        suggestedSlots: [],
      }, { status: 400 });
    }

    // Find Pricing Rule
    const rule = await PricingRule.findOne({
      gameId: new mongoose.Types.ObjectId(gameId),
      active: true,
      minPlayers: { $lte: playersCount },
      maxPlayers: { $gte: playersCount },
      durationMinutes: duration,
    }).lean();

    if (!rule) {
      return NextResponse.json({
        available: false,
        message: `No pricing rule configured for ${playersCount} player(s) and ${duration} minutes.`,
        suggestedSlots: [],
      }, { status: 400 });
    }

    const price = calculateBasePrice(rule, playersCount);

    // Check availability
    const avail = await checkCourtAvailability(gameId, start, end);
    if (!avail.available) {
      const suggestedSlots = await getAlternativeSlots(gameId, date, startTime, duration, playersCount);
      return NextResponse.json({
        available: false,
        reason: avail.reason || "All courts are fully booked or blocked for this slot",
        price,
        gameId,
        gameName: game.name,
        date,
        startTime,
        endTime,
        suggestedSlots,
      });
    }

    return NextResponse.json({
      available: true,
      game,
      price,
      startTime,
      endTime,
      suggestedSlots: [],
    });
  } catch (error: any) {
    console.error("Availability check failed:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
