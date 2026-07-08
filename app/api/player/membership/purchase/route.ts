import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Plan } from "@/models/Plan";
import { Membership } from "@/models/Membership";
import { Transaction } from "@/models/Transaction";
import { Game } from "@/models/Game";
import { Booking } from "@/models/Booking";
import { PaymentOrder } from "@/models/PaymentOrder";
import { Coupon } from "@/models/Coupon";
import { CouponUsage } from "@/models/CouponUsage";

const schema = z.object({
  planId: z.string(),
  durationIndex: z.number().min(0).default(0),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  razorpayOrderId: z.string().optional(),
  couponId: z.string().optional(),
});

function getMinutes(start: string, end: string) {
  if (!start || !end) return 0;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  return eh * 60 + em - (sh * 60 + sm);
}

function timeStringToTodayDate(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date;
}

function inferDurationFromLabel(label?: string) {
  if (!label) {
    return { months: 0, days: 0, totalDays: 0 };
  }

  const monthMatch = label.match(/(\d+)\s*M/i);
  const dayMatch = label.match(/(\d+)\s*D/i);

  const months = monthMatch ? Number(monthMatch[1]) : 0;
  const days = dayMatch ? Number(dayMatch[1]) : 0;

  return {
    months,
    days,
    totalDays: months * 30 + days,
  };
}

