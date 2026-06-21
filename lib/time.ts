/**
 * Shared utility for timezone-safe parsing and formatting of booking datetimes.
 * Stores all times internally at Asia/Kolkata (IST, UTC+05:30) timezone.
 */

export function parseIST(dateStr: string, timeStr: string, addDays: number = 0): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  const yStr = String(year).padStart(4, "0");
  const mStr = String(month).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  const hhStr = String(hours).padStart(2, "0");
  const mmStr = String(minutes).padStart(2, "0");

  const isoStr = `${yStr}-${mStr}-${dStr}T${hhStr}:${mmStr}:00+05:30`;
  const date = new Date(isoStr);

  if (addDays > 0) {
    date.setDate(date.getDate() + addDays);
  }
  return date;
}

export function formatToISTDate(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

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
}

export function formatToISTTime(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

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
}

export function formatToISTDateTimeString(date: Date | string | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "";
  return `${day} ${month}, ${hour}:${minute}`;
}

/**
 * Derives display status from booking fields.
 * Derived status handles Pending Payment vs Booked correctly.
 */
export function getBookingDisplayStatus(booking: {
  status?: string;
  paymentStatus?: string;
  effectivePaymentStatus?: string;
  playerType?: string;
}): string {
  if (booking.status === "CANCELLED") return "Cancelled";
  if (booking.status === "COMPLETED") return "Completed";

  const paymentStatus = booking.effectivePaymentStatus || booking.paymentStatus || "PENDING";

  if (booking.playerType === "COMPANY") {
    return booking.status === "STARTED" ? "Started" : "Booked";
  }

  if (paymentStatus === "PAID") {
    if (booking.status === "STARTED") return "Started";
    return "Booked";
  }

  if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
    return "Payment Failed";
  }

  return "Pending Payment";
}
