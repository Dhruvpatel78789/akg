import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { AdditionalCharge } from "@/models/AdditionalCharge";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { BookingIntent } from "@/models/BookingIntent";

export async function GET() {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(authUser.userId).lean();
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    // 1. Fetch pending additional charges
    const charges = await AdditionalCharge.find({
      userId: authUser.userId,
      status: "PENDING",
      requestedByAdmin: true,
    })
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .lean();

    const formattedCharges = charges.map((c: any) => ({
      _id: c._id.toString(),
      itemType: "ADDITIONAL_CHARGE",
      title: c.reason || "Additional Charge",
      reason: c.reason || "Additional Charge",
      amount: c.amount,
      status: c.status,
      createdAt: c.createdAt,
    }));

    // 2. Fetch pending bookings (Booking model with PENDING paymentStatus)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const pendingBookings = await Booking.find({
      userId: authUser.userId,
      status: "BOOKED",
      paymentStatus: "PENDING",
      paymentMethod: "RAZORPAY",
      softDeleted: false,
      $or: [
        { intentExpiresAt: { $gt: new Date() } },
        { createdAt: { $gte: thirtyMinutesAgo } }
      ]
    })
      .populate("gameId")
      .sort({ createdAt: -1 })
      .lean();

    const formattedBookings = pendingBookings.map((b: any) => ({
      _id: b._id.toString(),
      itemType: "PENDING_BOOKING",
      title: `${b.gameName || b.gameId?.name || "Game"} Booking`,
      reason: `${b.gameName || b.gameId?.name || "Game"} Booking`,
      amount: b.price || b.subtotal || 0,
      date: b.startTime,
      startTime: b.startTime ? new Date(b.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
      endTime: b.endTime ? new Date(b.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
      razorpayOrderId: b.razorpayOrderId,
      bookingId: b._id.toString(),
      checkoutUrl: `/payment/booking-intent/${b._id.toString()}?autoPay=true`,
      createdAt: b.createdAt,
      expiresAt: b.intentExpiresAt,
      status: "PENDING",
    }));

    // 3. Fetch pending booking intents (by user phone)
    const userPhoneClean = user.phone ? user.phone.replace(/\D/g, "").slice(-10) : "";
    let formattedIntents: any[] = [];

    if (userPhoneClean) {
      const pendingIntents = await BookingIntent.find({
        phone: { $regex: userPhoneClean + "$" },
        status: "PENDING_PAYMENT",
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .lean();

      formattedIntents = pendingIntents.map((i: any) => ({
        _id: i._id.toString(),
        itemType: "BOOKING_INTENT",
        title: `${i.gameName || "Game"} Booking`,
        reason: `${i.gameName || "Game"} Booking`,
        amount: i.price,
        date: i.date,
        startTime: i.startTime,
        endTime: i.endTime,
        razorpayOrderId: i.razorpayOrderId,
        intentId: i._id.toString(),
        checkoutUrl: `/payment/booking-intent/${i._id.toString()}?autoPay=true`,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        status: "PENDING",
      }));
    }

    const pendingItems = [...formattedCharges, ...formattedBookings, ...formattedIntents];

    return NextResponse.json({
      success: true,
      charges: formattedCharges,
      pendingItems,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load pending payments" }, { status: 500 });
  }
}
