import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Membership } from "@/models/Membership";

export async function GET(request: Request) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const isGlobalAdmin = admin.user?.role === "ADMIN";
  const roleProfile = admin.roleProfile;

  const checkPermission = (section: string, subKey: string) => {
    if (isGlobalAdmin) return true;
    const perm = roleProfile?.permissions?.find((p: any) => p.section === section);
    if (!perm) return false;
    const subs = perm.subSections instanceof Map ? Object.fromEntries(perm.subSections) : perm.subSections || {};
    return subs[subKey]?.view || false;
  };

  const hasAccess = 
    checkPermission("members", "memberList") || 
    checkPermission("members", "membershipStatus") || 
    checkPermission("members", "coinBalance");

  if (!hasAccess) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Build search regex
    const searchRegex = new RegExp(q.trim(), "i");

    // Find users matching search criteria
    const users = await User.find({
      $or: [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ]
    }).limit(20);

    const results = [];

    for (const u of users) {
      // Get last booking
      const lastBooking = await Booking.findOne({ userId: u._id }).sort({ startTime: -1 });

      // Get active memberships
      const activeFixed = await Membership.findOne({ userId: u._id, status: "ACTIVE", membershipType: "FIXED" });
      const activeCoins = await Membership.findOne({ userId: u._id, status: "ACTIVE", membershipType: "COINS" });

      // Identify record type
      let accountType = "Player";
      if (u.role === "VISITOR") {
        accountType = "Visitor";
      } else if (activeFixed) {
        accountType = "Member";
      } else if (activeCoins) {
        accountType = "Coin Member";
      } else if (u.accountSource === "COMPANY_UPLOAD") {
        accountType = "Company Player";
      } else if (u.accountSource === "VISITOR_BOOKING") {
        accountType = "Visitor";
      }

      results.push({
        source: "USER",
        id: u._id.toString(),
        name: u.name,
        phone: u.phone,
        email: u.email,
        dob: u.dob || null,
        accountType,
        membershipStatus: activeFixed ? "ACTIVE" : "INACTIVE",
        coins: u.coinsAvailable ?? u.coins ?? 0,
        currentMembership: activeFixed ? activeFixed.gameName || "Fixed Membership" : "None",
        currentCoinPlan: activeCoins ? activeCoins.durationLabel || "Coin Plan" : "None",
        lastBookingAt: lastBooking ? lastBooking.startTime : null
      });
    }

    return NextResponse.json({ results });

  } catch (err: any) {
    console.error("Player search failed:", err);
    return NextResponse.json({ message: "Internal server error: " + err.message }, { status: 500 });
  }
}
