import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ visitCount: 0 });
    }

    // Find if a user (player or visitor) exists with this phone number
    const user = await User.findOne({ phone }).lean();
    if (!user) {
      return NextResponse.json({ visitCount: 0 });
    }

    const visitCount = await Booking.countDocuments({
      userId: user._id,
      status: "COMPLETED",
      exitedTime: { $exists: true, $ne: null },
      softDeleted: false,
    });

    return NextResponse.json({ success: true, visitCount, email: user.email, dob: user.dob });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to check visit count" }, { status: 500 });
  }
}
