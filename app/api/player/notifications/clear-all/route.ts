import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAuthUser } from "@/lib/auth";
import { Notification } from "@/models/Notification";

export async function PATCH() {
  try {
    await connectDB();
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await Notification.updateMany(
      { userId: authUser.userId, clearable: true, cleared: { $ne: true } },
      { $set: { cleared: true } }
    );

    return NextResponse.json({ success: true, message: "All clearable notifications cleared" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to clear notifications" }, { status: 500 });
  }
}
