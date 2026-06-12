import { Booking } from "@/models/Booking";
import { Game } from "@/models/Game";
import { Notification } from "@/models/Notification";
import { SessionEntry } from "@/models/SessionEntry";
import { processOvertimeAndExit } from "@/lib/overtime-calculator";

export async function updateBookingStatuses() {
  const now = new Date();

  // ----------------------------------------------------
  // 1. Corporate / Visitor SessionEntry Auto-Start
  // ----------------------------------------------------
  const entriesToStart = await SessionEntry.find({
    status: "BOOKED",
    startTime: { $lte: now },
    softDeleted: false,
  });

  for (const entry of entriesToStart) {
    if (entry.bookingId) {
      const parentBooking = await Booking.findById(entry.bookingId);
      if (
        parentBooking &&
        parentBooking.playerType !== "COMPANY" &&
        parentBooking.effectivePaymentStatus !== "PAID"
      ) {
        continue; // Gate check-in/start
      }
    }
    entry.status = "STARTED";
    await entry.save();
  }

  // ----------------------------------------------------
  // 2. Regular Player Booking Auto-Start
  // ----------------------------------------------------
  const bookingsToStart = await Booking.find({
    status: "BOOKED",
    startTime: { $lte: now },
    softDeleted: false,
  });

  for (const b of bookingsToStart) {
    if (b.playerType !== "COMPANY" && b.effectivePaymentStatus !== "PAID") {
      continue; // Gate check-in/start
    }
    b.status = "STARTED";
    await b.save();

    await Notification.create({
      userId: b.userId,
      title: "Session Auto-Started",
      message: `Your booking for ${b.gameName} on court ${b.court || "N/A"} has automatically started.`,
    });
  }

  // ----------------------------------------------------
  // 3. Corporate / Visitor SessionEntry Auto-End (exceeds maximum duration + minimumDuration)
  // ----------------------------------------------------
  const activeEntries = await SessionEntry.find({
    status: "STARTED",
    softDeleted: false,
  });

  for (const entry of activeEntries) {
    const game = await Game.findById(entry.gameId).lean();
    if (!game) continue;

    const maxDuration = game.maximumDuration || 180;
    const minDuration = game.duration || 60;

    const playDurationMs = now.getTime() - new Date(entry.startTime).getTime();
    const playDurationMinutes = Math.floor(playDurationMs / (60 * 1000));

    if (playDurationMinutes >= maxDuration + minDuration) {
      const limitTime = new Date(new Date(entry.startTime).getTime() + (maxDuration + minDuration) * 60 * 1000);
      if (entry.bookingId) {
        await processOvertimeAndExit(entry.bookingId.toString(), limitTime, true);
      }
    }
  }

  // ----------------------------------------------------
  // 4. Regular Player Booking Auto-End
  // ----------------------------------------------------
  const activeSessions = await Booking.find({
    status: "STARTED",
    softDeleted: false,
  });

  for (const session of activeSessions) {
    if (!session.gameId) {
      if (session.endTime && now >= new Date(session.endTime)) {
        session.status = "COMPLETED";
        session.exitedTime = session.endTime;
        await session.save();
      }
      continue;
    }

    const game = await Game.findById(session.gameId).lean();
    const buffer = game?.bufferMinutes || 0;
    const maxDuration = game?.maximumDuration || 180;
    const minDuration = game?.duration || 60;

    const nextBooking = await Booking.findOne({
      court: session.court,
      gameId: session.gameId,
      status: "BOOKED",
      startTime: { $gt: session.startTime },
      softDeleted: false,
    })
      .sort({ startTime: 1 })
      .lean();

    let endedByNextBooking = false;

    if (nextBooking) {
      const nextStart = new Date(nextBooking.startTime as any).getTime();
      const cutoffTime = nextStart - buffer * 60 * 1000;

      if (now.getTime() >= cutoffTime) {
        if (session._id) {
          await processOvertimeAndExit(session._id.toString(), new Date(cutoffTime), false);
        }
        endedByNextBooking = true;

        await Notification.create({
          userId: session.userId,
          title: "Session Auto-Ended",
          message: `Your active session for ${session.gameName} has ended to clear the court for the next player booking.`,
        });
      }
    }

    if (!endedByNextBooking) {
      const playDurationMs = now.getTime() - new Date(session.startTime as any).getTime();
      const playDurationMinutes = Math.floor(playDurationMs / (60 * 1000));

      if (playDurationMinutes >= maxDuration + minDuration) {
        const limitTime = new Date(new Date(session.startTime as any).getTime() + (maxDuration + minDuration) * 60 * 1000);
        if (session._id) {
          await processOvertimeAndExit(session._id.toString(), limitTime, true);
        }

        await Notification.create({
          userId: session.userId,
          title: "Session Auto-Ended",
          message: `Your session for ${session.gameName} was automatically ended because it exceeded the maximum allowed duration of ${maxDuration} minutes plus a ${minDuration} minutes unit buffer.`,
        });
      } else {
        // Day boundary checkout fallback
        const limitTime = new Date(session.startTime as any).getTime() + 24 * 60 * 60 * 1000;
        if (now.getTime() >= limitTime) {
          if (session._id) {
            await processOvertimeAndExit(session._id.toString(), new Date(limitTime), true);
          }
        }
      }
    }
  }
}
