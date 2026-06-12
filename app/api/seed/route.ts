import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { SessionEntry } from "@/models/SessionEntry";
import { Game } from "@/models/Game";
import { User } from "@/models/User";

export async function GET() {
  await connectDB();

  // Find or create a default game
  let game = await Game.findOne();
  if (!game) {
    game = await Game.create({
      name: "Badminton",
      duration: 60, // min unit duration
      maximumDuration: 180, // max duration
      bufferMinutes: 10,
      active: true,
    });
  }

  // Find or create a default player user
  let user = await User.findOne({ role: "PLAYER" });
  if (!user) {
    user = await User.create({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "1234567890",
      role: "PLAYER",
      coins: 500,
    });
  }

  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  // 1. Create a regular booking that satisfies auto-end
  // Started 5 hours ago, booked duration 60 mins. Exceeds maxDuration (180m) + unit duration (60m) = 240 mins.
  const booking = await Booking.create({
    userId: user._id,
    gameId: game._id,
    gameName: game.name,
    court: "Court 1",
    startTime: fiveHoursAgo,
    endTime: fourHoursAgo,
    status: "STARTED",
    coinCost: 50,
    price: 0,
    playersCount: 1,
    playerType: "MEMBER",
    paymentMode: "coins",
    paymentStatus: "PAID",
  });

  // 2. Create a corporate/visitor session entry that satisfies auto-end
  // Started 5 hours ago. Exceeds 180m + 60m.
  const sessionEntry = await SessionEntry.create({
    bookingId: booking._id,
    bookingGroupId: `group_${Date.now()}`,
    userType: "PLAYER",
    userId: user._id,
    playerName: "John Doe",
    mobile: "1234567890",
    gameId: game._id,
    gameName: game.name,
    court: "Court 1",
    startTime: fiveHoursAgo,
    endTime: fourHoursAgo,
    bookedDurationMinutes: 60,
    status: "STARTED",
  });

  return NextResponse.json({
    success: true,
    message: "Ongoing sessions satisfying auto-end seeded successfully",
    booking: {
      id: booking._id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    },
    sessionEntry: {
      id: sessionEntry._id,
      startTime: sessionEntry.startTime,
      endTime: sessionEntry.endTime,
      status: sessionEntry.status,
    },
  });
}