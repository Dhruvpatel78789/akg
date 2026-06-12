import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
import { Court } from "@/models/court";
import { CourtBlock } from "@/models/CourtBlock";
import mongoose from "mongoose";
import { signToken } from "@/lib/auth";

async function checkAvailability(gameId: string, bookingStart: Date, bookingEnd: Date) {
  const courts = await Court.find({ gameId, active: true, disabled: false }).lean();
  if (courts.length === 0) {
    return { available: false, reason: "No courts configured for this game" };
  }

  // Include pending bookings that are created within the last 10 minutes (reserved slots)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const overlappingBookings = await Booking.find({
    gameId,
    status: { $in: ["BOOKED", "STARTED"] },
    softDeleted: false,
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart },
    $or: [
      { paymentStatus: "PAID" },
      { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } }
    ]
  }).lean();

  const overlappingBlocks = await CourtBlock.find({
    gameId,
    status: { $in: ["ACTIVE", "SCHEDULED"] },
    $or: [
      { blockedFrom: { $lt: bookingEnd }, blockedTo: { $gt: bookingStart } }
    ]
  }).lean();

  for (const court of courts) {
    const isBooked = overlappingBookings.some((b) => b.court === court.name);
    const isBlocked = overlappingBlocks.some((bl) => bl.courtId.toString() === court._id.toString());

    if (!isBooked && !isBlocked) {
      return { available: true, courtName: court.name };
    }
  }

  return { available: false, reason: "All courts are fully booked or blocked for the selected slot" };
}

function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (addDays > 0) {
    date.setDate(date.getDate() + addDays);
  }
  return date;
}

function calculateBasePrice(rule: any, playersIncluded: number) {
  if (rule.mode === "PER_PLAYER") {
    return playersIncluded * rule.pricePerPlayer;
  }
  return rule.baseCourtPrice + playersIncluded * rule.pricePerPlayer;
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, phone, email, dob, gameId, date, startTime, durationMinutes, playersCount } = body;

    if (!name || !phone || !gameId || !date || !startTime || !durationMinutes) {
      return NextResponse.json({ message: "Missing required visitor booking details" }, { status: 400 });
    }

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ message: "Game not found" }, { status: 404 });
    }

    // Calculate End Time
    const duration = Number(durationMinutes);
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
    const em = totalMinutes % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

    if (start.getTime() < Date.now() - 3 * 60 * 1000) {
      return NextResponse.json({ message: "Cannot book a slot in the past. Please select a future date and time." }, { status: 400 });
    }

    // Pricing Rule
    const count = Number(playersCount || 1);
    const rule = await PricingRule.findOne({
      gameId: new mongoose.Types.ObjectId(gameId),
      active: true,
      minPlayers: { $lte: count },
      maxPlayers: { $gte: count },
      durationMinutes: duration,
    });

    if (!rule) {
      return NextResponse.json({
        message: `No pricing rule configured for ${count} player(s) and ${duration} minutes.`
      }, { status: 400 });
    }

    const price = calculateBasePrice(rule, count);

    // Find or create Visitor User
    let user = await User.findOne({ phone });
    if (!user) {
      const uniqueEmail = email || `${phone}@visitor.akshargamezone.com`;
      // Check if email already registered to someone else
      const existingEmail = await User.findOne({ email: uniqueEmail });
      const finalEmail = existingEmail ? `${phone}_${Date.now()}@visitor.akshargamezone.com` : uniqueEmail;

      user = await User.create({
        name,
        phone,
        email: finalEmail,
        dob: dob ? new Date(dob) : undefined,
        role: "VISITOR",
        passwordHash: "visitor_dummy_password_hash",
      });
    } else {
      // Update email or DOB if provided and not set
      let updated = false;
      if (email && (!user.email || user.email.includes("@visitor."))) {
        user.email = email;
        updated = true;
      }
      if (dob && !user.dob) {
        user.dob = new Date(dob);
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    // Check slot availability
    const avail = await checkAvailability(gameId, start, end);
    if (!avail.available) {
      return NextResponse.json({ message: avail.reason || "Slot is not available" }, { status: 409 });
    }

    // Create Draft/Pending Booking
    const booking = await Booking.create({
      userId: user._id,
      gameId: game._id,
      gameName: game.name,
      court: avail.courtName,
      startTime: start,
      endTime: end,
      price,
      coinCost: 0,
      playersCount: count,
      crossMidnight,
      playerType: "VISITOR",
      paymentMode: "online",
      paymentStatus: "PENDING",
      status: "BOOKED",
    });

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = NextResponse.json({ success: true, booking, amount: price, name: user.name });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Visitor booking failed" }, { status: 500 });
  }
}
