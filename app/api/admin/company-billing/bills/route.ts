import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { CompanyBill } from "@/models/CompanyBill";
import { Company } from "@/models/Company";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status");

    const query: any = { softDeleted: false };
    if (companyId) query.companyId = companyId;
    if (status) query.status = status;

    const bills = await CompanyBill.find(query)
      .populate("companyId", "name contactPerson email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, bills });
  } catch (err: any) {
    console.error("GET company bills error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
