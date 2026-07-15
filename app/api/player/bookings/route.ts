import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Game } from "@/models/Game";
import { Court } from "@/models/court";
import { CourtBlock } from "@/models/CourtBlock";
import { Booking } from "@/models/Booking";
import { Membership } from "@/models/Membership";
import { Plan } from "@/models/Plan";
import { PricingRule } from "@/models/PricingRule";
import { Transaction } from "@/models/Transaction";
import { PaymentOrder } from "@/models/PaymentOrder";
import { Coupon } from "@/models/Coupon";
import { CouponUsage } from "@/models/CouponUsage";
import { Settings } from "@/models/Settings";
import mongoose from "mongoose";
import { checkCourtAvailability } from "@/lib/availability";

const checkAvailability = checkCourtAvailability;

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

      if (start.getTime() < Date.now() - 2 * 60 * 1000) {
        return NextResponse.json({
          success: true,
          available: false,
          reason: "Cannot book a slot in the past. Please select a future date and time.",
          coinCost: cost,
          endTime,
          suggestedSlots: [],
        });
      }

      const avail = await checkAvailability(gameId, start, end);
      let suggestedSlots: any[] = [];
      if (!avail.available) {
        const { getAlternativeSlots } = await import("@/lib/availability");
        suggestedSlots = await getAlternativeSlots(gameId, date, startTime, durationMinutes, playersCount);
      }

      let availableCourts: string[] = [];
      let courts: any[] = [];
      if (game.allowCourtSelection) {
        const { checkCourtsStatus } = await import("@/lib/availability");
        courts = await checkCourtsStatus(gameId, start, end);
        availableCourts = courts.filter((c: any) => c.status === "Available").map((c: any) => c.courtName);
      }

      return NextResponse.json({
        success: true,
        available: avail.available,
        courtName: avail.courtName,
        coinCost: cost,
        reason: avail.reason,
        endTime,
        crossMidnight,
        suggestedSlots,
        availableCourts,
        courts,
        allowCourtSelection: game.allowCourtSelection,
      });
    }

    // Otherwise return pricing only
    return NextResponse.json({
      success: true,
      available: null,
      coinCost: cost,
      allowCourtSelection: game.allowCourtSelection,
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
    const { bookingId, gameId, date, startTime, playersCount, razorpayOrderId, couponId, paymentMethod } = body;
    let { paymentSuccess, endTime } = body;

    if (!gameId || !date || !startTime || !playersCount) {
      return NextResponse.json({ message: "Missing required booking details" }, { status: 400 });
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
    const userCourt = body.court; // optional chosen court
    
    // Check if start/end times roll over midnight
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime, crossMidnight ? 1 : 0);

    let existingBookingForGrace: any = null;
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      existingBookingForGrace = await Booking.findById(bookingId).lean();
    }

    const hasValidGracePeriod = existingBookingForGrace && 
      existingBookingForGrace.intentExpiresAt && 
      new Date(existingBookingForGrace.intentExpiresAt) > new Date();

    // If there's no active valid grace period, strictly validate that bookingStartTime is in the future
    if (!hasValidGracePeriod && start.getTime() < Date.now() - 2 * 60 * 1000) {
      return NextResponse.json({ message: "Cannot book a slot in the past. Please select a future date and time." }, { status: 400 });
    }

    // Court Availability Check
    const { checkCourtsStatus } = await import("@/lib/availability");
    const courtsStatus = await checkCourtsStatus(gameId, start, end, bookingId);
    
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

    const avail = { available: true, courtName: finalCourt };

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
          paymentOrderId: razorpayOrderId || undefined,
        });
      }
    }

    // Auto Offer and Coupon discount calculation
    const { calculateBestDiscount } = await import("@/lib/offers");
    const discountsResult = await calculateBestDiscount(
      bookingCost,
      gameId,
      date,
      startTime,
      couponId || undefined,
      user._id
    );

    if (couponId && discountsResult.couponError) {
      return NextResponse.json({ message: discountsResult.couponError }, { status: 400 });
    }

    const expectedPrice = discountsResult.payableAmount;
    const appliedPromotions = discountsResult.appliedPromotions;
    const couponPromo = appliedPromotions.find(p => p.type === "COUPON");
    const discountAmount = couponPromo ? couponPromo.discountAmount : 0;
    let coupon = null;
    if (couponId) {
      coupon = await Coupon.findOne({ _id: couponId, active: true });
    }

    const isFree = expectedPrice <= 0;

    const isPayAtCounter = paymentMethod === "PAY_AT_COUNTER";

    if (isPayAtCounter) {
      const settings = await Settings.findOne() || { payAtCounterWindowMinutes: 30 };
      const limitMins = settings.payAtCounterWindowMinutes ?? 30;
      const minutesUntilBooking = (start.getTime() - Date.now()) / (60 * 1000);

      if (minutesUntilBooking > limitMins || minutesUntilBooking < -15) {
        return NextResponse.json({
          message: `Pay at Counter is available only for bookings within ${limitMins} minutes.`
        }, { status: 400 });
      }

      // If bookingId is provided, update existing
      if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking) {
          return NextResponse.json({ message: "Booking not found" }, { status: 404 });
        }

        existingBooking.court = avail.courtName;
        existingBooking.startTime = start;
        existingBooking.endTime = end;
        existingBooking.playersCount = count;
        existingBooking.subtotal = bookingCost;
        existingBooking.price = expectedPrice;
        existingBooking.paymentMethod = "PAY_AT_COUNTER";
        existingBooking.paymentMode = "cash";
        existingBooking.paymentStatus = "PENDING";
        existingBooking.gatewayPaymentStatus = "PENDING";
        existingBooking.adminPaymentStatus = "PENDING";
        existingBooking.effectivePaymentStatus = "PENDING";
        existingBooking.status = "BOOKED";
        existingBooking.appliedPromotions = appliedPromotions as any;

        await existingBooking.save();

        if (coupon) {
          coupon.usedCount = (coupon.usedCount || 0) + 1;
          await coupon.save();

          await CouponUsage.create({
            couponId: coupon._id,
            userId: user._id,
            bookingId: existingBooking._id,
            discountAmount,
          });
        }

        return NextResponse.json({ success: true, message: "Booking reserved, please pay at counter", booking: existingBooking });
      }

      // Create new booking
      const booking = await Booking.create({
        userId: user._id,
        gameId,
        gameName: game.name,
        court: avail.courtName,
        startTime: start,
        endTime: end,
        coinCost: 0,
        subtotal: bookingCost,
        price: expectedPrice,
        playersCount: count,
        crossMidnight,
        status: "BOOKED",
        playerType: user.role === "VISITOR" ? "VISITOR" : "MEMBER",
        paymentMethod: "PAY_AT_COUNTER",
        paymentMode: "cash",
        paymentStatus: "PENDING",
        gatewayPaymentStatus: "PENDING",
        adminPaymentStatus: "PENDING",
        effectivePaymentStatus: "PENDING",
        appliedPromotions: appliedPromotions as any,
      });

      if (coupon) {
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save();

        await CouponUsage.create({
          couponId: coupon._id,
          userId: user._id,
          bookingId: booking._id,
          discountAmount,
        });
      }

      return NextResponse.json({ success: true, message: "Booking reserved, please pay at counter", booking });
    }

    // Verify payment status
    if (razorpayOrderId) {
      if (isFree) {
        if (!razorpayOrderId.startsWith("order_free_coupon_") && !razorpayOrderId.startsWith("order_mock_")) {
          return NextResponse.json({ message: "Free coupon purchase requires a valid coupon order ID." }, { status: 400 });
        }
        paymentSuccess = true;
      } else {
        if (razorpayOrderId.startsWith("order_free_coupon_")) {
          return NextResponse.json({ message: "Invalid payment ID for non-free purchase." }, { status: 400 });
        }
        const pOrder = await PaymentOrder.findOne({ razorpayOrderId });
        if (!pOrder || pOrder.status !== "PAID") {
          return NextResponse.json({ message: "Unverified Razorpay transaction. Please process payment first." }, { status: 400 });
        }
        if (Math.abs(pOrder.amount - expectedPrice) > 1) {
          return NextResponse.json({ message: `Payment amount discrepancy. Expected ₹${expectedPrice}, got ₹${pOrder.amount}` }, { status: 400 });
        }
        paymentSuccess = true;
      }
    } else if (isFree && (body.paymentSuccess || paymentSuccess)) {
      paymentSuccess = true;
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
      existingBooking.subtotal = bookingCost;
      existingBooking.price = expectedPrice;
      existingBooking.paymentStatus = "PAID";
      existingBooking.status = "BOOKED";
      existingBooking.appliedPromotions = appliedPromotions as any;

      await existingBooking.save();

      await Transaction.create({
        userId: user._id,
        type: "SESSION_DEDUCTION",
        amount: expectedPrice,
        coins: 0,
        note: `Paid booking for ${game.name} on court ${avail.courtName}`,
        paymentMode: "online",
        paymentStatus: "PAID",
      });

      if (coupon) {
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save();

        await CouponUsage.create({
          couponId: coupon._id,
          userId: user._id,
          bookingId: existingBooking._id,
          discountAmount,
        });
      }

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
        court: finalCourt,
        startTime: start,
        endTime: end,
        coinCost: 0,
        price: 0,
        playersCount: count,
        crossMidnight,
        status: "BOOKED",
        paymentStatus: "PAID",
        adminPaymentStatus: "WAIVED",
        paymentMode: "coins",
        appliedPromotions: appliedPromotions as any,
      });

      return NextResponse.json({ success: true, message: "Booking created under membership", booking });
    }

    // Check COINS membership active coverage
    const activeCoinsMembership = await Membership.findOne({
      userId: user._id,
      status: "ACTIVE",
      membershipType: "COINS",
    }).populate("planId").sort({ createdAt: -1 });

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
        court: finalCourt,
        startTime: start,
        endTime: end,
        coinCost: 0, // No coins deducted
        subtotal: bookingCost,
        price: expectedPrice, // Store cash price
        appliedPromotions: appliedPromotions as any,
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
        amount: expectedPrice,
        coins: 0,
        note: `Paid booking for ${game.name} on court ${avail.courtName}`,
        paymentMode: "online",
        paymentStatus: "PAID",
      });

      if (coupon) {
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save();

        await CouponUsage.create({
          couponId: coupon._id,
          userId: user._id,
          bookingId: booking._id,
          discountAmount,
        });
      }

      return NextResponse.json({ success: true, message: "Booking paid and created", booking });
    }

    // Helper to create pending booking
    const createPendingBooking = async (coinCostToDeduct = 0, priceToPay = expectedPrice) => {
      const intentCreatedAt = new Date();
      const intentExpiresAt = new Date(intentCreatedAt.getTime() + 10 * 60 * 1000);
      return await Booking.create({
        userId: user._id,
        gameId,
        gameName: game.name,
        court: finalCourt,
        startTime: start,
        endTime: end,
        coinCost: coinCostToDeduct,
        subtotal: bookingCost,
        price: priceToPay,
        appliedPromotions: appliedPromotions as any,
        playersCount: count,
        crossMidnight,
        status: "BOOKED",
        playerType: user.role === "VISITOR" ? "VISITOR" : "MEMBER",
        paymentMode: "online",
        paymentStatus: "PENDING",
        intentCreatedAt,
        intentExpiresAt,
      });
    };

    // Retrieve daily limit from user or plan fallback
    const hasCoinsMembership = activeCoinsMembership && activeCoinsMembership.status === "ACTIVE";
    let remainingDailyLimit = Infinity;
    let todaySpent = 0;

    if (hasCoinsMembership) {
      const { start: startOfDay, endExtended: endExtendedDay } = getDayBounds(date);
      const todayBookings = await Booking.find({
        userId: user._id,
        status: { $in: ["BOOKED", "STARTED", "COMPLETED"] },
        startTime: { $gte: startOfDay, $lte: endExtendedDay },
        softDeleted: false,
      }).lean();

      todaySpent = todayBookings.reduce((sum, b) => sum + (b.coinCost || 0), 0);
      let limit = user.dailyCoinSpendLimit || (activeCoinsMembership as any).planId?.dailyCoinSpendLimit || 0;
      if (limit === 0) {
        const settings = await Settings.findOne().lean();
        limit = settings?.defaultDailyCoinSpendLimit ?? 800;
      }
      if (limit > 0) {
        remainingDailyLimit = Math.max(0, limit - todaySpent);
      }
    }

    // Check if total transaction exceeds the daily coin limit OR available coins
    const maxCoinsAllowed = Math.min(user.coins, remainingDailyLimit);

    if (bookingCost > maxCoinsAllowed) {
      // Calculate how many coins can be used
      const coinsToUse = Math.max(0, maxCoinsAllowed);
      const remainingCashToPay = bookingCost - coinsToUse;

      const pendingBooking = await createPendingBooking(coinsToUse, remainingCashToPay);

      let reason = "insufficient_coins";
      let msg = `Insufficient coins. Using ${coinsToUse} coins from your balance, and the remaining ₹${remainingCashToPay} must be paid online.`;
      if (remainingDailyLimit < bookingCost && remainingDailyLimit < user.coins) {
        reason = "exceeds_limit";
        msg = `Daily limit reached. Using ${coinsToUse} coins from your balance, and the remaining ₹${remainingCashToPay} must be paid online.`;
      }

      return NextResponse.json({
        redirectPayment: true,
        reason,
        message: msg,
        bookingId: pendingBooking._id,
      }, { status: 402 });
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
      court: finalCourt,
      startTime: start,
      endTime: end,
      coinCost: bookingCost,
      price: 0,
      playersCount: count,
      crossMidnight,
      status: "BOOKED",
      paymentStatus: "PAID",
      adminPaymentStatus: "PAID",
      paymentMode: "coins",
    });

    await Transaction.create({
      userId: user._id,
      type: "SESSION_DEDUCTION",
      amount: 0,
      coins: bookingCost,
      note: `Booked session for ${game.name} on court ${finalCourt}`,
      paymentMode: "coins",
      paymentStatus: "PAID",
    });

    return NextResponse.json({ success: true, message: "Booking created successfully", booking });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Booking creation failed" }, { status: 500 });
  }
}
