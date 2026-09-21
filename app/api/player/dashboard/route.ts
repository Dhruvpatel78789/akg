import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Transaction } from "@/models/Transaction";
import { Membership } from "@/models/Membership";
import { Plan } from "@/models/Plan";

function getMembershipDaysLeft(membership: any) {
  if (!membership) return 0;

  const startDate = new Date(membership.startDate || membership.createdAt).getTime();

  const totalDays =
    membership.totalDays || ((membership.months || 0) * 30 + (membership.days || 0));

  if (!totalDays) return 0;

  const expiry = startDate + totalDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return Math.max(0, Math.ceil((expiry - now) / (24 * 60 * 60 * 1000)));
}

export async function GET() {
  try {
    await connectDB();

    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(authUser.userId).select(
      "name phone email coins coinsAvailable coinsFrozen coinsFrozenReason coinsFrozenAt dailyCoinSpendLimit coinPlanExpiryDate totalCoinsInCycle activePlanId role canRescheduleFixedMembership"
    );

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    const now = new Date();

    // Fallback migration for legacy coin balances
    if (user.coins > 0 && user.coinsAvailable === 0 && user.coinsFrozen === 0) {
      user.coinsAvailable = user.coins;
      await user.save();
    }

    // Automatic Coin Expiry / Auto Freeze logic
    if (user.coinPlanExpiryDate && now > new Date(user.coinPlanExpiryDate) && user.coinsAvailable > 0) {
      user.coinsFrozen = user.coinsAvailable;
      user.coinsAvailable = 0;
      user.coins = 0;
      user.coinsFrozenReason = `Plan expired on ${new Date(user.coinPlanExpiryDate).toLocaleDateString("en-IN")}`;
      user.coinsFrozenAt = now;
      await user.save();
    }

    if (user.role === "ADMIN") {
      return NextResponse.json({ message: "Administrators do not have player access" }, { status: 403 });
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    nextMonthEnd.setHours(23, 59, 59, 999);

    const AdditionalChargeModel = (await import("@/models/AdditionalCharge")).AdditionalCharge;
    const BookingRequestModel = (await import("@/models/BookingRequest")).BookingRequest;
    const { Settings } = await import("@/models/Settings");

    const [
      membershipsCount,
      bookingsCount,
      activeFixed,
      activeCoins,
      todayUpcomingSessions,
      calendarSessions,
      playHistoryRaw,
      pendingRescheduleRequestCount,
      pendingCancellationRequestCount,
      transactions,
      totalSecondsResult,
      activeSessions,
      todayCoinsBookings,
      settingsObj,
    ] = await Promise.all([
      // Check if player has active or past memberships
      Membership.countDocuments({
        userId: user._id,
        status: { $in: ["ACTIVE", "EXPIRED", "CANCELLED"] }
      }),
      // Also check if player has any bookings (e.g. Visitor booking / Member advance booking)
      Booking.countDocuments({
        userId: user._id,
        softDeleted: false,
      }),
      Membership.findOne({
        userId: user._id,
        status: "ACTIVE",
        membershipType: "FIXED",
      })
        .populate("planId")
        .sort({ createdAt: -1 })
        .lean(),
      Membership.findOne({
        userId: user._id,
        status: "ACTIVE",
        membershipType: "COINS",
      })
        .populate("planId")
        .sort({ createdAt: -1 })
        .lean(),
      Booking.find({
        userId: user._id,
        status: "BOOKED",
        startTime: { $gte: todayStart, $lte: todayEnd },
        softDeleted: false,
      })
        .populate("gameId")
        .sort({ startTime: 1 })
        .lean(),
      Booking.find({
        userId: user._id,
        status: { $in: ["BOOKED", "STARTED"] },
        startTime: { $gte: currentMonthStart, $lte: nextMonthEnd },
        softDeleted: false,
      })
        .populate("gameId")
        .sort({ startTime: 1 })
        .lean(),
      Booking.find({
        userId: user._id,
        status: { $in: ["COMPLETED", "CANCELLED"] },
        softDeleted: false,
      })
        .populate("gameId")
        .sort({ exitedTime: -1, createdAt: -1 })
        .limit(20)
        .lean(),
      BookingRequestModel.countDocuments({
        userId: user._id,
        type: "TIME_CHANGE",
        status: "PENDING",
      }),
      BookingRequestModel.countDocuments({
        userId: user._id,
        type: "CANCELLATION",
        status: "PENDING",
      }),
      Transaction.find({
        userId: user._id,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Booking.aggregate([
        { $match: { userId: user._id, status: "COMPLETED", exitedTime: { $ne: null } } },
        { $project: { duration: { $subtract: ["$exitedTime", "$startTime"] } } },
        { $group: { _id: null, totalMs: { $sum: "$duration" } } },
      ]),
      Booking.find({
        userId: user._id,
        status: "STARTED",
        softDeleted: false,
      }).populate("gameId").sort({ startTime: 1 }).lean(),
      Booking.find({
        userId: user._id,
        startTime: { $gte: todayStart, $lte: todayEnd },
        softDeleted: false,
        status: { $in: ["BOOKED", "STARTED", "COMPLETED"] },
      }).select("coinCost").lean(),
      Settings.findOne().lean()
    ]);

    const noMembership = membershipsCount === 0 && bookingsCount === 0;
    const membershipDaysLeft = getMembershipDaysLeft(activeFixed);

    const bookingIds = playHistoryRaw.map((b: any) => b._id);
    const allCharges = await AdditionalChargeModel.find({ bookingId: { $in: bookingIds } }).lean();
    const chargesByBooking = new Map<string, any>();
    for (const charge of allCharges) chargesByBooking.set(charge.bookingId.toString(), charge);
    const playHistory = playHistoryRaw.map((b: any) => ({
      ...b,
      additionalCharge: chargesByBooking.get(b._id.toString()) || null,
    }));

    const totalCompletedPlaySeconds = totalSecondsResult.length > 0 ? Math.floor(totalSecondsResult[0].totalMs / 1000) : 0;

    // Pick first active session for backwards compatibility/timers if needed
    const activeSession = activeSessions[0] || null;

    const activeSessionsSeconds = activeSessions.map(session => {
      return session.startTime
        ? Math.max(0, Math.floor((now.getTime() - new Date(session.startTime).getTime()) / 1000))
        : 0;
    });

    const activeSessionSeconds = activeSessionsSeconds[0] || 0;
    const totalActiveSeconds = activeSessionsSeconds.reduce((a, b) => a + b, 0);
    const totalPlaySeconds = totalCompletedPlaySeconds + totalActiveSeconds;

    const todayCoinsUsed = todayCoinsBookings.reduce((sum, b) => sum + (b.coinCost || 0), 0);

    const defaultDailyCoinSpendLimit = settingsObj?.defaultDailyCoinSpendLimit ?? 800;

    return NextResponse.json({
      user,
      noMembership,
      activeFixed,
      activeCoins,
      membershipDaysLeft,
      activeSession,
      activeSessions,
      todayUpcomingSessions,
      calendarSessions,
      playHistory,
      transactions,
      totalPlaySeconds,
      currentPlaySeconds: activeSessionSeconds,
      serverTime: now,
      pendingRescheduleRequestCount,
      pendingCancellationRequestCount,
      todayCoinsUsed,
      defaultDailyCoinSpendLimit,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}