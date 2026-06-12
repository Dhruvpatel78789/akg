import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Promotion } from "@/models/Promotion";

const schema = z.object({
  type: z.enum(["TEXT", "IMAGE", "VIDEO"]).optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  mediaUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  altText: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  accentColor: z.string().optional(),
  placement: z.string().optional(),
  targetAudience: z.enum(["ALL", "VISITOR", "PLAYER", "MEMBER", "COIN_USER", "COMPANY_USER", "ADMIN"]).optional(),
  priority: z.number().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  daysOfWeek: z.array(z.number()).optional(),
  fullDay: z.boolean().optional(),
  active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  await connectDB();
  const { id } = await params;

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const promotion = await Promotion.findOne({ _id: id, softDeleted: false });
  if (!promotion) {
    return NextResponse.json({ message: "Promotion not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const data = result.data;
  const updateData: any = { ...data };

  // Convert date strings to Date objects or null
  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  }
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  }
  
  // Set updatedBy
  updateData.updatedBy = admin.user?._id;

  const updatedPromotion = await Promotion.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true }
  );

  return NextResponse.json({
    message: "Promotion updated",
    promotion: updatedPromotion,
  });
}

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  await connectDB();
  const { id } = await params;

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const promotion = await Promotion.findOne({ _id: id, softDeleted: false });
  if (!promotion) {
    return NextResponse.json({ message: "Promotion not found" }, { status: 404 });
  }

  // Perform soft delete
  promotion.softDeleted = true;
  promotion.updatedBy = admin.user?._id;
  await promotion.save();

  return NextResponse.json({
    message: "Promotion deleted successfully",
  });
}
