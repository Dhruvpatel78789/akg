import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Company } from "@/models/Company";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, contactPerson, contactNumber, email, billingAddress, gstNumber, allowedGameIds, discountPercentage, status, gameDiscounts } = body;

    const company = await Company.findById(id);
    if (!company || company.softDeleted) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    if (name) company.name = name;
    if (contactPerson !== undefined) company.contactPerson = contactPerson;
    if (contactNumber !== undefined) company.contactNumber = contactNumber;
    if (email !== undefined) company.email = email;
    if (billingAddress !== undefined) company.billingAddress = billingAddress;
    if (gstNumber !== undefined) company.gstNumber = gstNumber;
    if (allowedGameIds !== undefined) company.allowedGameIds = allowedGameIds;
    if (discountPercentage !== undefined) company.discountPercentage = Number(discountPercentage);
    if (status !== undefined) company.status = status;
    if (gameDiscounts !== undefined) company.gameDiscounts = gameDiscounts;

    await company.save();
    return NextResponse.json({ success: true, company });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id } = await params;
    const company = await Company.findById(id);
    if (!company || company.softDeleted) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    company.softDeleted = true;
    await company.save();

    return NextResponse.json({ success: true, message: "Company soft-deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to delete company" }, { status: 500 });
  }
}
