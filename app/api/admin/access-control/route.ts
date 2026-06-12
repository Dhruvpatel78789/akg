import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserRole } from "@/models/UserRole";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const roles = await UserRole.find()
      .populate("userId", "name email phone role")
      .populate("allowedCompanyIds", "name")
      .populate("allowedGameIds", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, roles });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { email, permissions, allowedCompanyIds, allowedGameIds, allowedColumns, name, phone, password } = body;

    let user = await User.findOne({ email });
    if (!user) {
      if (password) {
        if (!name || !phone) {
          return NextResponse.json({ success: false, message: "Name, Phone and Password are required to create a new user" }, { status: 400 });
        }
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
          return NextResponse.json({ success: false, message: "User with this phone number already exists" }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        user = await User.create({
          name,
          email,
          phone,
          passwordHash,
          role: "PLAYER",
        });
      } else {
        return NextResponse.json({ success: false, message: "User not found. Provide password, name, and phone to create a new user." }, { status: 404 });
      }
    } else if (password) {
      // If user exists and password is provided, reset/change their password
      const passwordHash = await bcrypt.hash(password, 10);
      user.passwordHash = passwordHash;
      if (name) user.name = name;
      if (phone) user.phone = phone;
      await user.save();
    }

    // Upsert the user role
    const userRole = await UserRole.findOneAndUpdate(
      { userId: user._id },
      { permissions, allowedCompanyIds, allowedGameIds, allowedColumns },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, userRole });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
