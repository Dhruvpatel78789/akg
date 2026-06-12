import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { CompanyEmployee } from "@/models/CompanyEmployee";
import { Company } from "@/models/Company";
import { SessionEntry } from "@/models/SessionEntry";

import { Game } from "@/models/Game";

async function populateGroupPlayers(sessionEntries: any[]) {
  if (!sessionEntries || sessionEntries.length === 0) return;

  const groupIds = sessionEntries
    .map(e => e.bookingGroupId)
    .filter((id): id is string => !!id);

  if (groupIds.length === 0) return;

  // Find all entries in these groups
  const allGroupEntries = await SessionEntry.find({
    bookingGroupId: { $in: groupIds },
    softDeleted: false,
  })
    .populate({
      path: "companyEmployeeId",
      select: "employeeId name mobile",
      model: CompanyEmployee
    })
    .lean();

  // Create a mapping of bookingGroupId -> player details
  const groupMap = new Map<string, any[]>();
  for (const entry of allGroupEntries) {
    const gid = entry.bookingGroupId;
    if (!gid) continue;

    const empInfo = entry.companyEmployeeId as any;
    const maskedMobile = entry.mobile 
      ? (entry.mobile.slice(0, 5) + "*".repeat(Math.max(0, entry.mobile.length - 5)))
      : "";

    const playerDetail = {
      playerName: entry.playerName,
      employeeId: empInfo?.employeeId || "N/A",
      mobile: maskedMobile,
      companyEmployeeId: entry.companyEmployeeId?._id?.toString() || entry.companyEmployeeId || "",
    };

    if (!groupMap.has(gid)) {
      groupMap.set(gid, []);
    }
    groupMap.get(gid)!.push(playerDetail);
  }

  // Attach groupPlayers and otherPlayers to each session entry
  for (const entry of sessionEntries) {
    const gid = entry.bookingGroupId;
    if (gid && groupMap.has(gid)) {
      const players = groupMap.get(gid) || [];
      entry.groupPlayers = players;
      entry.otherPlayers = players
        .filter(p => p.companyEmployeeId !== entry.companyEmployeeId?.toString())
        .map(p => p.playerName);
    } else {
      entry.groupPlayers = [];
      entry.otherPlayers = [];
    }
  }
}

export async function GET() {
  await connectDB();

  const authUser = await getAuthUser();

  if (!authUser || authUser.role !== "COMPANY_EMPLOYEE") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const employee = await CompanyEmployee.findById(authUser.userId);
  if (!employee || employee.softDeleted || employee.status !== "ACTIVE") {
    return NextResponse.json({ message: "Employee not found or inactive" }, { status: 401 });
  }

  const company = await Company.findById(employee.companyId).populate("allowedGameIds");
  if (!company || company.softDeleted || company.status !== "ACTIVE") {
    return NextResponse.json({ message: "Company not found or inactive" }, { status: 403 });
  }

  const now = new Date();

  // Find active session
  const activeSessionObj = await SessionEntry.findOne({
    companyEmployeeId: employee._id,
    status: "STARTED",
    softDeleted: false,
  }).lean();

  const activeSession = activeSessionObj ? { ...activeSessionObj } : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Today's upcoming sessions
  const todayUpcomingSessions = await SessionEntry.find({
    companyEmployeeId: employee._id,
    status: "BOOKED",
    startTime: { $gte: todayStart, $lte: todayEnd },
    softDeleted: false,
  })
    .sort({ startTime: 1 })
    .lean();

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  nextMonthEnd.setHours(23, 59, 59, 999);

  // Calendar sessions
  const calendarSessions = await SessionEntry.find({
    companyEmployeeId: employee._id,
    status: { $in: ["BOOKED", "STARTED"] },
    startTime: { $gte: currentMonthStart, $lte: nextMonthEnd },
    softDeleted: false,
  })
    .select("_id gameName court startTime endTime status bookedDurationMinutes bookingGroupId companyEmployeeId")
    .sort({ startTime: 1 })
    .lean();

  // Play history
  const playHistory = await SessionEntry.find({
    companyEmployeeId: employee._id,
    status: { $in: ["COMPLETED", "CANCELLED"] },
    softDeleted: false,
  })
    .sort({ exitedTime: -1, createdAt: -1 })
    .limit(20)
    .lean();

  // Populate group players info for all retrieved lists
  if (activeSession) await populateGroupPlayers([activeSession]);
  await populateGroupPlayers(todayUpcomingSessions);
  await populateGroupPlayers(calendarSessions);
  await populateGroupPlayers(playHistory);

  // Total completed seconds
  const totalCompletedPlaySeconds = playHistory.reduce((total, entry: any) => {
    if (!entry.startTime || !entry.exitedTime) return total;
    const start = new Date(entry.startTime).getTime();
    const end = new Date(entry.exitedTime).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return total;
    return total + Math.floor((end - start) / 1000);
  }, 0);

  const activeSessionSeconds = activeSession?.startTime
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(activeSession.startTime).getTime()) / 1000
        )
      )
    : 0;

  const totalPlaySeconds = totalCompletedPlaySeconds + activeSessionSeconds;

  return NextResponse.json({
    user: {
      id: employee._id.toString(),
      name: employee.name,
      email: employee.email,
      phone: employee.mobile,
      role: "COMPANY_EMPLOYEE",
      companyId: employee.companyId.toString(),
      companyName: company.name,
      mustChangePassword: employee.mustChangePassword,
    },
    allowedGames: company.allowedGameIds || [],
    activeSession,
    todayUpcomingSessions,
    calendarSessions,
    playHistory,
    totalPlaySeconds,
    currentPlaySeconds: activeSessionSeconds,
    serverTime: now,
  });
}
