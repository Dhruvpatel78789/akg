import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { CompanyEmployee } from "@/models/CompanyEmployee";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; empId: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id: companyId, empId } = await params;
    const body = await request.json();
    const { name, mobile, email, department, designation, status } = body;

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

    if (name !== undefined) employee.name = name;
    if (mobile !== undefined) employee.mobile = mobile;
    if (email !== undefined) employee.email = email;
    if (department !== undefined) employee.department = department;
    if (designation !== undefined) employee.designation = designation;
    if (status !== undefined) employee.status = status;

    await employee.save();

    return NextResponse.json({ success: true, employee });
  } catch (error: any) {
    console.error("Employee update error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update employee" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    employee.softDeleted = true;
    await employee.save();

    return NextResponse.json({ success: true, message: "Employee deleted successfully" });
  } catch (error: any) {
    console.error("Employee delete error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete employee" },
      { status: 500 }
    );
  }
}

