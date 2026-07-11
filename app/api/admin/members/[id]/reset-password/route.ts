import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";
import { AdminAuditLog } from "@/models/AdminAuditLog";
import bcrypt from "bcryptjs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;

  try {
    const { adminPassword, reason } = await request.json();

    if (!adminPassword) {
      return NextResponse.json({ message: "Admin password is required to perform a password reset." }, { status: 400 });
    }

    // Verify Admin's own password
    const adminUser = await User.findById(admin.user._id);
    if (!adminUser) {
      return NextResponse.json({ message: "Admin account not found." }, { status: 404 });
    }

    const isAdminPasswordValid = await bcrypt.compare(adminPassword, adminUser.passwordHash);
    if (!isAdminPasswordValid) {
      return NextResponse.json({ message: "Incorrect admin password. Action blocked." }, { status: 401 });
    }

    // Find and update target player user
    const player = await User.findById(id);
    if (!player) {
      return NextResponse.json({ message: "Player account not found." }, { status: 404 });
    }

    // Reset password
    const newPasswordHash = await bcrypt.hash("NEW1234", 10);
    player.passwordHash = newPasswordHash;
    player.mustChangePassword = true;
    await player.save();

    // Create Audit Log
    const audit = new AdminAuditLog({
      action: "RESET_PASSWORD",
      adminId: adminUser._id,
      targetUserId: player._id,
      reason: reason || "Admin manual password reset",
      details: {
        resetTo: "NEW1234"
      }
    });
    await audit.save();

    return NextResponse.json({
      success: true,
      message: "Password reset to NEW1234. The player must change it after login."
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ message: "Internal server error: " + err.message }, { status: 500 });
  }
}
