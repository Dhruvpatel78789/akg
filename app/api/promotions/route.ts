import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Promotion } from "@/models/Promotion";
import { getAuthUser } from "@/lib/auth";
import { User } from "@/models/User";

import { formatToISTDate, formatToISTTime } from "@/lib/time";

export async function GET(request: Request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const placement = searchParams.get("placement");
  const queryAudience = searchParams.get("audience");

  // Determine allowed target audiences
  const allowedAudiences: string[] = ["ALL"];

  if (queryAudience) {
    allowedAudiences.push(queryAudience.toUpperCase());
  } else {
    // Determine target audience based on logged-in user session
    const authUser = await getAuthUser();
    if (!authUser) {
      allowedAudiences.push("VISITOR");
    } else {
      allowedAudiences.push("PLAYER");
      if (authUser.role === "ADMIN") {
        allowedAudiences.push("ADMIN");
      }
      if (authUser.role === "COMPANY_EMPLOYEE") {
        allowedAudiences.push("COMPANY_USER");
      }
      // Check for coins and active plan membership
      const user = await User.findById(authUser.userId).lean();
      if (user) {
        if (user.coins && user.coins > 0) {
          allowedAudiences.push("COIN_USER");
        }
        if (user.activePlanId) {
          allowedAudiences.push("MEMBER");
        }
      }
    }
  }

  const findQuery: any = {
    active: true,
    softDeleted: false,
    targetAudience: { $in: allowedAudiences },
  };

  if (placement) {
    findQuery.placement = placement;
  }

  const promotions = await Promotion.find(findQuery)
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  // Filter based on schedules (using IST timezone for date & time safety)
  const now = new Date();
  const todayISTStr = formatToISTDate(now);
  const currentTimeStr = formatToISTTime(now);

  const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentDay = istDate.getDay();

  const validPromotions = promotions.filter((promo: any) => {
    // 1. Date range checks (compare YYYY-MM-DD in IST)
    if (promo.startDate) {
      const startISTStr = formatToISTDate(promo.startDate);
      if (startISTStr > todayISTStr) return false;
    }
    if (promo.endDate) {
      const endISTStr = formatToISTDate(promo.endDate);
      if (endISTStr < todayISTStr) return false;
    }

    // 2. Day of week check
    if (promo.daysOfWeek && promo.daysOfWeek.length > 0) {
      if (!promo.daysOfWeek.includes(currentDay)) return false;
    }

    // 3. Time checks (if not fullDay)
    if (!promo.fullDay) {
      if (promo.startTime && currentTimeStr < promo.startTime) return false;
      if (promo.endTime && currentTimeStr > promo.endTime) return false;
    }

    return true;
  });

  return NextResponse.json({ promotions: validPromotions });
}