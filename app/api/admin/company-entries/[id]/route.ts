import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { SessionEntry } from "@/models/SessionEntry";

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
    const { startTime, endTime, court, status, softDeleted } = body;

    const entry = await SessionEntry.findById(id);
    if (!entry) {
      return NextResponse.json({ message: "Session entry not found" }, { status: 404 });
    }

    if (startTime) entry.startTime = new Date(startTime);
    if (endTime) entry.endTime = new Date(endTime);
    if (court) entry.court = court;
    if (status) entry.status = status;
    if (softDeleted !== undefined) entry.softDeleted = softDeleted;

    // If times are updated, recalculate booked duration minutes
    if (startTime || endTime) {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      if (end > start) {
        entry.bookedDurationMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
      }
    }

    await entry.save();

    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    console.error("PUT session entry admin error:", err);
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
    const entry = await SessionEntry.findById(id);
    if (!entry) {
      return NextResponse.json({ message: "Session entry not found" }, { status: 404 });
    }

    entry.softDeleted = true;
    await entry.save();

    return NextResponse.json({ success: true, message: "Session entry soft-deleted successfully" });
  } catch (err: any) {
    console.error("DELETE session entry admin error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
