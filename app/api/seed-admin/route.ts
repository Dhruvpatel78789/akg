import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";

export async function GET() {
  await connectDB();

  const existingAdmin = await User.findOne({
    email: "admin@akshargamezone.com",
  });

  if (existingAdmin) {
    return NextResponse.json({
      message: "Admin already exists",
      email: "admin@akshargamezone.com",
      password: "admin1234",
    });
  }

  const passwordHash = await bcrypt.hash("admin1234", 10);

  const admin = await User.create({
    name: "Administrator",
    phone: "9999999998",
    email: "admin@akshargamezone.com",
    passwordHash,
    role: "ADMIN",
    phoneVerified: true,
    emailVerified: true,
    coins: 0,
  });

  return NextResponse.json({
    message: "Admin created successfully",
    admin: {
      id: admin._id,
      email: admin.email,
      role: admin.role,
    },
    login: {
      email: "admin@akshargamezone.com",
      password: "admin1234",
    },
  });
}