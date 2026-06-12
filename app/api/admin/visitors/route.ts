import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";

export async function GET() {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const visitors = await User.find({ role: "VISITOR" })
      .sort({ createdAt: -1 })
      .lean();

    const visitorData = [];
    for (const visitor of visitors) {
      const bookings = await Booking.find({ userId: visitor._id, softDeleted: false })
        .sort({ startTime: 1 })
        .lean();
      
      const completedBookings = bookings.filter(b => b.status === "COMPLETED" && b.exitedTime);
      const totalSpent = bookings.reduce((sum, b) => sum + (b.price || 0), 0);
      const lastVisit = completedBookings.length > 0 ? completedBookings[completedBookings.length - 1].startTime : null;

      visitorData.push({
        _id: visitor._id,
        name: visitor.name,
        phone: visitor.phone,
        email: visitor.email,
        dob: visitor.dob,
        rewardCoins: visitor.rewardCoins || 0,
        visitCount: completedBookings.length,
        bookingsCount: bookings.length,
        totalAmountSpent: totalSpent,
        lastVisitDate: lastVisit,
        createdAt: visitor.createdAt,
      });
    }

    return NextResponse.json({ success: true, visitors: visitorData });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load visitors" }, { status: 500 });
  }
}
