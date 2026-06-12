import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { CompanyEmployee } from "@/models/CompanyEmployee";

export async function POST(request: Request) {
  await connectDB();

  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== "COMPANY_EMPLOYEE") {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const employee = await CompanyEmployee.findById(authUser.userId);
    if (!employee || employee.softDeleted || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Employee not found or inactive" },
        { status: 404 }
      );
    }

    employee.passwordHash = passwordHash;
    employee.mustChangePassword = false;
    await employee.save();

    return NextResponse.json({
      message: "Password changed successfully",
    });
  } catch (error: any) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
