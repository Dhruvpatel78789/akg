import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";

export async function GET() {
  await connectDB();
  const games = await Game.find({ active: { $ne: false } }).sort({ name: 1 }).lean();
  return NextResponse.json({ success: true, games });
}
