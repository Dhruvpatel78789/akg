import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Company } from "@/models/Company";

export async function GET() {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const companies = await Company.find({ softDeleted: false })
      .populate("allowedGameIds", "name")
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ success: true, companies });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to retrieve companies" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const body = await request.json();
    const { name, contactPerson, contactNumber, email, billingAddress, gstNumber, allowedGameIds, discountPercentage, gameDiscounts } = body;

    if (!name || !contactPerson || !contactNumber || !email || !billingAddress) {
      return NextResponse.json({ success: false, message: "Missing required company details" }, { status: 400 });
    }

    const existing = await Company.findOne({ name, softDeleted: false });
    if (existing) {
      return NextResponse.json({ success: false, message: "Company with this name already exists" }, { status: 409 });
    }

    // Generate a readable pastel color code
    const pastelColors = [
      "#E8E1FF", // Lavender
      "#E1F5FE", // Cyan/Light Blue
      "#FCE4EC", // Pink
      "#FFFDE7", // Yellow
      "#F3E5F5", // Purple
      "#E8F5E9", // Mint Green
      "#FFF3E0", // Orange
    ];
    const colorCode = pastelColors[Math.floor(Math.random() * pastelColors.length)];

    const company = await Company.create({
      name,
      contactPerson,
      contactNumber,
      email,
      billingAddress,
      gstNumber,
      allowedGameIds: allowedGameIds || [],
      discountPercentage: Number(discountPercentage || 0),
      gameDiscounts: gameDiscounts || [],
      colorCode,
    });

    return NextResponse.json({ success: true, company });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to create company" }, { status: 500 });
  }
}
