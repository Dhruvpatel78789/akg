import { Court } from "@/models/court";
import { Booking } from "@/models/Booking";
import { CourtBlock } from "@/models/CourtBlock";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
import { RecurringCourtBlock } from "@/models/RecurringCourtBlock";
import { DependencyBlock } from "@/models/DependencyBlock";
import { CourtHold } from "@/models/CourtHold";
import mongoose from "mongoose";

import { parseIST } from "@/lib/time";

export function parseDateTime(dateStr: string, timeStr: string, addDays: number = 0) {
  return parseIST(dateStr, timeStr, addDays);
}

export function calculateBasePrice(rule: any, playersIncluded: number) {
  if (rule.mode === "PER_PLAYER") {
    return playersIncluded * rule.pricePerPlayer;
  }
  return rule.baseCourtPrice + playersIncluded * rule.pricePerPlayer;
}

export async function checkCourtAvailability(gameId: string, bookingStart: Date, bookingEnd: Date, excludeBookingId?: string) {
  // 1. Dependency block check (if this game is blocked by another booking's dependency block)
  const depBlocks = await DependencyBlock.find({
    blockedGameId: gameId,
    status: "ACTIVE",
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart }
  }).lean();

  const activeDepBlocks = excludeBookingId
    ? depBlocks.filter((db: any) => db.sourceBookingId.toString() !== excludeBookingId)
    : depBlocks;

  if (activeDepBlocks.length > 0) {
    return { available: false, reason: "Shared courts are occupied." };
  }

  // 2. Dependent games check (if this game blocks other games, check if those games are booked/blocked)
  const currentGame = await Game.findById(gameId).lean();
  if (currentGame && (currentGame as any).blockedGameIds && (currentGame as any).blockedGameIds.length > 0) {
    const dependentGameIds = (currentGame as any).blockedGameIds;

    // Check if any dependent game has active bookings
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const overlappingDepBookings = await Booking.find({
      gameId: { $in: dependentGameIds },
      status: { $in: ["BOOKED", "STARTED"] },
      softDeleted: false,
      startTime: { $lt: bookingEnd },
      endTime: { $gt: bookingStart },
      $or: [
        { paymentStatus: "PAID" },
        { paymentMethod: "PAY_AT_COUNTER" },
        { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } },
        { paymentStatus: "PENDING", intentExpiresAt: { $gt: new Date() } }
      ],
      ...(excludeBookingId ? { _id: { $ne: new mongoose.Types.ObjectId(excludeBookingId) } } : {})
    }).lean();

    if (overlappingDepBookings.length > 0) {
      return { available: false, reason: "Shared courts are occupied." };
    }

    // Check if any dependent game has scheduled court blocks
    const overlappingDepBlocks = await CourtBlock.find({
      gameId: { $in: dependentGameIds },
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      blockedFrom: { $lt: bookingEnd },
      blockedTo: { $gt: bookingStart }
    }).lean();

    if (overlappingDepBlocks.length > 0) {
      return { available: false, reason: "Shared courts are occupied." };
    }

    // Check if any dependent game has recurring court blocks on this day
    const depRecurringBlocks = await RecurringCourtBlock.find({
      gameId: { $in: dependentGameIds },
      active: true,
      softDeleted: { $ne: true }
    }).lean();

    if (depRecurringBlocks.length > 0) {
      const hasDepRecurringOverlap = depRecurringBlocks.some((rb: any) => {
        if (rb.startDate && bookingStart < new Date(rb.startDate)) return false;
        if (rb.endDate && bookingEnd > new Date(rb.endDate)) return false;

        const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

        const checkOverlapForAnchorDate = (anchorDate: Date) => {
          const dayName = DAYS_OF_WEEK[anchorDate.getDay()];
          if (!rb.daysOfWeek.includes(dayName)) return false;

          const [sh, sm] = rb.startTime.split(":").map(Number);
          const [eh, em] = rb.endTime.split(":").map(Number);

          const blockStart = new Date(anchorDate);
          blockStart.setHours(sh, sm, 0, 0);

          const blockEnd = new Date(anchorDate);
          blockEnd.setHours(eh, em, 0, 0);

          if (eh < sh || (eh === sh && em < sm)) {
            blockEnd.setDate(blockEnd.getDate() + 1);
          }

          return bookingStart < blockEnd && bookingEnd > blockStart;
        };

        const today = new Date(bookingStart);
        const yesterday = new Date(bookingStart);
        yesterday.setDate(yesterday.getDate() - 1);

        return checkOverlapForAnchorDate(today) || checkOverlapForAnchorDate(yesterday);
      });

      if (hasDepRecurringOverlap) {
        return { available: false, reason: "Shared courts are occupied." };
      }
    }
  }

  // Include pending bookings created within the last 10 minutes (reserved slots)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const bookingQuery: any = {
    gameId,
    status: { $in: ["BOOKED", "STARTED"] },
    softDeleted: false,
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart },
    $or: [
      { paymentStatus: "PAID" },
      { paymentMethod: "PAY_AT_COUNTER" },
      { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } },
      { paymentStatus: "PENDING", intentExpiresAt: { $gt: new Date() } }
    ]
  };

  if (excludeBookingId) {
    bookingQuery._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  // Fetch all database records concurrently in parallel
  const [courts, overlappingBookings, overlappingBlocks, recurringBlocks, overlappingHolds, existingBooking] = await Promise.all([
    Court.find({ gameId, active: true, disabled: { $ne: true } }).lean(),
    Booking.find(bookingQuery).lean(),
    CourtBlock.find({
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      blockedFrom: { $lt: bookingEnd },
      blockedTo: { $gt: bookingStart }
    }).lean(),
    RecurringCourtBlock.find({
      gameId,
      active: true,
      softDeleted: { $ne: true }
    }).lean(),
    CourtHold.find({
      startTime: { $lt: bookingEnd },
      endTime: { $gt: bookingStart },
      holdExpiresAt: { $gt: new Date() },
      status: "HELD"
    }).lean(),
    excludeBookingId && mongoose.Types.ObjectId.isValid(excludeBookingId)
      ? Booking.findById(excludeBookingId).lean()
      : Promise.resolve(null)
  ]);

  if (courts.length === 0) {
    return { available: false, reason: "No active courts configured for this game" };
  }

  for (const court of courts) {
    const isBooked = overlappingBookings.some((b) => b.court?.trim().toLowerCase() === court.name.trim().toLowerCase());
    
    // Ignore blocks that are configured to keep existing bookings if our booking is pre-existing (createdAt < block.createdAt)
    const isBlocked = overlappingBlocks.some((bl) => {
      if (bl.courtId.toString() !== court._id.toString()) return false;
      if (bl.keepExistingBookings) {
        // If our booking was created before the court block was created, we can play!
        if (existingBooking && new Date((existingBooking as any).createdAt) < new Date(bl.createdAt)) {
          return false; // ignore block
        }
      }
      return true;
    });

    const isRecurringBlocked = recurringBlocks.some((rb: any) => {
      if (rb.courtId.toString() !== court._id.toString()) return false;

      // Date range boundary validations
      if (rb.startDate && bookingStart < new Date(rb.startDate)) return false;
      if (rb.endDate && bookingEnd > new Date(rb.endDate)) return false;

      const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

      const checkOverlapForAnchorDate = (anchorDate: Date) => {
        const dayName = DAYS_OF_WEEK[anchorDate.getDay()];
        if (!rb.daysOfWeek.includes(dayName)) return false;

        const [sh, sm] = rb.startTime.split(":").map(Number);
        const [eh, em] = rb.endTime.split(":").map(Number);

        const blockStart = new Date(anchorDate);
        blockStart.setHours(sh, sm, 0, 0);

        const blockEnd = new Date(anchorDate);
        blockEnd.setHours(eh, em, 0, 0);

        if (eh < sh || (eh === sh && em < sm)) {
          blockEnd.setDate(blockEnd.getDate() + 1);
        }

        return bookingStart < blockEnd && bookingEnd > blockStart;
      };

      const today = new Date(bookingStart);
      const yesterday = new Date(bookingStart);
      yesterday.setDate(yesterday.getDate() - 1);

      return checkOverlapForAnchorDate(today) || checkOverlapForAnchorDate(yesterday);
    });

    const isHeld = overlappingHolds.some((h: any) => h.courtId.toString() === court._id.toString());

    if (!isBooked && !isBlocked && !isRecurringBlocked && !isHeld) {
      return { available: true, courtName: court.name };
    }
  }

  return { available: false, reason: "All courts are fully booked or blocked for this slot" };
}

