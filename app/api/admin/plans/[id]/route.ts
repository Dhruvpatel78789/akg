import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Plan } from "@/models/Plan";

const schema = z.object({
  name: z.string().min(2).optional(),
  active: z.boolean().optional(),
  softDeleted: z.boolean().optional(),
  dailyCoinSpendLimit: z.number().min(0).optional(),
  coinsAmount: z.number().min(1).optional(),
  bonusCoins: z.number().min(0).optional(),
  price: z.number().min(1).optional(),
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
    return NextResponse.json(
      { message: "Invalid input", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const plan = await Plan.findByIdAndUpdate(id, result.data, {
    new: true,
  });

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Plan updated", plan });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { id } = await params;

  const plan = await Plan.findByIdAndUpdate(
    id,
    { softDeleted: true, active: false },
    { new: true }
  );

  if (!plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Plan deleted", plan });
}