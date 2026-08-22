import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Company } from "@/models/Company";
import { Game } from "@/models/Game";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id: companyId } = await params;
    const body = await request.json();
    const { gameId, oldMinimumDuration, newMinimumDuration } = body;

    const company = await Company.findById(companyId);
    if (!company || company.softDeleted) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    const { recalculateCompanyBilling } = await import("@/lib/recalculate-billing");

    let totalUpdated = 0;

    const adminUserId = admin.user?._id?.toString() || "";
    if (gameId) {
      const oldMin = Number(oldMinimumDuration || 60);
      const newMin = Number(newMinimumDuration || 60);
      totalUpdated = await recalculateCompanyBilling(companyId, gameId, oldMin, newMin, adminUserId);
    } else {
      // Recalculate all games
      for (const config of company.gameConfigurations || []) {
        const game = await Game.findById(config.gameId).lean();
        if (game) {
          const oldMin = game.duration || 60;
          const newMin = config.minimumDuration;
          totalUpdated += await recalculateCompanyBilling(
            companyId,
            config.gameId.toString(),
            oldMin,
            newMin,
            adminUserId
          );
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount: totalUpdated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || "Failed to recalculate entries" }, { status: 500 });
  }
}
