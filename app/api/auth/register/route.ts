import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { signToken } from "@/lib/auth";

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(50, "Name cannot be more than 50 characters"),

    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10 digit Indian phone number"),

    email: z
      .string()
      .trim()
      .email("Enter a valid email address"),

    dob: z
      .string()
      .optional()
      .nullable(),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),

    confirmPassword: z
      .string()
      .min(8, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  await connectDB();

  const body = await request.json();
  const result = registerSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { name, phone, email, password, dob } = result.data;

  const existingEmail = await User.findOne({ email });

  if (existingEmail) {
    return NextResponse.json(
      {
        message: "Email already exists",
        errors: {
          email: ["This email is already registered"],
        },
      },
      { status: 409 }
    );
  }

  const existingPhone = await User.findOne({ phone });

  if (existingPhone) {
    return NextResponse.json(
      {
        message: "Phone already exists",
        errors: {
          phone: ["This phone number is already registered"],
        },
      },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    phone,
    email,
    passwordHash,
    dob: dob ? new Date(dob) : undefined,
    role: "PLAYER",
    phoneVerified: true,
    emailVerified: true,
  });

  const token = signToken({
    userId: user._id.toString(),
    role: user.role,
  });

  const response = NextResponse.json(
    {
      message: "Account created",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        coins: user.coins,
      },
    },
    { status: 201 }
  );

  response.cookies.set("auth_token", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}