import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Company } from "@/models/Company";
import { Game } from "@/models/Game";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import { SessionEntry } from "@/models/SessionEntry";
import { PricingRule } from "@/models/PricingRule";

// GET handler
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const gameId = searchParams.get("gameId");
    const date = searchParams.get("date");
    const player = searchParams.get("player");
    const status = searchParams.get("status");
    const showDeleted = searchParams.get("showDeleted") === "true";

    const query: any = {};

    if (!showDeleted) {
      query.softDeleted = false;
    }

    if (companyId) {
      query.companyId = companyId;
    }

    if (gameId) {
      query.gameId = gameId;
    }

    if (status) {
      query.status = status;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    }

    if (player) {
      query.$or = [
        { playerName: { $regex: player, $options: "i" } },
        { mobile: { $regex: player, $options: "i" } },
      ];
    }

    const entries = await SessionEntry.find(query)
      .populate("companyId", "name colorCode")
      .sort({ startTime: -1 })
      .lean();

    return NextResponse.json({ success: true, entries });
  } catch (err: any) {
    console.error("GET company entries admin error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST handler (handles Manual Entry, CSV Import, and Random Generation)
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();

  try {
    const body = await request.json();
    const { action } = body;

    // A. MANUAL CREATION ACTION
    if (action === "MANUAL") {
      const { companyId, companyEmployeeId, gameId, court, date, startTime, durationMinutes, status } = body;
      
      if (!companyId || !companyEmployeeId || !gameId || !court || !date || !startTime || !durationMinutes) {
        return NextResponse.json({ success: false, message: "Missing required fields for manual entry" }, { status: 400 });
      }

      const company = await Company.findById(companyId);
      const employee = await CompanyEmployee.findById(companyEmployeeId);
      const game = await Game.findById(gameId);

      if (!company || !employee || !game) {
        return NextResponse.json({ success: false, message: "Company, Employee, or Game not found" }, { status: 404 });
      }

      const combinedStart = new Date(`${date}T${startTime}`);
      const combinedEnd = new Date(combinedStart.getTime() + durationMinutes * 60000);

      // Fetch base rate for pricing calculations
      const rule = await PricingRule.findOne({
        gameId,
        minPlayers: { $lte: 1 },
        maxPlayers: { $gte: 1 },
      }).lean();

      let ratePerUnit = 500;
      if (rule) {
        if (rule.mode === "PER_PLAYER") {
          ratePerUnit = rule.pricePerPlayer || 500;
        } else {
          ratePerUnit = (rule.baseCourtPrice || 0) + (rule.pricePerPlayer || 0);
        }
      }

      // Check game discount override
      let gameDiscountApplied = 0;
      const customDiscount = company.gameDiscounts?.find(
        (gd: any) => gd.gameId.toString() === gameId.toString()
      );

      if (customDiscount) {
        if (customDiscount.discountType === "FLAT") {
          gameDiscountApplied = customDiscount.discountValue;
        } else if (customDiscount.discountType === "PERCENTAGE") {
          gameDiscountApplied = Math.round(ratePerUnit * (customDiscount.discountValue / 100));
        }
      }

      const baseUnitMinutes = game.duration || 60;
      const units = Math.ceil(durationMinutes / baseUnitMinutes);

      const entry = await SessionEntry.create({
        bookingGroupId: `manual-${Date.now()}`,
        userType: "COMPANY_EMPLOYEE",
        playerName: employee.name,
        mobile: employee.mobile,
        companyId,
        companyEmployeeId,
        gameId,
        gameName: game.name,
        court,
        startTime: combinedStart,
        endTime: combinedEnd,
        bookedDurationMinutes: durationMinutes,
        actualDurationMinutes: durationMinutes,
        billableSessionUnits: units,
        status: status || "BOOKED",
        softDeleted: false,
      });

      return NextResponse.json({ success: true, entry });
    }

    // B. CSV IMPORT ACTION
    if (action === "CSV") {
      const { companyId, rows } = body; // Rows: [{ employeeId, gameName, date, startTime, durationMinutes }]
      if (!companyId || !rows || !Array.isArray(rows)) {
        return NextResponse.json({ success: false, message: "Invalid parameters" }, { status: 400 });
      }

      const company = await Company.findById(companyId);
      if (!company) {
        return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
      }

      const gamesList = await Game.find({ softDeleted: false }).lean();
      const employees = await CompanyEmployee.find({ companyId, softDeleted: false }).lean();

      const createdEntries = [];
      const rejectedRows = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const emp = employees.find(e => e.employeeId === row.employeeId);
        const game = gamesList.find(g => g.name.toLowerCase() === row.gameName?.toLowerCase());

        if (!emp) {
          rejectedRows.push({ rowIndex: i + 1, error: `Employee ID ${row.employeeId} not found in this company` });
          continue;
        }

        if (!game) {
          rejectedRows.push({ rowIndex: i + 1, error: `Game ${row.gameName} is not a valid Akshar Game Zone game` });
          continue;
        }

        if (!company.allowedGameIds.some((gId: any) => gId.toString() === game._id.toString())) {
          rejectedRows.push({ rowIndex: i + 1, error: `Game ${row.gameName} is not permitted for company bookings` });
          continue;
        }

        const duration = Number(row.durationMinutes);
        if (isNaN(duration) || duration <= 0) {
          rejectedRows.push({ rowIndex: i + 1, error: `Invalid duration: ${row.durationMinutes}` });
          continue;
        }

        try {
          const combinedStart = new Date(`${row.date}T${row.startTime}`);
          if (isNaN(combinedStart.getTime())) {
            rejectedRows.push({ rowIndex: i + 1, error: `Invalid date or start time: ${row.date} ${row.startTime}` });
            continue;
          }

          const combinedEnd = new Date(combinedStart.getTime() + duration * 60000);
          const baseUnitMinutes = game.duration || 60;
          const units = Math.ceil(duration / baseUnitMinutes);

          const entry = await SessionEntry.create({
            bookingGroupId: `csv-${Date.now()}-${i}`,
            userType: "COMPANY_EMPLOYEE",
            playerName: emp.name,
            mobile: emp.mobile,
            companyId,
            companyEmployeeId: emp._id,
            gameId: game._id,
            gameName: game.name,
            court: row.court || "Court A",
            startTime: combinedStart,
            endTime: combinedEnd,
            bookedDurationMinutes: duration,
            actualDurationMinutes: duration,
            billableSessionUnits: units,
            status: "COMPLETED",
            softDeleted: false,
          });

          createdEntries.push(entry);
        } catch (err: any) {
          rejectedRows.push({ rowIndex: i + 1, error: err.message || "Failed to create entry" });
        }
      }

      return NextResponse.json({
        success: true,
        successCount: createdEntries.length,
        rejectedCount: rejectedRows.length,
        rejectedRows,
      });
    }

    // C. RANDOM GENERATION ACTIONS (MODE A & MODE B)
    if (action === "GENERATE_RANDOM") {
      const { companyId, selectedEmployeeIds, targetAmount, entriesCount, startDate, endDate, mode } = body;
      
      if (!companyId || !targetAmount || !entriesCount || !startDate || !endDate) {
        return NextResponse.json({ success: false, message: "Missing generator parameters" }, { status: 400 });
      }

      const company = await Company.findById(companyId);
      if (!company) {
        return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
      }

      // Fetch employees
      let employees = [];
      if (mode === "B" && selectedEmployeeIds && selectedEmployeeIds.length > 0) {
        employees = await CompanyEmployee.find({ _id: { $in: selectedEmployeeIds }, companyId, softDeleted: false }).lean();
      } else {
        employees = await CompanyEmployee.find({ companyId, softDeleted: false }).lean();
      }

      if (employees.length === 0) {
        return NextResponse.json({ success: false, message: "No eligible employees found for generation" }, { status: 400 });
      }

      // Filter games list to only include allowed games (fallback to all games if allowedGameIds is empty)
      const configuredGames = company.allowedGameIds || [];
      let allowedGames: any[] = [];
      if (configuredGames.length > 0) {
        allowedGames = await Game.find({ _id: { $in: configuredGames }, softDeleted: false }).lean();
      }
      if (allowedGames.length === 0) {
        allowedGames = await Game.find({ softDeleted: false }).lean();
      }

      console.log("Company:", company.name);
      console.log("Configured Games:", configuredGames);
      console.log("Allowed Games:", allowedGames);

      if (allowedGames.length === 0) {
        return NextResponse.json({ success: false, message: "No allowed games configured for this company" }, { status: 400 });
      }

      // Calculate approximate amount per entry
      const targetPerEntry = Math.round(Number(targetAmount) / Number(entriesCount));
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();

      const createdEntries = [];
      const courts = ["Court A", "Court B", "Court C"];

      for (let i = 0; i < entriesCount; i++) {
        // Pick random employee
        const emp = employees[Math.floor(Math.random() * employees.length)];
        
        // Pick random game
        const game = allowedGames[Math.floor(Math.random() * allowedGames.length)];
        
        // Pick random date within range
        const randomTime = startMs + Math.random() * (endMs - startMs);
        const randomStart = new Date(randomTime);
        randomStart.setMinutes(Math.random() > 0.5 ? 30 : 0, 0, 0); // align to clean 30-min marks
        
        // Pick duration: 60, 90, 120
        const duration = [60, 90, 120][Math.floor(Math.random() * 3)];
        const randomEnd = new Date(randomStart.getTime() + duration * 60000);

        const units = Math.ceil(duration / (game.duration || 60));

        const entry = await SessionEntry.create({
          bookingGroupId: `random-${Date.now()}-${i}`,
          userType: "COMPANY_EMPLOYEE",
          playerName: emp.name,
          mobile: emp.mobile,
          companyId,
          companyEmployeeId: emp._id,
          gameId: game._id,
          gameName: game.name,
          court: courts[Math.floor(Math.random() * courts.length)],
          startTime: randomStart,
          endTime: randomEnd,
          bookedDurationMinutes: duration,
          actualDurationMinutes: duration,
          billableSessionUnits: units,
          status: "COMPLETED",
          softDeleted: false,
        });

        createdEntries.push(entry);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully generated ${createdEntries.length} random session entries`,
        count: createdEntries.length,
      });
    }

    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST company entries admin error:", err);
    return NextResponse.json(
      { message: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
