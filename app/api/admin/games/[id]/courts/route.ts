import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Court } from "@/models/court";
import { Game } from "@/models/Game";
import { CourtBlock } from "@/models/CourtBlock";

const schema = z.object({
  name: z.string().min(1),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { id } = await params;

  const courts = await Court.find({ gameId: id }).sort({ createdAt: 1 }).lean();

  const courtIds = courts.map((c) => c._id);
  const blocks = await CourtBlock.find({
    courtId: { $in: courtIds },
    status: { $in: ["ACTIVE", "SCHEDULED"] },
  })
    .sort({ blockedFrom: 1 })
    .lean();

  const courtsWithBlocks = courts.map((court) => ({
    ...court,
    blocks: blocks.filter((b) => b.courtId.toString() === court._id.toString()),
  }));

  return NextResponse.json({ courts: courtsWithBlocks });
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

  const game = await Game.findById(id);

  if (!game) {
    return NextResponse.json({ message: "Game not found" }, { status: 404 });
  }

  const court = await Court.create({
    gameId: id,
    name: result.data.name,
  });

  return NextResponse.json({ message: "Court created", court }, { status: 201 });
}