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

    const parseIstDate = (dateStr: string) => {
      if (!dateStr) return null;
      if (dateStr.includes("+") || dateStr.endsWith("Z")) {
        return new Date(dateStr);
      }
      return new Date(`${dateStr}+05:30`);
    };

    const updateData: any = {};
    if (startTime) {
      const parsedStart = parseIstDate(startTime);
      if (parsedStart) updateData.startTime = parsedStart;
    }
    if (endTime) {
      const parsedEnd = parseIstDate(endTime);
      if (parsedEnd) updateData.endTime = parsedEnd;
    }
    if (court) updateData.court = court;
    if (status) updateData.status = status;
    if (softDeleted !== undefined) updateData.softDeleted = softDeleted;

    // Recalculate booked duration minutes if times changed
    const targetStart = updateData.startTime || entry.startTime;
    const targetEnd = updateData.endTime || entry.endTime;
    if (targetStart && targetEnd) {
      const start = new Date(targetStart);
      const end = new Date(targetEnd);
      if (end > start) {
        updateData.bookedDurationMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
      }
    }

    if (entry.bookingGroupId) {
      await SessionEntry.updateMany(
        { bookingGroupId: entry.bookingGroupId },
        { $set: updateData }
      );
      const updatedEntry = await SessionEntry.findById(id);
      return NextResponse.json({ success: true, entry: updatedEntry });
    } else {
      Object.assign(entry, updateData);
      await entry.save();
      return NextResponse.json({ success: true, entry });
    }
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
