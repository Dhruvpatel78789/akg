import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Court } from "@/models/court";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const court = await Court.findByIdAndUpdate(
    id,
    {
      disabled: Boolean(body.disabled),
      active: !Boolean(body.disabled),
      ...(body.name ? { name: body.name } : {}),
    },
    { new: true }
  );

  if (!court) {
    return NextResponse.json({ message: "Court not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Court updated", court });
}