import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Court } from "@/models/court";
import { CourtBlock } from "@/models/CourtBlock";
import { Booking } from "@/models/Booking";

const schema = z.object({
  blockedFrom: z.string(),
  blockedTo: z.string(),
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;
  const body = await request.json();

  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { message: "Invalid block details", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const court = await Court.findById(id);

  if (!court) {
    return NextResponse.json({ message: "Court not found" }, { status: 404 });
  }

  const blockedFrom = new Date(result.data.blockedFrom);
  const blockedTo = new Date(result.data.blockedTo);

  if (blockedTo <= blockedFrom) {
    return NextResponse.json(
      { message: "End date/time must be after start date/time" },
      { status: 400 }
    );
  }

  const activeSession = await Booking.findOne({
    court: court.name,
    gameId: court.gameId,
    status: "STARTED",
    softDeleted: false,
  });

  const block = await CourtBlock.create({
    courtId: court._id,
    gameId: court.gameId,
    blockedFrom,
    blockedTo,
    reason: result.data.reason || "",
    status: activeSession ? "PENDING_AFTER_SESSION" : "ACTIVE",
    applyAfterCurrentSession: Boolean(activeSession),
  });

  await Court.findByIdAndUpdate(court._id, {
    disabled: true,
    active: false,
  });

  return NextResponse.json(
    {
      message: activeSession
        ? "Court will be disabled after current session ends"
        : "Court disabled",
      block,
    },
    { status: 201 }
  );
}