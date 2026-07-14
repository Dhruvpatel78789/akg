import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { Membership } from "@/models/Membership";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    await connectDB();

    const adminAuth = await requireAdmin();
    if (adminAuth.error) return adminAuth.error;

    // Load admin user details to check password
    const adminUser = await User.findById(adminAuth.user?._id);
    if (!adminUser) {
      return NextResponse.json({ success: false, message: "Admin user not found" }, { status: 401 });
    }

    const { membershipId, adminPassword } = await request.json();

    if (!membershipId || !adminPassword) {
      return NextResponse.json({ success: false, message: "Membership ID and admin password are required" }, { status: 400 });
    }

    // Verify admin password
    const isValid = await bcrypt.compare(adminPassword, adminUser.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, message: "Invalid administrator password" }, { status: 401 });
    }

    // Delete membership
    const deleted = await Membership.findByIdAndDelete(membershipId);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Membership record not found or already deleted" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Membership deleted successfully."
    });
  } catch (error: any) {
    console.error("Delete membership error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to delete membership" }, { status: 500 });
  }
}
