import { formatToISTTime } from "./time";

/**
 * Validates whether a given start time conforms to the fixed slot boundary of a game.
 * Conformance means the minutes from midnight in IST must be an exact multiple of the minimum duration.
 */
export function validateFixedSlot(startTime: Date | string | undefined, minimumDuration: number): boolean {
  if (!startTime || !minimumDuration || minimumDuration <= 0) {
    return true; // If data is incomplete, default to valid so it doesn't block
  }

  let timeStr = "";
  if (startTime instanceof Date) {
    timeStr = formatToISTTime(startTime);
  } else if (typeof startTime === "string") {
    if (startTime.includes("T") || startTime.includes("-")) {
      timeStr = formatToISTTime(new Date(startTime));
    } else {
      timeStr = startTime; // Expected to be "HH:MM"
    }
  }

  if (!timeStr || !timeStr.includes(":")) {
    return false;
  }

  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) {
    return false;
  }

  const minutesFromMidnight = h * 60 + m;
  return minutesFromMidnight % minimumDuration === 0;
}

/**
 * Returns a list of valid slot start times (HH:MM) for a given minimum duration.
 */
export function getValidSlotsForDuration(minimumDuration: number): string[] {
  const slots: string[] = [];
  if (!minimumDuration || minimumDuration <= 0) return slots;

  for (let mins = 0; mins < 1440; mins += minimumDuration) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}
