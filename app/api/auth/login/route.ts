import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { signToken } from "@/lib/auth";
import { UserRole } from "@/models/UserRole";

const loginSchema = z.object({
  phone: z.string(),
  password: z.string().min(6), // Reduced to allow NEW1234
});

export async function POST(request: Request) {
  await connectDB();

  const body = await request.json();
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid phone number or password format" },
      { status: 400 }
    );
  }

  const { phone, password } = result.data;

  // Search by phone number strictly
  const trimmedPhone = phone.trim();
  const user = await User.findOne({ phone: trimmedPhone });

  if (!user) {
    return NextResponse.json(
      { message: "Invalid login credentials" },
      { status: 401 }
    );
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    return NextResponse.json(
      { message: "Invalid login credentials" },
      { status: 401 }
    );
  }

  const token = signToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const userRole = await UserRole.findOne({ userId: user._id }).lean();

  const response = NextResponse.json({
    message: "Login successful",
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      hasRoleProfile: !!userRole,
      mustChangePassword: user.mustChangePassword,
    },
  });

  response.cookies.set("auth_token", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}