function normalizeDuration(duration: any) {
  const inferred = inferDurationFromLabel(duration?.label);

  const months =
    Number(duration?.months || 0) > 0
      ? Number(duration.months)
      : inferred.months;

  const days =
    Number(duration?.days || 0) > 0
      ? Number(duration.days)
      : inferred.days;

  const totalDays =
    Number(duration?.totalDays || 0) > 0
      ? Number(duration.totalDays)
      : months * 30 + days;

  return {
    months,
    days,
    totalDays,
  };
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const user = await User.findById(authUser.userId);

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    const plan = await Plan.findOne({
      _id: result.data.planId,
      active: true,
      softDeleted: false,
    });

    if (!plan) {
      return NextResponse.json({ message: "Plan not found" }, { status: 404 });
    }

    const { razorpayOrderId, couponId } = result.data;
    if (!razorpayOrderId) {
      return NextResponse.json({ message: "razorpayOrderId is required to complete this purchase." }, { status: 400 });
    }

    let originalPrice = 0;
    let duration: any = null;
    let normalizedDuration: any = null;

    if (plan.type === "COINS") {
      originalPrice = plan.price || 0;
    } else {
      duration = plan.durations?.[result.data.durationIndex];
      if (!duration) {
        return NextResponse.json({ message: "Invalid duration" }, { status: 400 });
      }
      normalizedDuration = normalizeDuration(duration);
      if (normalizedDuration.totalDays <= 0) {
        return NextResponse.json(
          {
            message:
              "Invalid plan duration. Edit this plan in admin and set months or days correctly.",
          },
          { status: 400 }
        );
      }
      originalPrice = duration.finalPrice || 0;
    }

    let discountAmount = 0;
    let coupon = null;

    if (couponId) {
      coupon = await Coupon.findOne({ _id: couponId, active: true });
      if (!coupon) {
        return NextResponse.json({ message: "Coupon code is invalid or inactive." }, { status: 400 });
      }
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        return NextResponse.json({ message: "Coupon has expired." }, { status: 400 });
      }
      if (!coupon.applicableOnMembership) {
        return NextResponse.json({ message: "This coupon is not valid for membership plan recharges." }, { status: 400 });
      }
      const minVal = coupon.minimumOrderValue ?? coupon.minBookingAmount ?? 0;
      if (originalPrice < minVal) {
        return NextResponse.json({ message: `This coupon is valid only on orders of ₹${minVal} or more.` }, { status: 400 });
      }
      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        return NextResponse.json({ message: "Coupon usage limit reached." }, { status: 400 });
      }
      const priorUsage = await CouponUsage.findOne({ couponId: coupon._id, userId: user._id });
      if (priorUsage) {
        return NextResponse.json({ message: "You have already used this coupon code." }, { status: 400 });
      }

      const type = coupon.discountType || coupon.type;
      const value = coupon.discountValue ?? coupon.value ?? 0;
      const maxDiscount = coupon.maximumDiscount ?? coupon.maxDiscount;

      if (type === "FLAT") {
        discountAmount = value;
        if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
      } else if (type === "PERCENTAGE") {
        discountAmount = (originalPrice * value) / 100;
        if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
      }
      discountAmount = Math.min(discountAmount, originalPrice);
    }

    const expectedPrice = Math.max(0, originalPrice - discountAmount);
    const isFree = expectedPrice <= 0;

    if (!isFree) {
      if (razorpayOrderId.startsWith("order_free_coupon_")) {
        return NextResponse.json({ message: "Invalid payment ID for non-free purchase." }, { status: 400 });
      }
      const pOrder = await PaymentOrder.findOne({ razorpayOrderId });
      if (!pOrder || pOrder.status !== "PAID") {
        return NextResponse.json({ message: "Unverified transaction. Please process payment first." }, { status: 400 });
      }
      if (Math.abs(pOrder.amount - expectedPrice) > 1) {
        return NextResponse.json({ message: `Payment amount discrepancy. Expected ₹${expectedPrice}, got ₹${pOrder.amount}` }, { status: 400 });
      }
    } else {
      if (!razorpayOrderId.startsWith("order_free_coupon_") && !razorpayOrderId.startsWith("order_mock_")) {
        return NextResponse.json({ message: "Free coupon purchase requires a valid coupon order ID." }, { status: 400 });
      }
    }

    if (plan.type === "COINS") {
      const coinsToAdd = (plan.coinsAmount || 0) + (plan.bonusCoins || 0);
      const validityDays = plan.validityDays || 30;

      const now = new Date();
      
      // Auto unfreeze previous frozen coins and merge
      const previousFrozen = user.coinsFrozen || 0;
      user.coinsAvailable = (user.coinsAvailable || 0) + previousFrozen + coinsToAdd;
      user.coinsFrozen = 0;
      user.coinsFrozenReason = "";
      user.coinsFrozenAt = undefined;

      user.totalCoinsInCycle = user.coinsAvailable;
      user.coins = user.coinsAvailable;

      user.dailyCoinSpendLimit = plan.dailyCoinSpendLimit || 0;
      user.activePlanId = plan._id;
      if (user.role !== "PLAYER" && user.role !== "ADMIN") {
        user.role = "PLAYER";
      }
      
      const newExpiry = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
      user.coinPlanExpiryDate = newExpiry;
      await user.save();

      // Create a Membership record for the Coin Plan
      await Membership.create({
        userId: user._id,
        planId: plan._id,
        membershipType: "COINS",
        gameId: plan.gameId,
        gameName: plan.gameName || "Coin Plan",
        durationLabel: `${validityDays} Days`,
        months: 0,
        days: validityDays,
        totalDays: validityDays,
        startDate: now,
        startTime: now,
        endTime: newExpiry,
        price: expectedPrice,
        originalPrice: plan.price,
        status: "ACTIVE",
        paymentStatus: "PAID",
      });

      await Transaction.create({
        userId: user._id,
        type: "COINS_PURCHASE",
        amount: expectedPrice,
        coins: coinsToAdd,
        note: `Purchased coin plan: ${plan.name} - Validity: ${validityDays} Days`,
      });

      if (coupon) {
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save();

        await CouponUsage.create({
          couponId: coupon._id,
          userId: user._id,
          discountAmount,
        });
      }

      return NextResponse.json({ message: "Coins purchased" });
    }

    const game = await Game.findById(plan.gameId).lean();

    if (!game) {
      return NextResponse.json({ message: "Game not found" }, { status: 404 });
    }

    const startTime = plan.allowUserTimeSelection
      ? result.data.startTime
      : plan.adminStartTime;

    const endTime = plan.allowUserTimeSelection
      ? result.data.endTime
      : plan.adminEndTime;

    if (!startTime || !endTime) {
      return NextResponse.json(
        { message: "Start time and end time are required" },
        { status: 400 }
      );
    }

    const sessionMinutes = getMinutes(startTime, endTime);

    if (sessionMinutes <= 0) {
      return NextResponse.json(
        { message: "End time must be after start time" },
        { status: 400 }
      );
    }

    if (
      sessionMinutes < game.duration ||
      sessionMinutes > game.maximumDuration
    ) {
      return NextResponse.json(
        {
          message: `Session duration must be between ${game.duration} and ${game.maximumDuration} minutes`,
        },
        { status: 400 }
      );
    }

    if (sessionMinutes % game.duration !== 0) {
      return NextResponse.json(
        {
          message: `Session duration must be in multiples of ${game.duration} minutes`,
        },
        { status: 400 }
      );
    }

    // Keep both memberships active - user.activePlanId is now updated to the newly bought plan 
    // but the actual Membership records in DB both remain ACTIVE.
    user.activePlanId = plan._id;
    if (user.role !== "PLAYER" && user.role !== "ADMIN") {
      user.role = "PLAYER";
    }
    await user.save();

    const baseDate = new Date(); // Starts today

    const membership = await Membership.create({
      userId: user._id,
      planId: plan._id,
      membershipType: "FIXED",
      gameId: plan.gameId,
      gameName: plan.gameName,
      durationLabel: duration.label,

      months: normalizedDuration.months,
      days: normalizedDuration.days,
      totalDays: normalizedDuration.totalDays,

      startDate: baseDate,
      startTime: timeStringToTodayDate(startTime),
      endTime: timeStringToTodayDate(endTime),

      price: expectedPrice,
      originalPrice: duration.finalPrice,

      sessionMinutes,
      bufferMinutes: game.bufferMinutes || 0,

      status: "ACTIVE",
      paymentStatus: "PAID",
    });

    // Generate Booking slots for each day of the membership period
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const bookingPromises = [];
    

    for (let d = 0; d < normalizedDuration.totalDays; d++) {
      const currentDayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + d, startH, startM, 0, 0);
      const currentDayEnd = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + d, endH, endM, 0, 0);
      
      // If the duration crosses midnight
      if (endH < startH || (endH === startH && endM < startM)) {
        currentDayEnd.setDate(currentDayEnd.getDate() + 1);
      }

      bookingPromises.push(
        Booking.create({
          userId: user._id,
          gameId: plan.gameId,
          gameName: plan.gameName,
          startTime: currentDayStart,
          endTime: currentDayEnd,
          price: 0,
          coinCost: 0,
          playersCount: duration.playersIncluded || 1,
          crossMidnight: endH < startH || (endH === startH && endM < startM),
          playerType: "MEMBER",
          paymentMode: "coins",
          paymentStatus: "PAID",
          status: "BOOKED",
        })
      );
    }
    await Promise.all(bookingPromises);

    await Transaction.create({
      userId: user._id,
      type: "PLAN_PURCHASE",
      amount: expectedPrice,
      coins: 0,
      note: `Purchased membership: ${plan.name} - ${duration.label}`,
    });

    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();

      await CouponUsage.create({
        couponId: coupon._id,
        userId: user._id,
        discountAmount,
      });
    }

    return NextResponse.json({ message: "Membership purchased" });
  } catch (error) {
    console.error("POST /api/player/membership/purchase error:", error);

    return NextResponse.json(
      { message: "Purchase failed. Check server logs." },
      { status: 500 }
    );
  }
}