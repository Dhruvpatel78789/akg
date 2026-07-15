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
  const courts = await Court.find({ gameId, active: true }).lean();
  if (courts.length === 0) {
    return { available: false, reason: "No courts configured for this game" };
  }

  // Include pending bookings that are created within the last 10 minutes (reserved slots)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const overlappingBookings = await Booking.find({
    status: { $in: ["BOOKED", "STARTED"] },
    softDeleted: false,
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart },
    $or: [
      { paymentStatus: "PAID" },
      { paymentMethod: "PAY_AT_COUNTER" },
      { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } }
    ]
  }).lean();

  const overlappingBlocks = await CourtBlock.find({
    status: { $in: ["ACTIVE", "SCHEDULED"] },
    $or: [
      { blockedFrom: { $lt: bookingEnd }, blockedTo: { $gt: bookingStart } }
    ]
  }).lean();

  for (const court of courts) {
    const isBooked = overlappingBookings.some((b) => b.court?.trim().toLowerCase() === court.name.trim().toLowerCase());
    const isBlocked = overlappingBlocks.some((bl) => bl.courtId.toString() === court._id.toString());

    if (!isBooked && !isBlocked) {
      return { available: true, courtName: court.name };
    }
  }

  return { available: false, reason: "All courts are fully booked or blocked for the selected slot" };
}

import { parseIST } from "@/lib/time";

function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  return parseIST(dateStr, timeStr, addDays);
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
    const { name, phone, email, dob, gameId, date, startTime, durationMinutes, playersCount, paymentMethod } = body;

    if (!name || !phone || !gameId || !date || !startTime || !durationMinutes) {
      return NextResponse.json({ message: "Missing required visitor booking details" }, { status: 400 });
    }

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ message: "Game not found" }, { status: 404 });
    }

    if (game.fixedSlotBooking) {
      const { validateFixedSlot } = await import("@/lib/fixed-slots");
      if (!validateFixedSlot(startTime, game.duration)) {
        return NextResponse.json({
          message: "This game only allows fixed slot bookings. Please select a valid slot time."
        }, { status: 400 });
      }
    }

    const userCourt = body.court; // optional chosen court

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

    // Strict validation: selectedStartTime >= currentServerTime (using server timestamp)
    if (start.getTime() < Date.now() - 2 * 60 * 1000) {
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

    // Find or create Player User
    let user = await User.findOne({
      $or: [
        { phone },
        ...(email ? [{ email }] : [])
      ]
    });

    const bcrypt = await import("bcryptjs");

    if (!user) {
      const uniqueEmail = email || `${phone}@visitor.akshargamezone.com`;
      const existingEmail = await User.findOne({ email: uniqueEmail });
      const finalEmail = existingEmail ? `${phone}_${Date.now()}@visitor.akshargamezone.com` : uniqueEmail;

      const passwordHash = await bcrypt.hash("NEW1234", 10);

      user = await User.create({
        name,
        phone,
        email: finalEmail,
        dob: dob ? new Date(dob) : undefined,
        role: "PLAYER",
        passwordHash,
        mustChangePassword: true,
        accountSource: "VISITOR_BOOKING"
      });
    } else {
      // If user exists and is a VISITOR, promote to PLAYER
      if (user.role === "VISITOR") {
        user.role = "PLAYER";
        user.mustChangePassword = true;
        user.accountSource = "VISITOR_BOOKING";
        user.passwordHash = await bcrypt.hash("NEW1234", 10);
      }

      let updated = false;
      if (email && (!user.email || user.email.includes("@visitor."))) {
        user.email = email;
        updated = true;
      }
      if (dob && !user.dob) {
        user.dob = new Date(dob);
        updated = true;
      }
      await user.save();
    }

    // Check slot availability
    const { checkCourtsStatus } = await import("@/lib/availability");
    const courtsStatus = await checkCourtsStatus(gameId, start, end);

    let finalCourt = "";
    if (game.allowCourtSelection && userCourt) {
      const selectedStatus = courtsStatus.find(c => c.courtName.trim().toLowerCase() === userCourt.trim().toLowerCase());
      if (!selectedStatus || selectedStatus.status !== "Available") {
        return NextResponse.json({
          available: false,
          message: "This court was just booked by another player. Please select another court or time."
        }, { status: 409 });
      }
      finalCourt = userCourt;
    } else {
      const firstAvailable = courtsStatus.find(c => c.status === "Available");
      if (!firstAvailable) {
        return NextResponse.json({
          available: false,
          message: "This slot is no longer available. Please select another court or time."
        }, { status: 409 });
      }
      finalCourt = firstAvailable.courtName;
    }

    // Register checkout hold for online payments
    if (paymentMethod !== "PAY_AT_COUNTER") {
      const { CourtHold } = await import("@/models/CourtHold");
      const { Court } = await import("@/models/court");
      const courtDoc = await Court.findOne({ gameId, name: { $regex: new RegExp(`^\\s*${finalCourt.trim()}\\s*$`, "i") } });
      if (courtDoc) {
        await CourtHold.create({
          courtId: courtDoc._id,
          startTime: start,
          endTime: end,
          holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes hold
          status: "HELD",
          userId: user._id,
        });
      }
    }

    const { calculateBestDiscount } = await import("@/lib/offers");
    const discountsResult = await calculateBestDiscount(
      price,
      gameId,
      date,
      startTime,
      undefined,
      user._id
    );
    const expectedPrice = discountsResult.payableAmount;
    const appliedPromotions = discountsResult.appliedPromotions;

    const intentCreatedAt = new Date();
    const intentExpiresAt = new Date(intentCreatedAt.getTime() + 10 * 60 * 1000);

    // Create Draft/Pending Booking
    const booking = await Booking.create({
      userId: user._id,
      gameId: game._id,
      gameName: game.name,
      court: finalCourt,
      startTime: start,
      endTime: end,
      subtotal: price,
      price: expectedPrice,
      appliedPromotions: appliedPromotions as any,
      coinCost: 0,
      playersCount: count,
      crossMidnight,
      playerType: "VISITOR",
      paymentMode: paymentMethod === "PAY_AT_COUNTER" ? "cash" : "online",
      paymentMethod: paymentMethod || "RAZORPAY",
      paymentStatus: "PENDING",
      status: "BOOKED",
      intentCreatedAt,
      intentExpiresAt,
    });

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
    });

    const response = NextResponse.json({ success: true, booking, amount: expectedPrice, name: user.name });
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
