import { Court } from "@/models/court";
import { Booking } from "@/models/Booking";
import { CourtBlock } from "@/models/CourtBlock";
import { Game } from "@/models/Game";
import { PricingRule } from "@/models/PricingRule";
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
  // Include pending bookings created within the last 10 minutes (reserved slots)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const bookingQuery: any = {
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
  const [courts, overlappingBookings, overlappingBlocks, existingBooking] = await Promise.all([
    Court.find({ gameId, active: true, disabled: { $ne: true } }).lean(),
    Booking.find(bookingQuery).lean(),
    CourtBlock.find({
      status: { $in: ["ACTIVE", "SCHEDULED"] },
      blockedFrom: { $lt: bookingEnd },
      blockedTo: { $gt: bookingStart }
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

    if (!isBooked && !isBlocked) {
      return { available: true, courtName: court.name };
    }
  }

  return { available: false, reason: "All courts are fully booked or blocked for this slot" };
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
  const [sh, sm] = startTime.split(":").map(Number);
  const requestedStartMinutes = sh * 60 + sm;

  // 1. Validate pricing rule exists for this game & players count (same checks as requested slot)
  const rule = await PricingRule.findOne({
    gameId: new mongoose.Types.ObjectId(gameId),
    active: true,
    minPlayers: { $lte: playersCount },
    maxPlayers: { $gte: playersCount },
    durationMinutes: duration,
  }).lean();

  if (!rule) {
    return [];
  }

  const step = duration; // game minimum duration as step
  const minOperatingMinutes = 360; // 06:00
  const maxOperatingMinutes = 1440; // 24:00

  const beforeSlots: string[] = [];
  const afterSlots: string[] = [];

  // Helper to format minutes to HH:MM
  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const isToday = new Date().toDateString() === new Date(date).toDateString();
  const now = new Date();

  // Find up to 4 available slots before (checking step by step outwards)
  let currentBefore = requestedStartMinutes - step;
  while (currentBefore >= minOperatingMinutes && beforeSlots.length < 4) {
    const slotStartStr = formatTime(currentBefore);
    const slotEndStr = formatTime(currentBefore + duration);
    const start = parseDateTime(date, slotStartStr);
    const end = parseDateTime(date, slotEndStr, (currentBefore + duration >= maxOperatingMinutes) ? 1 : 0);

    // Filter out past slots if date is today
    const isPast = isToday && start.getTime() < now.getTime();
    if (!isPast) {
      const check = await checkCourtAvailability(gameId, start, end);
      if (check.available) {
        beforeSlots.push(slotStartStr);
      }
    }
    currentBefore -= step;
  }

  // Find up to 4 available slots after (checking step by step outwards)
  let currentAfter = requestedStartMinutes + step;
  while (currentAfter + duration <= maxOperatingMinutes && afterSlots.length < 4) {
    const slotStartStr = formatTime(currentAfter);
    const slotEndStr = formatTime(currentAfter + duration);
    const start = parseDateTime(date, slotStartStr);
    const end = parseDateTime(date, slotEndStr, (currentAfter + duration >= maxOperatingMinutes) ? 1 : 0);

    const isPast = isToday && start.getTime() < now.getTime();
    if (!isPast) {
      const check = await checkCourtAvailability(gameId, start, end);
      if (check.available) {
        afterSlots.push(slotStartStr);
      }
    }
    currentAfter += step;
  }

  // Combine and sort by absolute time difference from requested slot
  const allSuggested = [...beforeSlots, ...afterSlots];
  allSuggested.sort((a, b) => {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    
    const diffA = Math.abs((ah * 60 + am) - requestedStartMinutes);
    const diffB = Math.abs((bh * 60 + bm) - requestedStartMinutes);
    
    return diffA - diffB;
  });

  // Unique suggestions, limit to 4
  const uniqueSuggested = Array.from(new Set(allSuggested)).slice(0, 4);

  // Return them sorted chronologically for presentation
  uniqueSuggested.sort((a, b) => {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });

  return uniqueSuggested;
}
