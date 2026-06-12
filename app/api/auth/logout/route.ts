import { NextResponse } from "next/server";

function handleLogout() {
  const response = NextResponse.json({
    message: "Logged out successfully",
  });

  response.cookies.set("auth_token", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function POST() {
  return handleLogout();
}

export async function GET() {
  return handleLogout();
}