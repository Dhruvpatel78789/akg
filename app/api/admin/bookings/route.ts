import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Booking } from "@/models/Booking";
import { BookingRequest } from "@/models/BookingRequest";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";
import { updateBookingStatuses } from "@/lib/booking-status-updater";
import { Notification } from "@/models/Notification";
import { Game } from "@/models/Game";
import { Company } from "@/models/Company";
import { CompanyEmployee } from "@/models/CompanyEmployee";

import { formatToISTDate } from "@/lib/time";

export async function GET(request: Request) {
  try {
    await connectDB();

    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "24h";
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    const isGlobalAdmin = admin.user?.role === "ADMIN";
    const roleProfile = admin.roleProfile;

    const getSubPermission = (subKey: string) => {
      if (isGlobalAdmin) return { view: true, edit: true };
      const perm = roleProfile?.permissions?.find((p: any) => p.section === "bookings");
      if (!perm) return { view: false, edit: false };

      const subSectionsObj = perm.subSections instanceof Map 
        ? Object.fromEntries(perm.subSections) 
        : perm.subSections || {};

      return subSectionsObj[subKey] || { view: false, edit: false };
    };

    const hasAnyView = isGlobalAdmin || [
      "advancedBookings",
      "ongoingSessions",
      "bookingHistory",
      "pendingPayments",
      "failedPayments",
      "cancellationRequests",
      "timeChangeRequests",
    ].some(subKey => getSubPermission(subKey).view);

    if (!hasAnyView) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Automate future bookings -> active sessions -> completed history transitions
    await updateBookingStatuses();

    const now = new Date();

    // Date Range Calculations (using local/IST boundary conversions)
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    if (range === "24h") {
      rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      rangeEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (range === "today") {
      const todayStr = formatToISTDate(now);
      rangeStart = new Date(todayStr + "T00:00:00+05:30");
      rangeEnd = new Date(todayStr + "T23:59:59+05:30");
    } else if (range === "yesterday") {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = formatToISTDate(yesterday);
      rangeStart = new Date(yesterdayStr + "T00:00:00+05:30");
      rangeEnd = new Date(yesterdayStr + "T23:59:59+05:30");
    } else if (range === "thisWeek") {
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getTime());
      monday.setDate(diffToMon);
      const mondayStr = formatToISTDate(monday);
      
      const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
      const sundayStr = formatToISTDate(sunday);
      
      rangeStart = new Date(mondayStr + "T00:00:00+05:30");
      rangeEnd = new Date(sundayStr + "T23:59:59+05:30");
    } else if (range === "previousWeek") {
      const day = now.getDay();
      const diffToLastMon = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const lastMonday = new Date(now.getTime());
      lastMonday.setDate(diffToLastMon);
      const lastMondayStr = formatToISTDate(lastMonday);
      
      const lastSunday = new Date(lastMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
      const lastSundayStr = formatToISTDate(lastSunday);
      
      rangeStart = new Date(lastMondayStr + "T00:00:00+05:30");
      rangeEnd = new Date(lastSundayStr + "T23:59:59+05:30");
    } else if (range === "thisMonth") {
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const firstDayStr = formatToISTDate(firstDay);
      const lastDayStr = formatToISTDate(lastDay);
      
      rangeStart = new Date(firstDayStr + "T00:00:00+05:30");
      rangeEnd = new Date(lastDayStr + "T23:59:59+05:30");
    } else if (range === "custom" && startDateStr && endDateStr) {
      rangeStart = new Date(startDateStr + "T00:00:00+05:30");
      rangeEnd = new Date(endDateStr + "T23:59:59+05:30");
    }

    // Build conditional queries
    const advQuery: any = {
      status: "BOOKED",
      startTime: { $gt: now },
      $or: [
        { paymentStatus: "PAID" },
        { paymentMethod: "PAY_AT_COUNTER" }
      ],
      softDeleted: false,
    };
    if (range !== "all" && rangeEnd) {
      advQuery.startTime = { $gt: now, $lte: rangeEnd };
    }

    const histQuery: any = {
      status: { $in: ["COMPLETED", "CANCELLED"] },
      paymentStatus: "PAID",
      softDeleted: false,
    };
    if (range !== "all" && rangeStart && rangeEnd) {
      histQuery.startTime = { $gte: rangeStart, $lte: rangeEnd };
    }

    const pendingQuery: any = {
      paymentStatus: "PENDING",
      softDeleted: false,
    };
    if (range !== "all" && rangeStart && rangeEnd) {
      pendingQuery.createdAt = { $gte: rangeStart, $lte: rangeEnd };
    }

    const failedQuery: any = {
      paymentStatus: "FAILED",
      softDeleted: false,
    };
    if (range !== "all" && rangeStart && rangeEnd) {
      failedQuery.createdAt = { $gte: rangeStart, $lte: rangeEnd };
    }

    const cancelQuery: any = {
      type: "CANCELLATION",
    };
    if (range !== "all" && rangeStart && rangeEnd) {
      cancelQuery.createdAt = { $gte: rangeStart, $lte: rangeEnd };
    }

    const timeChangeQuery: any = {
      type: "TIME_CHANGE",
    };
    if (range !== "all" && rangeStart && rangeEnd) {
      timeChangeQuery.createdAt = { $gte: rangeStart, $lte: rangeEnd };
    }

    const advancedBookings = getSubPermission("advancedBookings").view
      ? await Booking.find(advQuery)
          .populate("userId", "name phone email role")
          .populate("companyId", "name")
          .populate("companyEmployeeId", "name mobile email employeeId")
          .sort({ startTime: 1 })
          .lean()
      : [];

    // Ongoing sessions are critical to always view in real-time on active courts
    const ongoingSessions = getSubPermission("ongoingSessions").view
      ? await Booking.find({
          status: "STARTED",
          paymentStatus: "PAID",
          softDeleted: false,
        })
          .populate("userId", "name phone email role")
          .populate("companyId", "name")
          .populate("companyEmployeeId", "name mobile email employeeId")
          .sort({ startTime: 1 })
          .lean()
      : [];

    const bookingHistory = getSubPermission("bookingHistory").view
      ? await Booking.find(histQuery)
          .populate("userId", "name phone email role")
          .populate("companyId", "name")
          .populate("companyEmployeeId", "name mobile email employeeId")
          .sort({ endTime: -1 })
          .limit(200)
          .lean()
      : [];

    const pendingPayments = getSubPermission("pendingPayments").view
      ? await Booking.find(pendingQuery)
          .populate("userId", "name phone email role")
          .populate("companyId", "name")
          .populate("companyEmployeeId", "name mobile email employeeId")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const failedPayments = getSubPermission("failedPayments").view
      ? await Booking.find(failedQuery)
          .populate("userId", "name phone email role")
          .populate("companyId", "name")
          .populate("companyEmployeeId", "name mobile email employeeId")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const cancellationRequests = getSubPermission("cancellationRequests").view
      ? await BookingRequest.find(cancelQuery)
          .populate("userId", "name phone email role")
          .populate("bookingId")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const timeChangeRequests = getSubPermission("timeChangeRequests").view
      ? await BookingRequest.find(timeChangeQuery)
          .populate("userId", "name phone email role")
          .populate("bookingId")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    return NextResponse.json({
      advancedBookings,
      ongoingSessions,
      bookingHistory,
      pendingPayments,
      failedPayments,
      cancellationRequests,
      timeChangeRequests,
    });
  } catch (err: any) {
    console.error("GET bookings error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const { requestId, bookingId, action, status } = body; // status can be "APPROVED" or "REJECTED"

    let admin;
    if (bookingId && action) {
      admin = await requireAdmin("bookings", "advancedBookings", true);
      if (admin.error) return admin.error;
    } else if (requestId) {
      const tempReq = await BookingRequest.findById(requestId).lean();
      if (!tempReq) {
        return NextResponse.json({ message: "Request not found" }, { status: 404 });
      }
      const subKey = tempReq.type === "CANCELLATION" ? "cancellationRequests" : "timeChangeRequests";
      admin = await requireAdmin("bookings", subKey, true);
      if (admin.error) return admin.error;
    } else {
      admin = await requireAdmin();
      if (admin.error) return admin.error;
    }

    // Handle Direct Admin Actions (Edit/Cancel)
    if (bookingId && action) {
      if (action === "UPDATE") {
        const { startTime, endTime, court } = body;
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          return NextResponse.json({ message: "Booking not found" }, { status: 404 });
        }

        if (startTime) {
          const game = await Game.findById(booking.gameId).lean();
          if (game && game.fixedSlotBooking) {
            const { validateFixedSlot } = await import("@/lib/fixed-slots");
            if (!validateFixedSlot(new Date(startTime), game.duration)) {
              return NextResponse.json({
                message: "This game only allows fixed slot bookings. Please select a valid slot time."
              }, { status: 400 });
            }
          }
        }

        const oldStartTime = booking.startTime;
        const oldCourt = booking.court;

        if (startTime) booking.startTime = new Date(startTime);
        if (endTime) booking.endTime = new Date(endTime);
        if (court) booking.court = court;
        await booking.save();

        // Release old court holds to free the previous court immediately
        try {
          const { Court } = await import("@/models/court");
          const { CourtHold } = await import("@/models/CourtHold");
          if (oldCourt) {
            const oldCourtDoc = await Court.findOne({ name: { $regex: new RegExp(`^\\s*${oldCourt.trim()}\\s*$`, "i") } });
            if (oldCourtDoc) {
              await CourtHold.deleteMany({
                courtId: oldCourtDoc._id,
                startTime: oldStartTime,
                userId: booking.userId
              });
            }
          }
        } catch (holdErr) {
          console.error("Failed to clean up old court holds in admin update:", holdErr);
        }

        // Create notification for player
        await Notification.create({
          userId: booking.userId,
          title: "Booking Updated by Admin",
          message: `Your booking for ${booking.gameName} has been rescheduled to ${new Date(booking.startTime as any).toLocaleString("en-IN")} - ${new Date(booking.endTime as any).toLocaleTimeString("en-IN")}.`,
        });

        return NextResponse.json({ success: true, message: "Booking updated successfully" });
      }

      if (action === "CANCEL") {
        const { refundAmount } = body;
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          return NextResponse.json({ message: "Booking not found" }, { status: 404 });
        }

        booking.status = "CANCELLED";
        booking.refundAmount = Number(refundAmount || 0);
        
        const totalCost = booking.coinCost || booking.price || 0;
        if (booking.refundAmount > 0) {
          booking.paymentStatus = booking.refundAmount === totalCost ? "REFUNDED" : "PARTIALLY_REFUNDED";
        }

        await booking.save();

        // Log transaction record for refund if refundAmount > 0
        if (booking.refundAmount > 0) {
          if (booking.coinCost > 0) {
            // Refund coins
            const user = await User.findById(booking.userId);
            if (user) {
              user.coins = (user.coins || 0) + booking.refundAmount;
              await user.save();
            }
            await Transaction.create({
              userId: booking.userId,
              type: "REFUND",
              amount: 0,
              coins: booking.refundAmount,
              paymentMode: "coins",
              refundAmount: booking.refundAmount,
              referenceId: booking._id,
              note: `Refund of ${booking.refundAmount} coins for cancelled booking ${booking._id}`,
            });
          } else {
            // Refund cash or online
            await Transaction.create({
              userId: booking.userId,
              type: "REFUND",
              amount: booking.refundAmount,
              coins: 0,
              paymentMode: booking.paymentMode || "online",
              refundAmount: booking.refundAmount,
              referenceId: booking._id,
              note: `Refund of ₹${booking.refundAmount} for cancelled booking ${booking._id}`,
            });
          }
        }

        // Create notification for player
        await Notification.create({
          userId: booking.userId,
          title: "Booking Cancelled by Admin",
          message: `Your booking for ${booking.gameName} on ${new Date(booking.startTime as any).toLocaleDateString("en-IN")} has been cancelled. Refund: ${booking.coinCost > 0 ? `${booking.refundAmount} coins` : `₹${booking.refundAmount}`}.`,
        });

        return NextResponse.json({ success: true, message: "Booking cancelled successfully" });
      }
    }

    if (!requestId || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ message: "Invalid parameters" }, { status: 400 });
    }

    const bookingRequest = await BookingRequest.findById(requestId).populate("bookingId");
    if (!bookingRequest) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    if (bookingRequest.status !== "PENDING") {
      return NextResponse.json({ message: "Request has already been processed" }, { status: 400 });
    }

    bookingRequest.status = status;
    await bookingRequest.save();

    const booking = await Booking.findById(bookingRequest.bookingId);
    if (!booking) {
      return NextResponse.json({ message: "Associated booking not found" }, { status: 404 });
    }

    if (status === "APPROVED") {
      if (bookingRequest.type === "CANCELLATION") {
        booking.status = "CANCELLED";
        await booking.save();

        // Refund coins if booking used coins
        if (booking.coinCost > 0) {
          const user = await User.findById(booking.userId);
          if (user) {
            user.coins = (user.coins || 0) + booking.coinCost;
            await user.save();

            await Transaction.create({
              userId: user._id,
              type: "REFUND", // using correct REFUND type
              amount: 0,
              coins: booking.coinCost,
              paymentMode: "coins",
              referenceId: booking._id,
              note: `Refund for approved cancellation request of booking ${booking._id}`,
            });
          }
        }
      } else if (bookingRequest.type === "TIME_CHANGE") {
        if (bookingRequest.requestedStartTime && bookingRequest.requestedEndTime) {
          booking.startTime = bookingRequest.requestedStartTime;
          booking.endTime = bookingRequest.requestedEndTime;
          await booking.save();
        }
      }
    }

    return NextResponse.json({ success: true, message: `Request successfully ${status.toLowerCase()}` });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to process request" }, { status: 500 });
  }
}