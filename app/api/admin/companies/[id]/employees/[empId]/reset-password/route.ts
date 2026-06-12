import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import bcrypt from "bcryptjs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; empId: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id: companyId, empId } = await params;

    const employee = await CompanyEmployee.findOne({
      _id: empId,
      companyId,
      softDeleted: false,
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Employee not found" },
        { status: 404 }
      );
    }

    const defaultPasswordHash = await bcrypt.hash("NEW1234", 10);
    employee.passwordHash = defaultPasswordHash;
    employee.mustChangePassword = true;
    await employee.save();

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. Employee must change password on next login.",
    });
  } catch (error: any) {
    console.error("Employee reset password error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to reset password" },
      { status: 500 }
    );
  }
}
