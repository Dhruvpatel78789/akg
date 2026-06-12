import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Promotion } from "@/models/Promotion";

const schema = z.object({
  type: z.enum(["TEXT", "IMAGE", "VIDEO"]),
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
  placement: z.string().min(1),
  targetAudience: z.enum(["ALL", "VISITOR", "PLAYER", "MEMBER", "COIN_USER", "COMPANY_USER", "ADMIN"]).optional(),
  priority: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  daysOfWeek: z.array(z.number()).optional(),
  fullDay: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  await connectDB();

  const promotions = await Promotion.find({ softDeleted: false })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  return NextResponse.json({ promotions });
}

export async function POST(request: Request) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

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

  if (data.type === "TEXT" && !data.title) {
    return NextResponse.json(
      { message: "Title is required for TEXT promotions" },
      { status: 400 }
    );
  }

  if (data.type !== "TEXT" && !data.mediaUrl) {
    return NextResponse.json(
      { message: "Media URL is required for IMAGE or VIDEO promotions" },
      { status: 400 }
    );
  }

  const promotion = await Promotion.create({
    type: data.type,
    title: data.title || "",
    subtitle: data.subtitle || "",
    description: data.description || "",
    ctaText: data.ctaText || "",
    ctaLink: data.ctaLink || "",
    mediaUrl: data.mediaUrl || "",
    thumbnailUrl: data.thumbnailUrl || "",
    altText: data.altText || "",
    backgroundColor: data.backgroundColor || "",
    textColor: data.textColor || "",
    accentColor: data.accentColor || "",
    placement: data.placement,
    targetAudience: data.targetAudience || "ALL",
    priority: data.priority ?? 0,
    startDate: data.startDate ? new Date(data.startDate) : undefined,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
    startTime: data.startTime || undefined,
    endTime: data.endTime || undefined,
    daysOfWeek: data.daysOfWeek || [],
    fullDay: data.fullDay ?? true,
    active: data.active ?? true,
    createdBy: admin.user?._id,
    updatedBy: admin.user?._id,
  });

  return NextResponse.json(
    {
      message: "Promotion created",
      promotion,
    },
    { status: 201 }
  );
}