import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Settings } from "@/models/Settings";

export async function GET() {
  try {
    await connectDB();
    let settings = await Settings.findOne().lean();
    if (!settings) {
      settings = { payAtCounterWindowMinutes: 30, defaultDailyCoinSpendLimit: 800 } as any;
    }
    return NextResponse.json(
      { success: true, settings },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
