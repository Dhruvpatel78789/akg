import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/models/Offer";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const offers = await Offer.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, offers });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const offer = await Offer.create(body);
    return NextResponse.json({ success: true, offer });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
