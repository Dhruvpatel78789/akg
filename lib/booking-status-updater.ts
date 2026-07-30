import { Booking } from "@/models/Booking";
import { Game } from "@/models/Game";
import { Notification } from "@/models/Notification";
import { SessionEntry } from "@/models/SessionEntry";
import { processOvertimeAndExit } from "@/lib/overtime-calculator";

export async function updateBookingStatuses() {
  const now = new Date();

  // ----------------------------------------------------
  // 0. Auto-Reconcile stuck Razorpay Payments
  // ----------------------------------------------------
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret && !keyId.startsWith("rzp_test_mock")) {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const stuckBookings = await Booking.find({
        paymentStatus: "PENDING",
        paymentMethod: "RAZORPAY",
        razorpayOrderId: { $regex: /^order_/ },
        createdAt: { $gte: twoDaysAgo }
      });

      if (stuckBookings.length > 0) {
        const { default: Razorpay } = await import("razorpay");
        const razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret
        });

        for (const booking of stuckBookings) {
          try {
            const orderId = booking.razorpayOrderId;
            if (!orderId || orderId.startsWith("order_mock_")) continue;

            const orderDetails = await razorpay.orders.fetch(orderId);
            if (orderDetails && orderDetails.status === "paid") {
              // Retrieve payments for this order to find the actual payment ID
              const payments = await razorpay.orders.fetchPayments(orderId);
              const capturedPayment = payments.items?.find((p: any) => p.status === "captured");
              const paymentId = capturedPayment?.id || `pay_reconciled_${orderId.substring(6)}`;

              booking.paymentStatus = "PAID";
              booking.gatewayPaymentStatus = "PAID";
              booking.status = "BOOKED";
              booking.razorpayPaymentId = paymentId;
              booking.transactionId = paymentId;
              booking.paidAt = new Date();
              await booking.save();

              // Confirm associated court holds
              try {
                const { CourtHold } = await import("@/models/CourtHold");
                const { Court } = await import("@/models/court");
                if (booking.court) {
                  const courtDoc = await Court.findOne({ name: { $regex: new RegExp(`^\\s*${booking.court.trim()}\\s*$`, "i") } });
                  if (courtDoc) {
                    await CourtHold.updateMany(
                      {
                        courtId: courtDoc._id,
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        status: "HELD"
                      },
                      { $set: { status: "CONFIRMED" } }
                    );
                  }
                }
              } catch (holdErr) {
                console.error("Failed to confirm court hold in auto-reconcile:", holdErr);
              }

              // Create transaction record
              try {
                const { Transaction } = await import("@/models/Transaction");
                const existingTx = await Transaction.findOne({ note: { $regex: new RegExp(booking._id.toString()) } });
                if (!existingTx) {
                  await Transaction.create({
                    userId: booking.userId,
                    type: "SESSION_DEDUCTION",
                    amount: booking.price || 0,
                    coins: 0,
                    note: `Auto-reconciled online payment booking for ${booking.gameName} on court ${booking.court || "N/A"} (Booking ID: ${booking._id})`,
                    paymentMode: "online",
                    paymentStatus: "PAID",
                  });
                }
              } catch (txErr) {
                console.error("Failed to create transaction in auto-reconcile:", txErr);
              }
            }
          } catch (itemErr) {
            console.error(`Failed to reconcile booking ${booking._id}:`, itemErr);
          }
        }
      }
    }
  } catch (reconErr) {
    console.error("Error running Razorpay auto-reconciliation: ", reconErr);
  }

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
