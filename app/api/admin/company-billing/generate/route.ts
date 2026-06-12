import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Company } from "@/models/Company";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import { SessionEntry } from "@/models/SessionEntry";
import { CompanyBill } from "@/models/CompanyBill";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();

  try {
    const { companyId, startDate, endDate, letterPadHeader } = await request.json();

    if (!companyId || !startDate || !endDate) {
      return NextResponse.json(
        { message: "Missing required fields: companyId, startDate, endDate" },
        { status: 400 }
      );
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return NextResponse.json({ message: "Company not found" }, { status: 404 });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Find all completed/started/booked corporate session entries in range
    const entries = await SessionEntry.find({
      companyId,
      startTime: { $gte: start, $lte: end },
      status: { $in: ["COMPLETED", "STARTED", "BOOKED"] },
      softDeleted: false,
    }).lean();

    if (entries.length === 0) {
      return NextResponse.json(
        { message: "No billable session entries found in the selected range" },
        { status: 400 }
      );
    }

    const items = [];
    let subtotalAmount = 0;
    const employeeIdsSet = new Set<string>();

    for (const entry of entries) {
      const game = await Game.findById(entry.gameId).lean();
      const baseUnitMinutes = game ? game.duration : 60;

      // Find pricing rule closest to duration & 1 player
      const rule = await PricingRule.findOne({
        gameId: entry.gameId,
        minPlayers: { $lte: 1 },
        maxPlayers: { $gte: 1 },
      }).lean();

      // Determine price per unit (fallback to default 500)
      let ratePerUnit = 500;
      if (rule) {
        if (rule.mode === "PER_PLAYER") {
          ratePerUnit = rule.pricePerPlayer || 500;
        } else {
          ratePerUnit = (rule.baseCourtPrice || 0) + (rule.pricePerPlayer || 0);
        }
      }

      // Check if there is a company discount override for this game
      let itemBaseAmount = ratePerUnit;
      let gameDiscountApplied = 0;
      const customDiscount = company.gameDiscounts?.find(
        (gd: any) => gd.gameId.toString() === entry.gameId.toString()
      );

      if (customDiscount) {
        if (customDiscount.discountType === "FLAT") {
          gameDiscountApplied = customDiscount.discountValue;
        } else if (customDiscount.discountType === "PERCENTAGE") {
          gameDiscountApplied = Math.round(ratePerUnit * (customDiscount.discountValue / 100));
        }
      }

      const finalRatePerUnit = Math.max(0, ratePerUnit - gameDiscountApplied);

      // Calculate units and amount
      const actualPlayTime = entry.exitedTime
        ? Math.round((new Date(entry.exitedTime).getTime() - new Date(entry.startTime).getTime()) / (60 * 1000))
        : entry.bookedDurationMinutes;

      const units = entry.billableSessionUnits || Math.ceil(actualPlayTime / baseUnitMinutes);
      const amount = finalRatePerUnit * units;

      let employeeId = "";
      if (entry.companyEmployeeId) {
        const empObj = await CompanyEmployee.findById(entry.companyEmployeeId).lean();
        if (empObj) {
          employeeId = empObj.employeeId;
        }
      }

      items.push({
        sessionEntryId: entry._id,
        employeeName: entry.playerName,
        employeeId: employeeId || "N/A",
        gameId: entry.gameId.toString(),
        gameName: entry.gameName,
        date: entry.startTime,
        startTime: entry.startTime,
        endTime: entry.exitedTime || entry.endTime,
        actualDuration: actualPlayTime,
        billableUnits: units,
        originalRate: ratePerUnit,
        gameDiscount: gameDiscountApplied,
        amount,
      });

      subtotalAmount += ratePerUnit * units;
      employeeIdsSet.add(entry.companyEmployeeId?.toString() || "");
    }

    // Now calculate game discounts total vs company invoice discount
    let totalGameDiscountsAmount = 0;
    let actualDiscountedSubtotal = 0;
    for (const item of items) {
      totalGameDiscountsAmount += item.gameDiscount * item.billableUnits;
      actualDiscountedSubtotal += item.amount;
    }

    const discountPercentage = company.discountPercentage || 0;
    const discountAmount = Math.round(actualDiscountedSubtotal * (discountPercentage / 100));
    const totalAmount = actualDiscountedSubtotal - discountAmount;

    // Create draft CompanyBill
    const bill = new CompanyBill({
      companyId,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      totalPlayers: employeeIdsSet.size,
      totalSessions: items.length,
      subtotalAmount, // original rate * units sum
      discountAmount: discountAmount + totalGameDiscountsAmount, // total discount combines game discounts + company percentage discount
      totalAmount,
      letterPadHeader: letterPadHeader || "",
      status: "DRAFT",
      items,
    });

    await bill.save();

    return NextResponse.json({
      success: true,
      message: "Draft bill generated successfully",
      bill,
    });
  } catch (err: any) {
    console.error("Generate billing error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
