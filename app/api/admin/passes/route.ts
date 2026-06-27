import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { Game } from "@/models/Game";
import { Court } from "@/models/court";
import { PricingRule } from "@/models/PricingRule";
import { updateBookingStatuses } from "@/lib/booking-status-updater";
import mongoose from "mongoose";

export async function GET() {
  try {
    await connectDB();

    const admin = await requireAdmin("passes", "viewPasses", false);
    if (admin.error) return admin.error;

    // Run status updater first to auto-transition ongoing bookings
    await updateBookingStatuses();

    // Fetch passes. Consider only bookings where payment button was clicked:
    // 1. paymentStatus is PAID
    // 2. Or paymentMethod is PAY_AT_COUNTER
    // 3. Or razorpayOrderId is present and not empty
    const bookings = await Booking.find({
      softDeleted: false,
      $or: [
        { paymentStatus: "PAID" },
        { paymentMethod: "PAY_AT_COUNTER" },
        { razorpayOrderId: { $ne: null, $exists: true } }
      ]
    })
      .populate("userId", "name phone email role")
      .populate("companyId", "name")
      .populate("companyEmployeeId", "name mobile email employeeId")
      .sort({ startTime: -1 })
      .lean();

    return NextResponse.json({ success: true, bookings });
  } catch (err: any) {
    console.error("GET passes error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const admin = await requireAdmin("passes", "createPasses", true);
    if (admin.error) return admin.error;

    const body = await request.json();
    const {
      name,
      phone,
      email,
      dob,
      gameId,
      court,
      date,
      startTime,
      durationMinutes,
      playersCount,
      paymentMethod, // "PAY_AT_COUNTER" | "RAZORPAY"
      paymentStatus,  // "PAID" | "PENDING"
    } = body;

    if (!name || !phone || !gameId || !date || !startTime || !durationMinutes) {
      return NextResponse.json({ success: false, message: "Missing required booking details" }, { status: 400 });
    }

    const game = await Game.findById(gameId).lean();
    if (!game) {
      return NextResponse.json({ success: false, message: "Game not found" }, { status: 404 });
    }

    // Find or create User by phone (role VISITOR by default)
    let user = await User.findOne({ phone });
    if (!user) {
      const uniqueEmail = email || `${phone}@visitor.akshargamezone.com`;
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
    }

    // Parse slots
    const { parseIST } = await import("@/lib/time");
    const duration = Number(durationMinutes);
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
    const em = totalMinutes % 60;
    const endTimeStr = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);

    const start = parseIST(date, startTime);
    const end = parseIST(date, endTimeStr, crossMidnight ? 1 : 0);

    // Pricing rule lookup
    const count = Number(playersCount || 1);
    const rule = await PricingRule.findOne({
      gameId: new mongoose.Types.ObjectId(gameId),
      active: true,
      minPlayers: { $lte: count },
      maxPlayers: { $gte: count },
      durationMinutes: duration,
    });

    const price = rule ? (rule.mode === "PER_PLAYER" ? count * rule.pricePerPlayer : rule.baseCourtPrice + count * rule.pricePerPlayer) : 0;

    // Direct check court assignment
    let finalCourt = court;
    if (!finalCourt) {
      const dbCourts = await Court.find({ gameId, active: true }).lean();
      if (dbCourts.length > 0) {
        finalCourt = dbCourts[0].name;
      } else {
        finalCourt = "Court A";
      }
    }

    // If payment status is PAID, we override adminPaymentStatus to PAID
    const isPaid = paymentStatus === "PAID";
    const paymentMode = paymentMethod === "PAY_AT_COUNTER" ? "cash" : "online";

    const booking = await Booking.create({
      userId: user._id,
      gameId: game._id,
      gameName: game.name,
      court: finalCourt,
      startTime: start,
      endTime: end,
      price,
      playersCount: count,
      crossMidnight,
      playerType: "VISITOR",
      paymentMethod,
      paymentMode,
      paymentStatus: isPaid ? "PAID" : "PENDING",
      adminPaymentStatus: isPaid ? "PAID" : "PENDING",
      effectivePaymentStatus: isPaid ? "PAID" : "PENDING",
      razorpayOrderId: paymentMethod === "RAZORPAY" ? "order_admin_created_" + Math.random().toString(36).substring(2, 10) : undefined,
    });

    return NextResponse.json({ success: true, booking });
  } catch (err: any) {
    console.error("POST passes error:", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to create pass" }, { status: 500 });
  }
}
