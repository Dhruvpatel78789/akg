import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { User } from "@/models/User";

const schema = z.object({
  canRescheduleFixedMembership: z.boolean(),
});

export async function PATCH(
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
    return NextResponse.json({ message: "Invalid input" }, { status: 400 });
  }

  const user = await User.findByIdAndUpdate(
    id,
    {
      canRescheduleFixedMembership:
        result.data.canRescheduleFixedMembership,
    },
    { new: true }
  ).select("name canRescheduleFixedMembership");

  if (!user) {
    return NextResponse.json({ message: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({
    message: "Reschedule permission updated",
    user,
  });
}