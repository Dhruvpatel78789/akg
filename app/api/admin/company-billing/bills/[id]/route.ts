import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { CompanyBill } from "@/models/CompanyBill";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const bill = await CompanyBill.findById(id);
    if (!bill) {
      return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
    }

    if (status) {
      bill.status = status;
    }

    await bill.save();

    return NextResponse.json({ success: true, bill });
  } catch (err: any) {
    console.error("PUT company bill error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();

  try {
    const { id } = await params;
    const bill = await CompanyBill.findById(id);
    if (!bill) {
      return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
    }

    bill.softDeleted = true;
    await bill.save();

    return NextResponse.json({ success: true, message: "Invoice deleted successfully" });
  } catch (err: any) {
    console.error("DELETE company bill error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 505 }
    );
  }
}
