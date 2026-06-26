import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Transaction } from "@/models/Transaction";
import { Membership } from "@/models/Membership";
import { updateBookingStatuses } from "@/lib/booking-status-updater";

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
  await connectDB();

  const authUser = await getAuthUser();

  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Automate bookings lifecycle transitions
  await updateBookingStatuses();

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

  // Check if player has active or past memberships
  const membershipsCount = await Membership.countDocuments({
    userId: user._id,
    status: { $in: ["ACTIVE", "EXPIRED", "CANCELLED"] }
  });

  // Also check if player has any bookings (e.g. Visitor booking / Member advance booking)
  const bookingsCount = await Booking.countDocuments({
    userId: user._id,
    softDeleted: false,
  });

  const noMembership = membershipsCount === 0 && bookingsCount === 0;

  

  const activeFixed = await Membership.findOne({
    userId: user._id,
    status: "ACTIVE",
    membershipType: "FIXED",
  })
    .sort({ createdAt: -1 })
    .lean();

  const activeCoins = await Membership.findOne({
    userId: user._id,
    status: "ACTIVE",
    membershipType: "COINS",
  })
    .sort({ createdAt: -1 })
    .lean();

  const membershipDaysLeft = getMembershipDaysLeft(activeFixed);



  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayUpcomingSessions = await Booking.find({
    userId: user._id,
    status: "BOOKED",
    startTime: { $gte: todayStart, $lte: todayEnd },
    softDeleted: false,
  })
    .populate("gameId")
    .sort({ startTime: 1 })
    .lean();

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  nextMonthEnd.setHours(23, 59, 59, 999);

  const calendarSessions = await Booking.find({
    userId: user._id,
    status: { $in: ["BOOKED", "STARTED"] },
    startTime: { $gte: currentMonthStart, $lte: nextMonthEnd },
    softDeleted: false,
  })
    .populate("gameId")
    .sort({ startTime: 1 })
    .lean();

  const playHistoryRaw = await Booking.find({
    userId: user._id,
    status: { $in: ["COMPLETED", "CANCELLED"] },
    softDeleted: false,
  })
    .populate("gameId")
    .sort({ exitedTime: -1, createdAt: -1 })
    .limit(20)
    .lean();

  const AdditionalChargeModel = (await import("@/models/AdditionalCharge")).AdditionalCharge;
  const BookingRequestModel = (await import("@/models/BookingRequest")).BookingRequest;

  const playHistory = await Promise.all(
    playHistoryRaw.map(async (b: any) => {
      const charge = await AdditionalChargeModel.findOne({ bookingId: b._id }).lean();
      return {
        ...b,
        additionalCharge: charge || null,
      };
    })
  );

  const pendingRescheduleRequestCount = await BookingRequestModel.countDocuments({
    userId: user._id,
    type: "TIME_CHANGE",
    status: "PENDING",
  });

  const pendingCancellationRequestCount = await BookingRequestModel.countDocuments({
    userId: user._id,
    type: "CANCELLATION",
    status: "PENDING",
  });

  const transactions = await Transaction.find({
    userId: user._id,
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  // Calculate total completed seconds across ALL past completed sessions (not limited to top 20)
  const allCompletedBookings = await Booking.find({
    userId: user._id,
    status: "COMPLETED",
    softDeleted: false,
  }).select("startTime exitedTime").lean();

  const totalCompletedPlaySeconds = allCompletedBookings.reduce((total, booking) => {
    if (!booking.startTime || !booking.exitedTime) return total;
    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.exitedTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return total;
    }
    return total + Math.floor((end - start) / 1000);
  }, 0);

  // Support multiple active sessions
  const activeSessions = await Booking.find({
    userId: user._id,
    status: "STARTED",
    softDeleted: false,
  }).populate("gameId").sort({ startTime: 1 }).lean();

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

  // Calculate coins used today: bookings on selected/current date that utilized coin balances
  const todayCoinsBookings = await Booking.find({
    userId: user._id,
    startTime: { $gte: todayStart, $lte: todayEnd },
    softDeleted: false,
    status: { $in: ["BOOKED", "STARTED", "COMPLETED"] },
  }).select("coinCost").lean();

  const todayCoinsUsed = todayCoinsBookings.reduce((sum, b) => sum + (b.coinCost || 0), 0);

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
  });
}