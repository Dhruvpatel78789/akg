import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export function signToken(payload: {
  userId: string;
  role: "PLAYER" | "ADMIN" | "COMPANY_EMPLOYEE" | "VISITOR";
  companyId?: string;
}) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: "PLAYER" | "ADMIN" | "COMPANY_EMPLOYEE" | "VISITOR";
      companyId?: string;
    };
  } catch {
    return null;
  }
}