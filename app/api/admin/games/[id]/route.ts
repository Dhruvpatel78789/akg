import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Game } from "@/models/Game";

const schema = z.object({
  name: z.string().min(2).optional(),
  duration: z.number().min(1).optional(),
  maximumDuration: z.number().min(1).optional(),
  active: z.boolean().optional(),
  bufferMinutes: z.number().min(0).optional(),
  fixedSlotBooking: z.boolean().optional(),
});

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

  const game = await Game.findByIdAndUpdate(id, result.data, { new: true });

  if (!game) {
    return NextResponse.json({ message: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Game updated", game });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;

  const game = await Game.findByIdAndUpdate(
    id,
    { active: false },
    { new: true }
  );

  if (!game) {
    return NextResponse.json({ message: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Game disabled", game });
}