import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";

function getDaysLeft(membership: any) {
  if (!membership) return 0;

  const createdAt = new Date(membership.createdAt).getTime();

  const totalDays =
    membership.totalDays || ((membership.months || 0) * 30 + (membership.days || 0));

  if (!totalDays) return 0;

  const expiry = createdAt + totalDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return Math.max(0, Math.ceil((expiry - now) / (24 * 60 * 60 * 1000)));
}

export async function GET(request: Request) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "createdAt_desc";
  const membershipStatus = searchParams.get("membershipStatus") || "ALL"; // ALL, FIXED, COINS, NONE
  const minCoins = searchParams.get("minCoins") ? Number(searchParams.get("minCoins")) : null;
  const maxCoins = searchParams.get("maxCoins") ? Number(searchParams.get("maxCoins")) : null;
  const regStart = searchParams.get("regStart") || "";
  const regEnd = searchParams.get("regEnd") || "";

  // Build query
  const query: any = { role: "PLAYER" };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (minCoins !== null || maxCoins !== null) {
    query.coins = {};
    if (minCoins !== null) query.coins.$gte = minCoins;
    if (maxCoins !== null) query.coins.$lte = maxCoins;
  }

  if (regStart || regEnd) {
    query.createdAt = {};
    if (regStart) query.createdAt.$gte = new Date(regStart);
    if (regEnd) {
      const endD = new Date(regEnd);
      endD.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endD;
    }
  }

  // Determine sort options
  let sortOption: any = { createdAt: -1 };
  if (sort === "name_asc") sortOption = { name: 1 };
  else if (sort === "name_desc") sortOption = { name: -1 };
  else if (sort === "coins_asc") sortOption = { coins: 1 };
  else if (sort === "coins_desc") sortOption = { coins: -1 };
  else if (sort === "createdAt_asc") sortOption = { createdAt: 1 };
  else if (sort === "createdAt_desc") sortOption = { createdAt: -1 };

  const users = await User.find(query)
    .select("name phone email coins coinsAvailable coinsFrozen coinsFrozenReason coinsFrozenAt dailyCoinSpendLimit coinPlanExpiryDate totalCoinsInCycle canRescheduleFixedMembership rewardCoins createdAt")
    .sort(sortOption)
    .lean();

  const memberships = await Membership.find({
    userId: { $in: users.map((user) => user._id) },
    status: "ACTIVE",
  })
    .sort({ createdAt: -1 })
    .lean();

  let data = users.map((user) => {
    const membership = memberships.find(
      (item) => item.userId.toString() === user._id.toString()
    );

    const daysLeftVal = getDaysLeft(membership);

    return {
      ...user,
      activeMembership: membership || null,
      membershipType: membership?.membershipType || null,
      planName: membership?.gameName || null,
      membershipDaysLeft: daysLeftVal,
      daysLeft: daysLeftVal,
      isFixedMember: membership?.membershipType === "FIXED",
      isCoinsMember: membership?.membershipType === "COINS" || (user.coins > 0 && user.coinPlanExpiryDate && new Date() <= new Date(user.coinPlanExpiryDate)),
    };
  });

  // Filter by membership status on processed list
  if (membershipStatus !== "ALL") {
    if (membershipStatus === "FIXED") {
      data = data.filter((m) => m.isFixedMember);
    } else if (membershipStatus === "COINS") {
      data = data.filter((m) => m.isCoinsMember);
    } else if (membershipStatus === "NONE") {
      data = data.filter((m) => !m.isFixedMember && !m.isCoinsMember);
    }
  }

  return NextResponse.json({ members: data });
}