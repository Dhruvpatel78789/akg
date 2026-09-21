import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Plan } from "@/models/Plan";

export async function GET() {
  try {
    await connectDB();

    const plans = await Plan.find({
      active: true,
      softDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      { plans },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/plans error:", error);

    return NextResponse.json(
      {
        message: "Failed to load plans",
        plans: [],
      },
      { status: 500 }
    );
  }
}