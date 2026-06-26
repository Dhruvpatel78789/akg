import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";

export async function PATCH(request: Request) {
  try {
    await connectDB();
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { dob } = await request.json();

    if (!dob) {
      return NextResponse.json({ success: false, message: "Date of Birth is required" }, { status: 400 });
    }

    const parsedDob = new Date(dob);
    if (isNaN(parsedDob.getTime())) {
      return NextResponse.json({ success: false, message: "Invalid date format" }, { status: 400 });
    }

    const today = new Date();
    if (parsedDob > today) {
      return NextResponse.json({ success: false, message: "Date of Birth cannot be in the future" }, { status: 400 });
    }

    // Reasonable age limit checks (e.g. at least 3 years old, no more than 120 years old)
    const age = today.getFullYear() - parsedDob.getFullYear();
    if (age < 3 || age > 120) {
      return NextResponse.json({ success: false, message: "Please provide a realistic date of birth" }, { status: 400 });
    }

    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // DOB can be added if missing. If already added, editing requires admin support.
    if (user.dob) {
      return NextResponse.json({
        success: false,
        message: "Date of Birth is already set and cannot be modified. Please contact admin support."
      }, { status: 400 });
    }

    user.dob = parsedDob;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: { dob: user.dob }
    });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
