import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import { Company } from "@/models/Company";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  await connectDB();

  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { message: "Please provide employee ID/email/mobile and password" },
        { status: 400 }
      );
    }

    // Find active employee by email, mobile, or employeeId
    const employee = await CompanyEmployee.findOne({
      $or: [
        { email: identifier },
        { mobile: identifier },
        { employeeId: identifier },
      ],
      softDeleted: false,
      status: "ACTIVE",
    });

    if (!employee) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if the company is active
    const company = await Company.findById(employee.companyId);
    if (!company || company.softDeleted || company.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Company is disabled or inactive" },
        { status: 403 }
      );
    }

    const validPassword = await bcrypt.compare(password, employee.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signToken({
      userId: employee._id.toString(),
      role: "COMPANY_EMPLOYEE",
      companyId: employee.companyId.toString(),
    });

    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: employee._id.toString(),
        name: employee.name,
        email: employee.email,
        phone: employee.mobile,
        role: "COMPANY_EMPLOYEE",
        companyId: employee.companyId.toString(),
        mustChangePassword: employee.mustChangePassword,
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
  } catch (error: any) {
    console.error("Company login error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
