import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";
import { parseDateTime, checkCourtsStatus } from "@/lib/availability";

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { gameId, date, startTime, duration } = body;

    if (!gameId || !date || !startTime) {
      return NextResponse.json({ success: false, message: "Missing required parameters" }, { status: 400 });
    }

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ success: false, message: "Game not found" }, { status: 404 });
    }

    const finalDuration = duration || game.duration || 60;

    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + finalDuration;
    const eh = Math.floor(totalMinutes / 60) % 24;
    const em = totalMinutes % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    const crossMidnight = totalMinutes >= 1440;

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

    const courts = await checkCourtsStatus(gameId, start, end);

    return NextResponse.json({
      success: true,
      courts,
    });
  } catch (error: any) {
    console.error("Courts status check error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
