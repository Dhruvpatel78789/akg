import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { CourtBlock } from "@/models/CourtBlock";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = await params;

    const block = await CourtBlock.findByIdAndDelete(id);

    if (!block) {
      return NextResponse.json({ message: "Court block not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Scheduled block cancelled successfully" });
  } catch (err: any) {
    console.error("DELETE court block error:", err);
    return NextResponse.json({ message: err.message || "Failed to cancel block" }, { status: 500 });
  }
}
