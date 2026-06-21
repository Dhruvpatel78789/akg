import { connectDB } from "../lib/mongodb";
import { Booking } from "../models/Booking";
import { SessionEntry } from "../models/SessionEntry";
import { CourtBlock } from "../models/CourtBlock";
import { BookingRequest } from "../models/BookingRequest";

const SHIFT_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

async function migrate() {
  await connectDB();
  console.log("Connected to MongoDB for date migration...");

  // 1. Migrate Bookings
  const bookings = await Booking.find({});
  console.log(`Found ${bookings.length} bookings to migrate.`);
  for (const b of bookings) {
    let changed = false;
    if (b.startTime) {
      b.startTime = new Date(b.startTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (b.endTime) {
      b.endTime = new Date(b.endTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (b.exitedTime) {
      b.exitedTime = new Date(b.exitedTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (changed) {
      await Booking.updateOne(
        { _id: b._id },
        {
          $set: {
            startTime: b.startTime,
            endTime: b.endTime,
            exitedTime: b.exitedTime
          }
        }
      );
    }
  }
  console.log("Bookings migration complete.");

  // 2. Migrate SessionEntries
  const entries = await SessionEntry.find({});
  console.log(`Found ${entries.length} session entries to migrate.`);
  for (const e of entries) {
    let changed = false;
    if (e.startTime) {
      e.startTime = new Date(e.startTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (e.endTime) {
      e.endTime = new Date(e.endTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (e.exitedTime) {
      e.exitedTime = new Date(e.exitedTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (changed) {
      await SessionEntry.updateOne(
        { _id: e._id },
        {
          $set: {
            startTime: e.startTime,
            endTime: e.endTime,
            exitedTime: e.exitedTime
          }
        }
      );
    }
  }
  console.log("Session entries migration complete.");

  // 3. Migrate CourtBlocks
  const blocks = await CourtBlock.find({});
  console.log(`Found ${blocks.length} court blocks to migrate.`);
  for (const bl of blocks) {
    let changed = false;
    if (bl.blockedFrom) {
      bl.blockedFrom = new Date(bl.blockedFrom.getTime() - SHIFT_MS);
      changed = true;
    }
    if (bl.blockedTo) {
      bl.blockedTo = new Date(bl.blockedTo.getTime() - SHIFT_MS);
      changed = true;
    }
    if (changed) {
      await CourtBlock.updateOne(
        { _id: bl._id },
        {
          $set: {
            blockedFrom: bl.blockedFrom,
            blockedTo: bl.blockedTo
          }
        }
      );
    }
  }
  console.log("Court blocks migration complete.");

  // 4. Migrate BookingRequests
  const requests = await BookingRequest.find({});
  console.log(`Found ${requests.length} booking requests to migrate.`);
  for (const r of requests) {
    let changed = false;
    if (r.requestedStartTime) {
      r.requestedStartTime = new Date(r.requestedStartTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (r.requestedEndTime) {
      r.requestedEndTime = new Date(r.requestedEndTime.getTime() - SHIFT_MS);
      changed = true;
    }
    if (changed) {
      await BookingRequest.updateOne(
        { _id: r._id },
        {
          $set: {
            requestedStartTime: r.requestedStartTime,
            requestedEndTime: r.requestedEndTime
          }
        }
      );
    }
  }
  console.log("Booking requests migration complete.");

  console.log("All date migrations completed successfully.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
