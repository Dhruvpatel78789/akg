import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";

export async function GET() {
  try {
    await connectDB();
    const games = await Game.find({ active: { $ne: false } }).sort({ name: 1 }).lean();
    return NextResponse.json(
      { success: true, games },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: any) {
    console.error("Games error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
