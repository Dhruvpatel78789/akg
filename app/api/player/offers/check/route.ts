import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Offer } from "@/models/Offer";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { date, startTime, gameId, amount } = body;

    if (!date || !startTime || !amount) {
      return NextResponse.json({ success: false, message: "Missing required query params" }, { status: 400 });
    }

    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const [hours] = startTime.split(":").map(Number);

    // Find all active offers
    const query: any = { active: true };
    const offers = await Offer.find(query);

    let bestOffer = null;
    let highestDiscount = 0;

    for (const offer of offers) {
      // Day of week check
      if (offer.daysOfWeek && offer.daysOfWeek.length > 0) {
        if (!offer.daysOfWeek.includes(dayOfWeek)) continue;
      }

      // Hour range check
      if (offer.startHour !== undefined && offer.endHour !== undefined) {
        if (hours < offer.startHour || hours > offer.endHour) continue;
      }

      // Game check
      if (offer.gameId && gameId) {
        if (offer.gameId.toString() !== gameId) continue;
      }

      // Calculate discount
      let discount = 0;
      if (offer.discountType === "FLAT") {
        discount = offer.value;
      } else if (offer.discountType === "PERCENTAGE") {
        discount = (amount * offer.value) / 100;
      }

      if (discount > highestDiscount) {
        highestDiscount = discount;
        bestOffer = offer;
      }
    }

    if (bestOffer) {
      return NextResponse.json({
        success: true,
        offerId: bestOffer._id,
        name: bestOffer.name,
        discountAmount: highestDiscount,
        finalAmount: amount - highestDiscount,
      });
    }

    return NextResponse.json({ success: false, message: "No active auto-offers match this slot" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
