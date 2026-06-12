import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Court } from "@/models/court";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;

  const court = await Court.findByIdAndDelete(id);

  if (!court) {
    return NextResponse.json({ message: "Court not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Court deleted" });
}