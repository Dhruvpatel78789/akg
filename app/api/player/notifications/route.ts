import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Notification } from "@/models/Notification";

export async function GET() {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const notifications = await Notification.find({ userId: authUser.userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, notifications });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to load notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId } = body;

    if (notificationId) {
      await Notification.updateOne(
        { _id: notificationId, userId: authUser.userId },
        { $set: { read: true } }
      );
    } else {
      // Mark all as read
      await Notification.updateMany(
        { userId: authUser.userId, read: false },
        { $set: { read: true } }
      );
    }

    return NextResponse.json({ success: true, message: "Notifications updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update notifications" }, { status: 500 });
  }
}
