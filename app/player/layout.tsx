import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { connectDB } from "@/lib/mongodb";
import type { ReactNode } from "react";
import { headers } from "next/headers";

export default async function MembershipLayout({
  children,
}: {
  children: ReactNode;
}) {
  const heads = await headers();
  const pathname = heads.get("x-invoke-path") || "";
  
  // Define public paths that bypass mandatory login
  const isPublicPath =
    pathname === "/player/membership" ||
    pathname.startsWith("/player/membership/configure") ||
    pathname.startsWith("/player/visitor") ||
    pathname.startsWith("/player/payment") ||
    pathname.startsWith("/player/qr-exit");

  const authUser = await getAuthUser();
  
  if (!authUser) {
    if (isPublicPath) {
      return <>{children}</>;
    }
    redirect("/auth/login");
  }

  await connectDB();
  const dbUser = await User.findById(authUser.userId).lean();
  if (!dbUser) {
    if (isPublicPath) {
      return <>{children}</>;
    }
    redirect("/auth/login");
  }

  // Redirect if they must change their password, except on the profile page itself
  if (dbUser.mustChangePassword && pathname !== "/player/profile") {
    redirect("/player/profile?changePasswordRequired=true");
  }

  return <>{children}</>;
}