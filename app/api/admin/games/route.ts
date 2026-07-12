import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Game } from "@/models/Game";

const gameSchema = z.object({
  name: z.string().min(2),
  duration: z.number().min(1),
  maximumDuration: z.number().min(1),
  bufferMinutes: z.number().min(0).default(0),
  fixedSlotBooking: z.boolean().optional(),
  allowCourtSelection: z.boolean().optional(),
  blockedGameIds: z.array(z.string()).optional(),
});

export async function GET() {
  await connectDB();

  const games = await Game.find().sort({ createdAt: -1 }).lean();

  return NextResponse.json({ games });
}

export async function POST(request: Request) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const body = await request.json();
  const result = gameSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const game = await Game.create(result.data);

  return NextResponse.json({ message: "Game created", game }, { status: 201 });
}