export async function checkCourtsStatus(gameId: string, bookingStart: Date, bookingEnd: Date, excludeBookingId?: string) {
  const courts = await Court.find({ gameId }).lean();
  if (courts.length === 0) {
    return [];
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const bookingQuery: any = {
    gameId,
    status: { $in: ["BOOKED", "STARTED"] },
    softDeleted: false,
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart },
    $or: [
      { paymentStatus: "PAID" },
      { paymentMethod: "PAY_AT_COUNTER" },
      { paymentStatus: "PENDING", createdAt: { $gte: tenMinutesAgo } },
      { paymentStatus: "PENDING", intentExpiresAt: { $gt: new Date() } }
    ]
  };
  if (excludeBookingId) {
    bookingQuery._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  const [overlappingBookings, overlappingBlocks, recurringBlocks, overlappingHolds, existingBooking] = await Promise.all([
    Booking.find(bookingQuery).lean(),
    CourtBlock.find({
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      blockedFrom: { $lt: bookingEnd },
      blockedTo: { $gt: bookingStart }
    }).lean(),
    RecurringCourtBlock.find({
      gameId,
      active: true,
      softDeleted: { $ne: true }
    }).lean(),
    CourtHold.find({
      startTime: { $lt: bookingEnd },
      endTime: { $gt: bookingStart },
      holdExpiresAt: { $gt: new Date() },
      status: "HELD"
    }).lean(),
    excludeBookingId && mongoose.Types.ObjectId.isValid(excludeBookingId)
      ? Booking.findById(excludeBookingId).lean()
      : Promise.resolve(null)
  ]);

  return courts.map((court: any) => {
    // 1. Disabled
    if (!court.active || court.disabled) {
      return { courtId: court._id.toString(), courtName: court.name, status: "Disabled" };
    }

    // 2. Blocked
    const isBlocked = overlappingBlocks.some((bl) => {
      if (bl.courtId.toString() !== court._id.toString()) return false;
      if (bl.keepExistingBookings) {
        if (existingBooking && new Date((existingBooking as any).createdAt) < new Date(bl.createdAt)) {
          return false;
        }
      }
      return true;
    });
    if (isBlocked) {
      return { courtId: court._id.toString(), courtName: court.name, status: "Blocked" };
    }

    // 3. Recurring Blocked
    const isRecurringBlocked = recurringBlocks.some((rb: any) => {
      if (rb.courtId.toString() !== court._id.toString()) return false;
      if (rb.startDate && bookingStart < new Date(rb.startDate)) return false;
      if (rb.endDate && bookingEnd > new Date(rb.endDate)) return false;

      const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const checkOverlapForAnchorDate = (anchorDate: Date) => {
        const dayName = DAYS_OF_WEEK[anchorDate.getDay()];
        if (!rb.daysOfWeek.includes(dayName)) return false;

        const [sh, sm] = rb.startTime.split(":").map(Number);
        const [eh, em] = rb.endTime.split(":").map(Number);

        const blockStart = new Date(anchorDate);
        blockStart.setHours(sh, sm, 0, 0);

        const blockEnd = new Date(anchorDate);
        blockEnd.setHours(eh, em, 0, 0);

        if (eh < sh || (eh === sh && em < sm)) {
          blockEnd.setDate(blockEnd.getDate() + 1);
        }
        return bookingStart < blockEnd && bookingEnd > blockStart;
      };

      const today = new Date(bookingStart);
      const yesterday = new Date(bookingStart);
      yesterday.setDate(yesterday.getDate() - 1);
      return checkOverlapForAnchorDate(today) || checkOverlapForAnchorDate(yesterday);
    });
    if (isRecurringBlocked) {
      return { courtId: court._id.toString(), courtName: court.name, status: "Blocked" };
    }

    // 4. Taken
    const isBooked = overlappingBookings.some((b) => b.court?.trim().toLowerCase() === court.name.trim().toLowerCase());
    if (isBooked) {
      return { courtId: court._id.toString(), courtName: court.name, status: "Taken" };
    }

    // 5. Held
    const isHeld = overlappingHolds.some((h: any) => h.courtId.toString() === court._id.toString());
    if (isHeld) {
      return { courtId: court._id.toString(), courtName: court.name, status: "Held" };
    }

    return { courtId: court._id.toString(), courtName: court.name, status: "Available" };
  });
}

/**
 * Generate suggested alternative slots when the requested slot is unavailable.
 * Returns up to 4 suggested slots (2 before, 2 after if possible) in chronological order.
 */
export async function getAlternativeSlots(
  gameId: string,
  date: string,
  startTime: string,
  duration: number,
  playersCount: number
) {
  const game = await Game.findById(gameId).lean();
  if (!game) return [];

  const [sh, sm] = startTime.split(":").map(Number);
  const requestedStart = parseIST(date, startTime);
  const now = new Date();

  // Helper to format Date to IST date string
  const formatISTDate = (d: Date) => {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === "day")?.value || "01";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const year = parts.find((p) => p.type === "year")?.value || "1970";
    return `${year}-${month}-${day}`;
  };

  // Helper to format Date to IST time string
  const formatISTTime = (d: Date) => {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  };

  // Helpers to calculate relative offsets
  const addMinutes = (d: Date, mins: number) => {
    return new Date(d.getTime() + mins * 60 * 1000);
  };

  const results: Array<{ date: string; startTime: string; endTime: string; type: string }> = [];

  // ==========================================
  // PRIORITY 1: Nearby slots (Today / Midnight / Early Morning)
  // ==========================================
  const candidateStarts: Date[] = [];
  const minDuration = (game as any).duration || 60;
  const isFixed = (game as any).fixedSlotBooking;

  if (isFixed) {
    const baseDay = new Date(requestedStart);
    for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
      const d = new Date(baseDay.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dStr = formatISTDate(d);
      for (let mins = 0; mins < 1440; mins += minDuration) {
        const hh = Math.floor(mins / 60);
        const mm = mins % 60;
        const candidate = parseIST(dStr, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
        if (Math.abs(candidate.getTime() - requestedStart.getTime()) <= 6 * 60 * 60 * 1000) {
          candidateStarts.push(candidate);
        }
      }
    }
  } else {
    const windowStart = addMinutes(requestedStart, -6 * 60);
    const windowEnd = addMinutes(requestedStart, 6 * 60);
    let curr = new Date(windowStart);
    while (curr <= windowEnd) {
      candidateStarts.push(new Date(curr));
      curr = addMinutes(curr, 15);
    }

    const dependentGameIds = (game as any).blockedGameIds || [];
    const gameIdsToCheck = [gameId, ...dependentGameIds];

    const bookings = await Booking.find({
      gameId: { $in: gameIdsToCheck },
      status: { $in: ["BOOKED", "STARTED"] },
      softDeleted: false,
      startTime: { $lt: windowEnd },
      endTime: { $gt: windowStart }
    }).lean();

    const courtBlocks = await CourtBlock.find({
      gameId: { $in: gameIdsToCheck },
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      blockedFrom: { $lt: windowEnd },
      blockedTo: { $gt: windowStart }
    }).lean();

    bookings.forEach((b: any) => {
      if (b.endTime >= windowStart && b.endTime <= windowEnd) {
        candidateStarts.push(new Date(b.endTime));
      }
    });

    courtBlocks.forEach((bl: any) => {
      if (bl.blockedTo >= windowStart && bl.blockedTo <= windowEnd) {
        candidateStarts.push(new Date(bl.blockedTo));
      }
    });
  }

  const uniqueTimes = Array.from(new Set(candidateStarts.map(d => d.getTime())))
    .map(t => new Date(t))
    .filter(d => d.getTime() >= now.getTime() - 2 * 60 * 1000);

  uniqueTimes.sort((a, b) => {
    return Math.abs(a.getTime() - requestedStart.getTime()) - Math.abs(b.getTime() - requestedStart.getTime());
  });

  const targetDateStr = formatISTDate(requestedStart);

  for (const start of uniqueTimes) {
    if (results.length >= 3) break;
    if (start.getTime() === requestedStart.getTime()) continue;

    const end = addMinutes(start, duration);
    const check = await checkCourtAvailability(gameId, start, end);
    if (check.available) {
      const slotDateStr = formatISTDate(start);
      results.push({
        date: slotDateStr,
        startTime: formatISTTime(start),
        endTime: formatISTTime(end),
        type: slotDateStr === targetDateStr ? "Today" : "Nearby"
      });
    }
  }

  // ==========================================
  // PRIORITY 2: Same-Time Suggestions on Future Days
  // ==========================================
  const baseDay = new Date(requestedStart);
  for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
    const futureDay = new Date(baseDay.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const futureDayStr = formatISTDate(futureDay);

    let targetHours = sh;
    let targetMinutes = sm;

    const slotInterval = isFixed ? minDuration : 30;
    const totalMinutes = targetHours * 60 + targetMinutes;
    const remainder = totalMinutes % slotInterval;

    if (remainder !== 0) {
      const roundedMinutes = remainder < slotInterval / 2
        ? totalMinutes - remainder
        : totalMinutes + (slotInterval - remainder);
      targetHours = Math.floor(roundedMinutes / 60) % 24;
      targetMinutes = roundedMinutes % 60;
    }

    const preferredTimeStr = `${String(targetHours).padStart(2, "0")}:${String(targetMinutes).padStart(2, "0")}`;

    const findAvailableFutureSlot = async (prefTime: string) => {
      const prefStart = parseIST(futureDayStr, prefTime);
      const stepMinutes = isFixed ? minDuration : 30;

      const maxSweeps = 8;
      for (let sweep = 0; sweep <= maxSweeps; sweep++) {
        const offsets = sweep === 0 ? [0] : [sweep * stepMinutes, -sweep * stepMinutes];
        for (const offset of offsets) {
          const testStart = addMinutes(prefStart, offset);
          if (formatISTDate(testStart) === futureDayStr) {
            const testEnd = addMinutes(testStart, duration);
            const check = await checkCourtAvailability(gameId, testStart, testEnd);
            if (check.available) {
              return {
                date: futureDayStr,
                startTime: formatISTTime(testStart),
                endTime: formatISTTime(testEnd)
              };
            }
          }
        }
      }
      return null;
    };

    const foundSlot = await findAvailableFutureSlot(preferredTimeStr);
    if (foundSlot) {
      let typeLabel = "Tomorrow";
      if (dayOffset === 2) typeLabel = "Day After Tomorrow";
      if (dayOffset === 3) typeLabel = "Future";

      results.push({
        ...foundSlot,
        type: typeLabel
      });
    }
  }

  return results;
}

