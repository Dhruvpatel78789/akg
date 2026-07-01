import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import { Company } from "@/models/Company";
import { Game } from "@/models/Game";
import { Court } from "@/models/court";
import { CourtBlock } from "@/models/CourtBlock";
import { Booking } from "@/models/Booking";
import { SessionEntry } from "@/models/SessionEntry";
import mongoose from "mongoose";

import { parseIST } from "@/lib/time";

function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  return parseIST(dateStr, timeStr, addDays);
}


export async function POST(request: Request) {
  await connectDB();

  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== "COMPANY_EMPLOYEE") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { gameId, date, startTime, endTime, coPlayerIds } = await request.json();

    if (!gameId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { message: "Missing required fields: gameId, date, startTime, endTime" },
        { status: 400 }
      );
    }

    const employee = await CompanyEmployee.findById(authUser.userId);
    if (!employee || employee.softDeleted || employee.status !== "ACTIVE") {
      return NextResponse.json({ message: "Employee not found or inactive" }, { status: 401 });
    }

    const company = await Company.findById(employee.companyId);
    if (!company || company.softDeleted || company.status !== "ACTIVE") {
      return NextResponse.json({ message: "Company not found or inactive" }, { status: 403 });
    }

    // Check game restriction
    if (company.allowedGameIds && company.allowedGameIds.length > 0) {
      const isAllowed = company.allowedGameIds.some(
        (id: any) => id.toString() === gameId
      );
      if (!isAllowed) {
        return NextResponse.json(
          { message: "Your company is not authorized to book this game" },
          { status: 403 }
        );
      }
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return NextResponse.json({ message: "Game not found" }, { status: 404 });
    }

    if (game.fixedSlotBooking) {
      const { validateFixedSlot } = await import("@/lib/fixed-slots");
      if (!validateFixedSlot(startTime, game.duration)) {
        return NextResponse.json({
          message: "This game only allows fixed slot bookings. Please select a valid slot time."
        }, { status: 400 });
      }
    }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const crossMidnight = (eh * 60 + em) < (sh * 60 + sm);

    const bookingStart = parseDateTime(date, startTime);
    const bookingEnd = parseDateTime(date, endTime, crossMidnight ? 1 : 0);


    if (bookingStart.getTime() < Date.now() - 2 * 60 * 1000) {
      return NextResponse.json({ message: "Cannot book a slot in the past. Please select a future date and time." }, { status: 400 });
    }

    if (bookingEnd <= bookingStart) {
      return NextResponse.json({ message: "End time must be after start time" }, { status: 400 });
    }

    const durationMinutes = Math.round((bookingEnd.getTime() - bookingStart.getTime()) / (60 * 1000));

    // Get courts
    const courts = await Court.find({ gameId, active: true }).lean();
    if (courts.length === 0) {
      return NextResponse.json({ message: "No active courts configured for this game" }, { status: 400 });
    }

    // Check overlapping bookings
    const overlappingBookings = await Booking.find({
      status: { $in: ["BOOKED", "STARTED"] },
      softDeleted: false,
      startTime: { $lt: bookingEnd },
      endTime: { $gt: bookingStart },
      paymentStatus: { $ne: "FAILED" }
    }).lean();

    // Check overlapping blocks
    const overlappingBlocks = await CourtBlock.find({
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      $or: [
        { blockedFrom: { $lt: bookingEnd }, blockedTo: { $gt: bookingStart } }
      ]
    }).lean();

    let assignedCourtName = "";
    for (const court of courts) {
      const isBooked = overlappingBookings.some((b) => b.court?.trim().toLowerCase() === court.name.trim().toLowerCase());
      const isBlocked = overlappingBlocks.some((bl) => bl.courtId.toString() === court._id.toString());

      if (!isBooked && !isBlocked) {
        assignedCourtName = court.name;
        break;
      }
    }

    if (!assignedCourtName) {
      return NextResponse.json(
        { message: "No court is available for the selected slot" },
        { status: 400 }
      );
    }

    // Retrieve co-players details
    const cleanCoPlayerIds = (coPlayerIds || []).filter((id: string) => id && id !== employee._id.toString());
    const coEmployees = await CompanyEmployee.find({
      _id: { $in: cleanCoPlayerIds },
      companyId: company._id,
      softDeleted: false,
      status: "ACTIVE",
    }).lean();

    const bookingGroupId = new mongoose.Types.ObjectId().toString();

    // Create the main Booking record
    const booking = new Booking({
      userId: employee._id, // Use employee _id
      companyId: company._id,
      companyEmployeeId: employee._id,
      gameId: game._id,
      gameName: game.name,
      court: assignedCourtName,
      startTime: bookingStart,
      endTime: bookingEnd,
      status: "BOOKED",
      playersCount: 1 + coEmployees.length,
      playerType: "COMPANY",
      paymentMode: "online",
      paymentStatus: "PAID",
      price: 0,
      coinCost: 0,
      crossMidnight,
    });


    await booking.save();

    // Insert separate SessionEntry record for every player (creator + co-players)
    const sessionEntries = [];

    // Creator's session entry
    sessionEntries.push(
      new SessionEntry({
        bookingId: booking._id,
        bookingGroupId,
        userType: "COMPANY_EMPLOYEE",
        companyId: company._id,
        companyEmployeeId: employee._id,
        playerName: employee.name,
        mobile: employee.mobile,
        gameId: game._id,
        gameName: game.name,
        court: assignedCourtName,
        startTime: bookingStart,
        endTime: bookingEnd,
        bookedDurationMinutes: durationMinutes,
        status: "BOOKED",
      })
    );

    // Co-players session entries
    for (const coEmp of coEmployees) {
      sessionEntries.push(
        new SessionEntry({
          bookingId: booking._id,
          bookingGroupId,
          userType: "COMPANY_EMPLOYEE",
          companyId: company._id,
          companyEmployeeId: coEmp._id,
          playerName: coEmp.name,
          mobile: coEmp.mobile,
          gameId: game._id,
          gameName: game.name,
          court: assignedCourtName,
          startTime: bookingStart,
          endTime: bookingEnd,
          bookedDurationMinutes: durationMinutes,
          status: "BOOKED",
        })
      );
    }

    await SessionEntry.insertMany(sessionEntries);

    return NextResponse.json({
      success: true,
      message: "Corporate booking created successfully",
      bookingId: booking._id,
    });
  } catch (error: any) {
    console.error("Corporate booking submit error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
