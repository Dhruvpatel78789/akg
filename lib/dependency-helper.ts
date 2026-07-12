import { Game } from "@/models/Game";
import { DependencyBlock } from "@/models/DependencyBlock";

/**
 * Creates dependency blocks for all configured dependent games when a booking is created/confirmed.
 */
export async function createDependencyBlocksForBooking(booking: any) {
  if (!booking || !booking.gameId) return;

  const game = await Game.findById(booking.gameId);
  if (!game || !game.blockedGameIds || game.blockedGameIds.length === 0) return;

  for (const blockedGameId of game.blockedGameIds) {
    await DependencyBlock.create({
      sourceBookingId: booking._id,
      sourceGameId: booking.gameId,
      blockedGameId: blockedGameId,
      courtId: booking.courtId || null,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: "ACTIVE",
      createdAutomatically: true
    });
  }
}

/**
 * Removes all dependency blocks associated with a booking (cancellation, reschedule, deletion, etc.).
 */
export async function clearDependencyBlocksForBooking(bookingId: any) {
  if (!bookingId) return;
  await DependencyBlock.deleteMany({ sourceBookingId: bookingId });
}
