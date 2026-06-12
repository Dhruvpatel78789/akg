import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { CompanyEmployee } from "@/models/CompanyEmployee";

export async function GET(request: Request) {
  await connectDB();

  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== "COMPANY_EMPLOYEE") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const employee = await CompanyEmployee.findById(authUser.userId);
    if (!employee || employee.softDeleted || employee.status !== "ACTIVE") {
      return NextResponse.json({ message: "Employee not found or inactive" }, { status: 401 });
    }

    const query: any = {
      companyId: employee.companyId,
      _id: { $ne: employee._id },
      softDeleted: false,
      status: "ACTIVE",
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const colleagues = await CompanyEmployee.find(query).limit(10).lean();

    const results = colleagues.map((c: any) => ({
      id: c._id.toString(),
      name: c.name,
      mobile: c.mobile,
      employeeId: c.employeeId,
      displayText: `${c.name} - XXXX${c.mobile.slice(-4)}`,
    }));

    return NextResponse.json({ success: true, employees: results });
  } catch (error: any) {
    console.error("Colleagues search error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
