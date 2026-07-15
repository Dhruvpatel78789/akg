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
  validityValue: z.number().min(1).optional(),
  validityUnit: z.enum(["DAYS", "MONTHS"]).optional(),
  sessionDurationMode: z.enum(["FIXED", "FLEXIBLE"]).optional(),
  sessionDuration: z.number().optional(),
  minDuration: z.number().optional(),
  maxDuration: z.number().optional(),
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

  const updates = { ...result.data } as any;
  if (updates.validityValue !== undefined || updates.validityUnit !== undefined) {
    const existing = await Plan.findById(id);
    if (existing) {
      const valValue = updates.validityValue !== undefined ? updates.validityValue : (existing.validityValue ?? 30);
      const valUnit = updates.validityUnit !== undefined ? updates.validityUnit : (existing.validityUnit ?? "DAYS");
      updates.validityDays = valUnit === "MONTHS" ? valValue * 30 : valValue;
    }
  }

  const plan = await Plan.findByIdAndUpdate(id, updates, {
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