import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Game } from "@/models/Game";
import { Court } from "@/models/court";
import { CourtBlock } from "@/models/CourtBlock";
import { Booking } from "@/models/Booking";
import { Membership } from "@/models/Membership";
import { PricingRule } from "@/models/PricingRule";
import { Transaction } from "@/models/Transaction";
import { PaymentOrder } from "@/models/PaymentOrder";
import mongoose from "mongoose";

import { parseIST } from "@/lib/time";

function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  return parseIST(dateStr, timeStr, addDays);
}

function getDayBounds(dateStr: string) {
  const start = parseIST(dateStr, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  const endExtended = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, endExtended };
}

function calculateBasePrice(rule: any, playersIncluded: number) {
  if (rule.mode === "PER_PLAYER") {
    return playersIncluded * rule.pricePerPlayer;
  }
  return rule.baseCourtPrice + playersIncluded * rule.pricePerPlayer;
}

function getMinutes(start: string, end: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin < startMin) {
    endMin += 24 * 60; // Rolled over next day
  }
  return endMin - startMin;
}

async function checkAvailability(gameId: string, bookingStart: Date, bookingEnd: Date, excludeBookingId?: string) {
  const courts = await Court.find({ gameId, active: true, disabled: false }).lean();
  if (courts.length === 0) {
    return { available: false, reason: "No courts configured for this game" };
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const query: any = {
    gameId,
    status: { $in: ["BOOKED", "STARTED"] },
    softDeleted: false,
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart },
    $or: [
      { paymentStatus: "PAID" },
      { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  const overlappingBookings = await Booking.find(query).lean();

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

function checkFixedMembershipCoverage(membership: any, gameId: string, bookingStart: Date, bookingEnd: Date) {
  if (!membership || membership.status !== "ACTIVE" || membership.membershipType !== "FIXED") {
    return false;
  }

  if (membership.gameId.toString() !== gameId) {
    return false;
  }

  // Check validity dates
  const createdAt = new Date(membership.createdAt).getTime();
  const totalDays = membership.totalDays || membership.days || (membership.months ? membership.months * 30 : 0);
  const expiry = createdAt + totalDays * 24 * 60 * 60 * 1000;
  const bookingTime = bookingStart.getTime();

  if (bookingTime < createdAt || bookingTime > expiry) {
    return false;
  }

  // Check slot hours
  const mStart = new Date(membership.startTime);
  const mEnd = new Date(membership.endTime);

  return (
    mStart.getHours() === bookingStart.getHours() &&
    mStart.getMinutes() === bookingStart.getMinutes() &&
    mEnd.getHours() === bookingEnd.getHours() &&
    mEnd.getMinutes() === bookingEnd.getMinutes()
  );
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const date = searchParams.get("date"); // YYYY-MM-DD (optional)
    const startTime = searchParams.get("startTime"); // HH:MM (optional)
    let endTime = searchParams.get("endTime"); // HH:MM (optional)
    const durationMinutesStr = searchParams.get("durationMinutes");
    const playersCountStr = searchParams.get("playersCount");

    if (!gameId || !playersCountStr) {
      return NextResponse.json({ message: "Missing gameId or playersCount" }, { status: 400 });
    }

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ message: "Game not found" }, { status: 404 });
    }

    const playersCount = Number(playersCountStr);
    const durationMinutes = durationMinutesStr ? Number(durationMinutesStr) : (game.duration || 60);

    // Pricing Rule Lookup
    const rule = await PricingRule.findOne({
      gameId: new mongoose.Types.ObjectId(gameId),
      active: true,
      minPlayers: { $lte: playersCount },
      maxPlayers: { $gte: playersCount },
      durationMinutes,
    });

    if (!rule) {
      const allRulesForGame = await PricingRule.find({ gameId: new mongoose.Types.ObjectId(gameId) }).lean();
      console.warn("Pricing Rule Detection Failed on GET:", {
        gameId,
        playersCount,
        durationMinutes,
        allRulesForGame
      });

      const existsActive = allRulesForGame.some(r => r.active);
      const existsDuration = allRulesForGame.some(r => r.durationMinutes === durationMinutes);
      const existsPlayers = allRulesForGame.some(r => r.minPlayers <= playersCount && r.maxPlayers >= playersCount);

      let reason = `No pricing rule exists for ${playersCount} player(s) and ${durationMinutes} minutes.`;
      if (allRulesForGame.length === 0) {
        reason = `No pricing rules are configured for this game in the admin panel.`;
      } else if (!existsActive) {
        reason = `All pricing rules for this game are currently inactive.`;
      } else if (!existsDuration) {
        const availableDurations = Array.from(new Set(allRulesForGame.map(r => r.durationMinutes))).join(", ");
        reason = `No pricing rule matches the selected duration of ${durationMinutes} minutes (available rules are for: ${availableDurations || "none"} mins).`;
      } else if (!existsPlayers) {
        reason = `No pricing rule matches player count of ${playersCount} (configured player ranges: ${allRulesForGame.map(r => `${r.minPlayers}-${r.maxPlayers}`).join(", ")}).`;
      }

      return NextResponse.json({
        available: false,
        message: reason
      });
    }

    const cost = calculateBasePrice(rule, playersCount);

    // If date and startTime are provided, check availability
    if (date && startTime) {
      // Automatically calculate endTime if duration is provided but endTime is not
      if (!endTime && durationMinutesStr) {
        const duration = Number(durationMinutesStr);
        const [sh, sm] = startTime.split(":").map(Number);
        const totalMinutes = sh * 60 + sm + duration;
        const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
        const em = totalMinutes % 60;
        endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
      }

      if (!endTime) {
        return NextResponse.json({ message: "End time is required" }, { status: 400 });
      }

      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);

      const start = parseDateTime(date, startTime);
      const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

      if (start.getTime() < Date.now() - 5 * 60 * 1000) {
        return NextResponse.json({
          success: true,
          available: false,
          reason: "Cannot book a slot in the past. Please select a future date and time.",
          coinCost: cost,
          endTime,
        });
      }

      const avail = await checkAvailability(gameId, start, end);

      return NextResponse.json({
        success: true,
        available: avail.available,
        courtName: avail.courtName,
        coinCost: cost,
        reason: avail.reason,
        endTime,
        crossMidnight,
      });
    }

    // Otherwise return pricing only
    return NextResponse.json({
      success: true,
      available: null,
      coinCost: cost,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to check slot details" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized. Please login again." }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, gameId, date, startTime, playersCount, razorpayOrderId } = body;
    let { paymentSuccess, endTime } = body;

    if (razorpayOrderId) {
      const pOrder = await PaymentOrder.findOne({ razorpayOrderId });
      if (!pOrder || pOrder.status !== "PAID") {
        return NextResponse.json({ message: "Unverified Razorpay transaction. Please process payment first." }, { status: 400 });
      }
      paymentSuccess = true;
    }

    if (!gameId || !date || !startTime || !playersCount) {
      return NextResponse.json({ message: "Missing required booking details" }, { status: 400 });
    }

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ message: "Game not found" }, { status: 404 });
    }

    // Automatically calculate endTime if durationMinutes is provided but endTime is not
    if (!endTime && body.durationMinutes) {
      const duration = Number(body.durationMinutes);
      const [sh, sm] = startTime.split(":").map(Number);
      const totalMinutes = sh * 60 + sm + duration;
      const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
      const em = totalMinutes % 60;
      endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    }

    if (!endTime) {
      return NextResponse.json({ message: "End time is required" }, { status: 400 });
    }

    const count = Number(playersCount);
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const durationMinutes = getMinutes(startTime, endTime);
    if (durationMinutes <= 0) {
      return NextResponse.json({ message: "End time must be after start time" }, { status: 400 });
    }

    // Validate slot durations
    if (durationMinutes < game.duration || durationMinutes > game.maximumDuration) {
      return NextResponse.json({
        message: `Session duration must be between ${game.duration} and ${game.maximumDuration} minutes`
      }, { status: 400 });
    }

    if (durationMinutes % game.duration !== 0) {
      return NextResponse.json({
        message: `Session duration must be in multiples of ${game.duration} minutes`
      }, { status: 400 });
    }

    // Pricing Rule
    const rule = await PricingRule.findOne({
      gameId: new mongoose.Types.ObjectId(gameId),
      active: true,
      minPlayers: { $lte: count },
      maxPlayers: { $gte: count },
      durationMinutes,
    });

    if (!rule) {
      const allRulesForGame = await PricingRule.find({ gameId: new mongoose.Types.ObjectId(gameId) }).lean();
      console.warn("Pricing Rule Detection Failed on POST:", {
        gameId,
        playersCount: count,
        durationMinutes,
        allRulesForGame
      });

      const existsActive = allRulesForGame.some(r => r.active);
      const existsDuration = allRulesForGame.some(r => r.durationMinutes === durationMinutes);
      const existsPlayers = allRulesForGame.some(r => r.minPlayers <= count && r.maxPlayers >= count);

      let reason = `No pricing rule exists for ${count} player(s) and ${durationMinutes} minutes.`;
      if (allRulesForGame.length === 0) {
        reason = `No pricing rules are configured for this game.`;
      } else if (!existsActive) {
        reason = `All pricing rules for this game are currently inactive.`;
      } else if (!existsDuration) {
        const availableDurations = Array.from(new Set(allRulesForGame.map(r => r.durationMinutes))).join(", ");
        reason = `No pricing rule matches the selected duration of ${durationMinutes} minutes (available rule durations are: ${availableDurations || "none"} mins).`;
      } else if (!existsPlayers) {
        reason = `No pricing rule matches player count of ${count} (configured ranges: ${allRulesForGame.map(r => `${r.minPlayers}-${r.maxPlayers}`).join(", ")}).`;
      }

      return NextResponse.json({
        message: reason
      }, { status: 400 });
    }

    const bookingCost = calculateBasePrice(rule, count);
    
    // Check if start/end times roll over midnight
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

    if (start.getTime() < Date.now() - 5 * 60 * 1000) {
      return NextResponse.json({ message: "Cannot book a slot in the past. Please select a future date and time." }, { status: 400 });
    }

    // Court Availability Check
    const avail = await checkAvailability(gameId, start, end, bookingId);
    if (!avail.available) {
      return NextResponse.json({ message: avail.reason || "Slot is not available" }, { status: 409 });
    }

    // If bookingId is provided, retrieve and update the existing pending booking
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      const existingBooking = await Booking.findById(bookingId);
      if (!existingBooking) {
        return NextResponse.json({ message: "Booking not found" }, { status: 404 });
      }

      existingBooking.court = avail.courtName;
      existingBooking.startTime = start;
      existingBooking.endTime = end;
      existingBooking.playersCount = count;
      existingBooking.price = bookingCost;
      existingBooking.paymentStatus = "PAID";
      existingBooking.status = "BOOKED";

      await existingBooking.save();

      await Transaction.create({
        userId: user._id,
        type: "SESSION_DEDUCTION",
        amount: bookingCost,
        coins: 0,
        note: `Paid booking for ${game.name} on court ${avail.courtName}`,
        paymentMode: "online",
        paymentStatus: "PAID",
      });

      return NextResponse.json({ success: true, message: "Booking updated and paid", booking: existingBooking });
    }

    // Check FIXED membership coverage
    const activeMembership = await Membership.findOne({
      userId: user._id,
      status: "ACTIVE",
      membershipType: "FIXED",
    }).sort({ createdAt: -1 });

    const isFixedCovered = checkFixedMembershipCoverage(activeMembership, gameId, start, end);

    if (isFixedCovered) {
      // Prevent booking if booking start date is beyond the membership expiry
      const createdAtTime = new Date(activeMembership.createdAt).getTime();
      const totalDays = activeMembership.totalDays || activeMembership.days || (activeMembership.months ? activeMembership.months * 30 : 0);
      const expiry = createdAtTime + totalDays * 24 * 60 * 60 * 1000;
      if (start.getTime() > expiry) {
        return NextResponse.json({
          redirectPayment: true,
          reason: "membership_expired",
          message: "The requested booking date falls outside your active membership coverage period. Please make a regular payment booking."
        }, { status: 402 });
      }

      // Create Booking under FIXED membership (free)
      const booking = await Booking.create({
        userId: user._id,
        gameId,
        gameName: game.name,
        court: avail.courtName,
        startTime: start,
        endTime: end,
        coinCost: 0,
        price: 0,
        playersCount: count,
        crossMidnight,
        status: "BOOKED",
      });

      return NextResponse.json({ success: true, message: "Booking created under membership", booking });
    }

    // Check COINS membership active coverage
    const activeCoinsMembership = await Membership.findOne({
      userId: user._id,
      status: "ACTIVE",
      membershipType: "COINS",
    }).sort({ createdAt: -1 });

    if (activeCoinsMembership && user.coinPlanExpiryDate) {
      // Prevent booking if booking start date is beyond coin plan expiry date
      if (start > new Date(user.coinPlanExpiryDate)) {
        return NextResponse.json({
          redirectPayment: true,
          reason: "coins_expired",
          message: "Your coin plan has expired or the booking date is beyond the plan expiry. Please renew your membership or make a regular booking."
        }, { status: 402 });
      }
    }

    // Otherwise, booking using coins/payment
    if (paymentSuccess) {
      // Create paid booking (user paid cash/card for this booking)
      const booking = await Booking.create({
        userId: user._id,
        gameId,
        gameName: game.name,
        court: avail.courtName,
        startTime: start,
        endTime: end,
        coinCost: 0, // No coins deducted
        price: bookingCost, // Store cash price
        playersCount: count,
        crossMidnight,
        status: "BOOKED",
        playerType: user.role === "VISITOR" ? "VISITOR" : "MEMBER",
        paymentMode: "online",
        paymentStatus: "PAID",
      });

      await Transaction.create({
        userId: user._id,
        type: "SESSION_DEDUCTION",
        amount: bookingCost,
        coins: 0,
        note: `Paid booking for ${game.name} on court ${avail.courtName}`,
        paymentMode: "online",
        paymentStatus: "PAID",
      });

      return NextResponse.json({ success: true, message: "Booking paid and created", booking });
    }

    // Helper to create pending booking
    const createPendingBooking = async () => {
      return await Booking.create({
        userId: user._id,
        gameId,
        gameName: game.name,
        court: avail.courtName,
        startTime: start,
        endTime: end,
        coinCost: 0,
        price: bookingCost,
        playersCount: count,
        crossMidnight,
        status: "BOOKED",
        playerType: user.role === "VISITOR" ? "VISITOR" : "MEMBER",
        paymentMode: "online",
        paymentStatus: "PENDING",
      });
    };

    // Check limits and coin balance
    if (user.coins < bookingCost) {
      const pendingBooking = await createPendingBooking();
      return NextResponse.json({
        redirectPayment: true,
        reason: "insufficient_coins",
        message: `Insufficient coins. This booking costs ${bookingCost} coins, but you only have ${user.coins} coins.`,
        bookingId: pendingBooking._id,
      }, { status: 402 });
    }

    // Check daily coin spend limit (Only for COINS membership type. Ignore for FIXED/no memberships)
    const hasCoinsMembership = activeCoinsMembership && activeCoinsMembership.status === "ACTIVE";

    if (hasCoinsMembership) {
      const { start: startOfDay, endExtended: endExtendedDay } = getDayBounds(date);
      const todayBookings = await Booking.find({
        userId: user._id,
        status: { $in: ["BOOKED", "STARTED", "COMPLETED"] },
        startTime: { $gte: startOfDay, $lte: endExtendedDay },
        softDeleted: false,
      }).lean();

      const todaySpent = todayBookings.reduce((sum, b) => sum + (b.coinCost || 0), 0);
      const limit = user.dailyCoinSpendLimit || 0;

      if (limit > 0 && todaySpent + bookingCost > limit) {
        const pendingBooking = await createPendingBooking();
        return NextResponse.json({
          redirectPayment: true,
          reason: "exceeds_limit",
          message: "Daily membership usage limit reached. Please book using a regular payment.",
          bookingId: pendingBooking._id,
        }, { status: 402 });
      }
    }

    // Prevent coin booking if user coins are frozen
    if (user.coinsFrozen) {
      return NextResponse.json({
        message: `Your coin wallet is frozen. Reason: ${user.coinsFrozenReason || "Frozen by administrator"}`
      }, { status: 403 });
    }

    // Deduct coins and create booking
    user.coins = user.coins - bookingCost;
    await user.save();

    const booking = await Booking.create({
      userId: user._id,
      gameId,
      gameName: game.name,
      court: avail.courtName,
      startTime: start,
      endTime: end,
      coinCost: bookingCost,
      price: 0,
      playersCount: count,
      crossMidnight,
      status: "BOOKED",
    });

    await Transaction.create({
      userId: user._id,
      type: "SESSION_DEDUCTION",
      amount: 0,
      coins: bookingCost,
      note: `Booked session for ${game.name} on court ${avail.courtName}`,
    });

    return NextResponse.json({ success: true, message: "Booking created successfully", booking });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Booking creation failed" }, { status: 500 });
  }
}
