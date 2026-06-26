import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Notification } from "@/models/Notification";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const notification = await Notification.findOne({
      _id: id,
      userId: authUser.userId,
    });

    if (!notification) {
      return NextResponse.json({ message: "Notification not found" }, { status: 404 });
    }

    if (!notification.clearable) {
      return NextResponse.json({ message: "This notification cannot be cleared" }, { status: 400 });
    }

    notification.cleared = true;
    await notification.save();

    return NextResponse.json({ success: true, message: "Notification cleared successfully" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to clear notification" }, { status: 500 });
  }
}
