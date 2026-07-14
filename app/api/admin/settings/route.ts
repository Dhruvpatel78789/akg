import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Settings } from "@/models/Settings";

export async function GET() {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    return NextResponse.json({
      success: true,
      settings: {
        visitorRescheduleHours: settings.visitorRescheduleHours,
        visitorCancellationHours: settings.visitorCancellationHours,
        memberRescheduleHours: settings.memberRescheduleHours,
        memberCancellationHours: settings.memberCancellationHours,
        billingLetterheadUrl: settings.billingLetterheadUrl,
        maxVisitorCoinUsagePercentage: settings.maxVisitorCoinUsagePercentage,
        payAtCounterWindowMinutes: settings.payAtCounterWindowMinutes ?? 30,
        defaultDailyCoinSpendLimit: settings.defaultDailyCoinSpendLimit ?? 800,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const {
      visitorRescheduleHours,
      visitorCancellationHours,
      memberRescheduleHours,
      memberCancellationHours,
      billingLetterheadUrl,
      maxVisitorCoinUsagePercentage,
      payAtCounterWindowMinutes,
      defaultDailyCoinSpendLimit,
    } = body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    if (typeof visitorRescheduleHours === "number") settings.visitorRescheduleHours = visitorRescheduleHours;
    if (typeof visitorCancellationHours === "number") settings.visitorCancellationHours = visitorCancellationHours;
    if (typeof memberRescheduleHours === "number") settings.memberRescheduleHours = memberRescheduleHours;
    if (typeof memberCancellationHours === "number") settings.memberCancellationHours = memberCancellationHours;
    if (typeof billingLetterheadUrl === "string") settings.billingLetterheadUrl = billingLetterheadUrl;
    if (typeof maxVisitorCoinUsagePercentage === "number") settings.maxVisitorCoinUsagePercentage = maxVisitorCoinUsagePercentage;
    if (typeof payAtCounterWindowMinutes === "number") settings.payAtCounterWindowMinutes = payAtCounterWindowMinutes;
    if (typeof defaultDailyCoinSpendLimit === "number") settings.defaultDailyCoinSpendLimit = defaultDailyCoinSpendLimit;

    await settings.save();

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: {
        visitorRescheduleHours: settings.visitorRescheduleHours,
        visitorCancellationHours: settings.visitorCancellationHours,
        memberRescheduleHours: settings.memberRescheduleHours,
        memberCancellationHours: settings.memberCancellationHours,
        billingLetterheadUrl: settings.billingLetterheadUrl,
        maxVisitorCoinUsagePercentage: settings.maxVisitorCoinUsagePercentage,
        payAtCounterWindowMinutes: settings.payAtCounterWindowMinutes ?? 30,
        defaultDailyCoinSpendLimit: settings.defaultDailyCoinSpendLimit ?? 800,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update settings" }, { status: 500 });
  }
}
