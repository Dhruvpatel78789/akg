import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";
import { Plan } from "@/models/Plan";
import { Transaction } from "@/models/Transaction";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
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
    return subs[subKey]?.edit || false;
  };

  try {
    const body = await request.json();
    const {
      assignmentType, // "MEMBERSHIP" | "COIN_PLAN" | "ADD_COINS"
      name,
      phone,
      email,
      planId,
      durationIndex,
      gameId,
      startTime,
      endTime,
      startDate,
      coinsToAdd,
      reason,
      confirmUserId,
      offlinePaymentNote,
      checkOnly
    } = body;

    if (!assignmentType) {
      return NextResponse.json({ message: "Assignment Type is required." }, { status: 400 });
    }

    // Access Control checking
    if (assignmentType === "MEMBERSHIP") {
      if (!checkPermission("members", "membershipStatus")) {
        return NextResponse.json({ message: "Forbidden: Requires Membership Management permission." }, { status: 403 });
      }
    } else {
      if (!checkPermission("members", "coinBalance")) {
        return NextResponse.json({ message: "Forbidden: Requires Wallet Management permission." }, { status: 403 });
      }
    }

    if (!phone) {
      return NextResponse.json({ message: "Phone number is required." }, { status: 400 });
    }

    const phoneClean = phone.trim();
    if (!/^\d{10}$/.test(phoneClean)) {
      return NextResponse.json({ message: "Phone number must be exactly 10 digits." }, { status: 400 });
    }

    const emailClean = email ? email.trim().toLowerCase() : null;
    if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    // Match existing accounts
    const phoneMatches = await User.find({ phone: phoneClean });
    const emailMatches = emailClean ? await User.find({ email: emailClean }) : [];

    // Check conflicts
    if (phoneMatches.length > 0 && emailMatches.length > 0) {
      const phoneIds = phoneMatches.map(m => m._id.toString());
      const emailIds = emailMatches.map(m => m._id.toString());
      const hasIntersection = phoneIds.some(id => emailIds.includes(id));
      if (!hasIntersection) {
        return NextResponse.json({
          message: "Conflict: A different account already uses this email address."
        }, { status: 400 });
      }
    }

    // Combine matches
    const allMatchesMap = new Map<string, any>();
    phoneMatches.forEach(m => allMatchesMap.set(m._id.toString(), m));
    emailMatches.forEach(m => allMatchesMap.set(m._id.toString(), m));
    const uniqueMatches = Array.from(allMatchesMap.values());

    // If there are multiple matched entries and admin has not confirmed which one to use, display list to choose
    if (uniqueMatches.length > 0 && !confirmUserId && checkOnly) {
      // Find current details for matched accounts to display
      const matchesDetails = [];
      for (const m of uniqueMatches) {
        // Fetch active fixed membership
        const activeFixed = await Membership.findOne({ userId: m._id, status: "ACTIVE", membershipType: "FIXED" });
        // Fetch active coin membership
        const activeCoins = await Membership.findOne({ userId: m._id, status: "ACTIVE", membershipType: "COINS" });

        matchesDetails.push({
          _id: m._id,
          name: m.name,
          phone: m.phone,
          email: m.email,
          coins: m.coinsAvailable ?? m.coins ?? 0,
          currentMembership: activeFixed ? activeFixed.gameName || "Fixed Membership" : "None",
          currentCoinPlan: activeCoins ? activeCoins.durationLabel || "Coin Plan" : "None",
          createdAt: m.createdAt
        });
      }

      return NextResponse.json({
        success: true,
        needsConfirmation: true,
        matches: matchesDetails
      });
    }

    // Identify target user
    let targetUser: any = null;
    if (confirmUserId) {
      targetUser = await User.findById(confirmUserId);
      if (!targetUser) {
        return NextResponse.json({ message: "Selected user account not found." }, { status: 404 });
      }
    } else if (uniqueMatches.length === 1) {
      targetUser = uniqueMatches[0];
    } else if (uniqueMatches.length > 1 && !confirmUserId) {
      const matchesDetails = [];
      for (const m of uniqueMatches) {
        const activeFixed = await Membership.findOne({ userId: m._id, status: "ACTIVE", membershipType: "FIXED" });
        const activeCoins = await Membership.findOne({ userId: m._id, status: "ACTIVE", membershipType: "COINS" });

        matchesDetails.push({
          _id: m._id,
          name: m.name,
          phone: m.phone,
          email: m.email,
          coins: m.coinsAvailable ?? m.coins ?? 0,
          currentMembership: activeFixed ? activeFixed.gameName || "Fixed Membership" : "None",
          currentCoinPlan: activeCoins ? activeCoins.durationLabel || "Coin Plan" : "None",
          createdAt: m.createdAt
        });
      }

      return NextResponse.json({
        success: true,
        needsConfirmation: true,
        matches: matchesDetails
      });
    }

    // Load user data for preview if checkOnly and we found exactly 1 match
    if (checkOnly && targetUser) {
      const activeFixed = await Membership.findOne({ userId: targetUser._id, status: "ACTIVE", membershipType: "FIXED" });
      const activeCoins = await Membership.findOne({ userId: targetUser._id, status: "ACTIVE", membershipType: "COINS" });

      return NextResponse.json({
        success: true,
        needsConfirmation: false,
        existingPlayerFound: true,
        player: {
          _id: targetUser._id,
          name: targetUser.name,
          phone: targetUser.phone,
          email: targetUser.email,
          role: targetUser.role,
          coins: targetUser.coinsAvailable ?? targetUser.coins ?? 0,
          currentMembership: activeFixed ? activeFixed.gameName || "Fixed Membership" : "None",
          currentCoinPlan: activeCoins ? activeCoins.durationLabel || "Coin Plan" : "None"
        }
      });
    }

    // Input Validation per assignmentType
    let plan: any = null;
    let duration: any = null;

    if (assignmentType === "MEMBERSHIP" || assignmentType === "COIN_PLAN") {
      if (!planId) {
        return NextResponse.json({ message: "Plan ID is required." }, { status: 400 });
      }
      plan = await Plan.findById(planId);
      if (!plan || !plan.active || plan.softDeleted) {
        return NextResponse.json({ message: "Selected plan is inactive or does not exist." }, { status: 400 });
      }

      if (plan.type === "COINS") {
        duration = {
          label: `${plan.coinsAmount || 0} Coins Recharge`,
          finalPrice: plan.price || 0,
          originalPrice: plan.price || 0,
          totalDays: plan.validityDays || 30,
          months: 0,
          days: plan.validityDays || 30
        };
      } else {
        if (durationIndex === undefined) {
          return NextResponse.json({ message: "Plan Duration is required." }, { status: 400 });
        }
        duration = plan.durations[durationIndex];
        if (!duration) {
          return NextResponse.json({ message: "Selected plan duration is invalid." }, { status: 400 });
        }
      }

      if (assignmentType === "MEMBERSHIP" && plan.type !== "FIXED") {
        return NextResponse.json({ message: "Selected plan must be a fixed membership plan." }, { status: 400 });
      }
      if (assignmentType === "COIN_PLAN" && plan.type !== "COINS") {
        return NextResponse.json({ message: "Selected plan must be a coin plan." }, { status: 400 });
      }
    } else if (assignmentType === "ADD_COINS") {
      if (!coinsToAdd || Number(coinsToAdd) <= 0) {
        return NextResponse.json({ message: "Coins to add must be greater than 0." }, { status: 400 });
      }
    }

    if (checkOnly) {
      return NextResponse.json({
        success: true,
        needsConfirmation: false,
        message: "Validation successful."
      });
    }

    // --- Write Actions ---

    // 1. Create player user if none exists, or promote if visitor
    if (!targetUser) {
      if (!name) {
        return NextResponse.json({ message: "Name is required for creating a new account." }, { status: 400 });
      }
      const defaultEmail = emailClean || `${phoneClean}@visitor.akshargamezone.com`;
      const passwordHash = await bcrypt.hash("NEW1234", 10);
      targetUser = new User({
        name: name.trim(),
        phone: phoneClean,
        email: defaultEmail,
        passwordHash,
        role: "PLAYER",
        mustChangePassword: true,
        accountSource: "ADMIN_CREATED"
      });
      await targetUser.save();
    } else if (targetUser.role === "VISITOR") {
      const passwordHash = await bcrypt.hash("NEW1234", 10);
      targetUser.role = "PLAYER";
      targetUser.mustChangePassword = true;
      targetUser.accountSource = "ADMIN_CONVERTED_VISITOR";
      targetUser.passwordHash = passwordHash;
      if (name) targetUser.name = name.trim();
      if (emailClean) targetUser.email = emailClean;
      await targetUser.save();
    }

    if (assignmentType === "MEMBERSHIP" || assignmentType === "COIN_PLAN") {
      const sDate = startDate ? new Date(startDate) : new Date();
      sDate.setHours(0, 0, 0, 0);
      const totalDays = duration.totalDays || (duration.months * 30 + duration.days);
      const eDate = new Date(sDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

      // Create Active Membership
      const membership = new Membership({
        userId: targetUser._id,
        planId: plan._id,
        gameId: gameId || plan.gameId || null,
        gameName: plan.gameName || (assignmentType === "COIN_PLAN" ? "Coin Recharge Plan" : "General"),
        membershipType: plan.type,
        durationLabel: duration.label,
        months: duration.months || 0,
        days: duration.days || 0,
        totalDays,
        startDate: sDate,
        startTime: startTime ? new Date(`2000-01-01T${startTime}:00`) : undefined,
        endTime: endTime ? new Date(`2000-01-01T${endTime}:00`) : undefined,
        price: duration.finalPrice,
        originalPrice: duration.originalPrice,
        status: "ACTIVE",
        paymentStatus: "PAID",
        paymentMethod: "ADMIN_OFFLINE",
        paidAt: new Date(),
        createdByAdminId: admin.user._id,
        paidConfirmedByAdminId: admin.user._id
      });
      await membership.save();

      if (assignmentType === "COIN_PLAN") {
        const coinsAdded = plan.coinsAmount || 0;
        targetUser.coinsAvailable = (targetUser.coinsAvailable || 0) + coinsAdded;
        targetUser.coins = targetUser.coinsAvailable;
        targetUser.coinPlanExpiryDate = eDate;
        targetUser.activePlanId = plan._id;
        // Unfreeze coins if they were frozen
        targetUser.coinsFrozen = 0;
        targetUser.coinsFrozenReason = "";
        targetUser.coinsFrozenAt = undefined;
        await targetUser.save();

        // Transaction history log
        const transaction = new Transaction({
          userId: targetUser._id,
          type: "COIN_PLAN_PURCHASE",
          method: "ADMIN_OFFLINE",
          status: "PAID",
          amount: duration.finalPrice,
          coins: coinsAdded,
          reference: `admin_${admin.user._id}`,
          note: offlinePaymentNote || `Coin plan '${plan.name}' manually created and confirmed paid by admin.`
        });
        await transaction.save();
      } else {
        targetUser.activePlanId = plan._id;
        await targetUser.save();

        // Transaction history log
        const transaction = new Transaction({
          userId: targetUser._id,
          type: "MEMBERSHIP_PURCHASE",
          method: "ADMIN_OFFLINE",
          status: "PAID",
          amount: duration.finalPrice,
          reference: `admin_${admin.user._id}`,
          note: offlinePaymentNote || `Membership plan '${plan.name}' manually created and confirmed paid by admin.`
        });
        await transaction.save();
      }
    } else if (assignmentType === "ADD_COINS") {
      const addedCount = Number(coinsToAdd);
      targetUser.coinsAvailable = (targetUser.coinsAvailable || 0) + addedCount;
      targetUser.coins = targetUser.coinsAvailable;
      await targetUser.save();

      // Manual Coin Transaction log
      const transaction = new Transaction({
        userId: targetUser._id,
        type: "ADMIN_COIN_CREDIT",
        method: "ADMIN",
        status: "PAID",
        amount: 0,
        coins: addedCount,
        reference: `admin_${admin.user._id}`,
        note: reason || `Manual coins added by admin ID: ${admin.user._id}`
      });
      await transaction.save();
    }

    return NextResponse.json({
      success: true,
      message: "Player account / plan updated successfully.",
      user: targetUser
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ message: "Internal server error: " + err.message }, { status: 500 });
  }
}
