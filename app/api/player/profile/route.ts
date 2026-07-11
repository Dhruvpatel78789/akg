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

    const { name, phone, email, dob } = await request.json();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Name update
    if (name !== undefined) {
      const nameClean = name.trim();
      if (!nameClean) {
        return NextResponse.json({ success: false, message: "Name cannot be empty" }, { status: 400 });
      }
      user.name = nameClean;
    }

    // Phone update
    if (phone !== undefined) {
      const phoneClean = phone.trim();
      if (!/^\d{10}$/.test(phoneClean)) {
        return NextResponse.json({ success: false, message: "Phone number must be exactly 10 digits" }, { status: 400 });
      }
      if (phoneClean !== user.phone) {
        const dupPhone = await User.findOne({ phone: phoneClean, _id: { $ne: user._id } });
        if (dupPhone) {
          return NextResponse.json({ success: false, message: "This phone number is already registered to another account" }, { status: 400 });
        }
        user.phone = phoneClean;
      }
    }

    // Email update
    if (email !== undefined) {
      const emailClean = email.trim().toLowerCase();
      if (emailClean) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
          return NextResponse.json({ success: false, message: "Invalid email format" }, { status: 400 });
        }
        if (emailClean !== user.email) {
          const dupEmail = await User.findOne({ email: emailClean, _id: { $ne: user._id } });
          if (dupEmail) {
            return NextResponse.json({ success: false, message: "This email address is already registered to another account" }, { status: 400 });
          }
          user.email = emailClean;
        }
      }
    }

    // DOB update
    if (dob !== undefined) {
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

      // DOB can be added if missing. If already added, editing requires admin support.
      if (user.dob && user.dob.toISOString().split("T")[0] !== parsedDob.toISOString().split("T")[0]) {
        return NextResponse.json({
          success: false,
          message: "Date of Birth is already set and cannot be modified. Please contact admin support."
        }, { status: 400 });
      }

      user.dob = parsedDob;
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        name: user.name,
        phone: user.phone,
        email: user.email,
        dob: user.dob
      }
    });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json({ success: false, message: "Server error: " + error.message }, { status: 500 });
  }
}
