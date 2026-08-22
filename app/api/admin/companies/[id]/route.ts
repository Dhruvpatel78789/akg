import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin-auth";
import { Company } from "@/models/Company";
import { Game } from "@/models/Game";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, contactPerson, contactNumber, email, billingAddress, gstNumber, allowedGameIds, discountPercentage, status, gameDiscounts, gameConfigurations } = body;

    const company = await Company.findById(id);
    if (!company || company.softDeleted) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    // Validate game configurations
    const cleanGameConfigs = (gameConfigurations || []).map((config: any) => ({
      gameId: (config.gameId?._id || config.gameId || "").toString(),
      minimumDuration: Number(config.minimumDuration),
    }));

    for (const config of cleanGameConfigs) {
      const game = await Game.findById(config.gameId).lean();
      if (!game) {
        return NextResponse.json({ success: false, message: `Game with ID ${config.gameId} not found` }, { status: 400 });
      }
      const val = config.minimumDuration;
      const min = game.duration || 30;
      const max = game.maximumDuration || 180;

      if (!val || val <= 0) {
        return NextResponse.json({ success: false, message: `Company Minimum Duration for ${game.name} must be greater than 0.` }, { status: 400 });
      }
      if (val % min !== 0) {
        return NextResponse.json({ success: false, message: `Company Minimum Duration for ${game.name} must be a multiple of the game's default minimum duration of ${min} minutes.` }, { status: 400 });
      }
      if (val > max) {
        return NextResponse.json({ success: false, message: `Company Minimum Duration for ${game.name} cannot exceed the game's maximum duration of ${max} minutes.` }, { status: 400 });
      }
    }

    // Detect changes in game minimum duration configurations
    const changedConfigs = [];
    if (gameConfigurations !== undefined && company.gameConfigurations) {
      const oldConfigMap = new Map(
        (company.gameConfigurations || []).map((c: any) => [(c.gameId?._id || c.gameId || "").toString(), c.minimumDuration])
      );

      for (const newConfig of cleanGameConfigs) {
        const gameIdStr = newConfig.gameId;
        const oldVal = oldConfigMap.get(gameIdStr);
        if (oldVal !== undefined && oldVal !== newConfig.minimumDuration) {
          changedConfigs.push({
            gameId: gameIdStr,
            oldMin: oldVal,
            newMin: newConfig.minimumDuration,
          });
        }
      }
    }

    if (name) company.name = name;
    if (contactPerson !== undefined) company.contactPerson = contactPerson;
    if (contactNumber !== undefined) company.contactNumber = contactNumber;
    if (email !== undefined) company.email = email;
    if (billingAddress !== undefined) company.billingAddress = billingAddress;
    if (gstNumber !== undefined) company.gstNumber = gstNumber;
    if (allowedGameIds !== undefined) company.allowedGameIds = allowedGameIds;
    if (discountPercentage !== undefined) company.discountPercentage = Number(discountPercentage);
    if (status !== undefined) company.status = status;
    if (gameDiscounts !== undefined) company.gameDiscounts = gameDiscounts;
    if (gameConfigurations !== undefined) {
      company.gameConfigurations = cleanGameConfigs;
      company.markModified("gameConfigurations");
    }

    await company.save();

    // Trigger recalculation if requested and write audit logs
    if (changedConfigs.length > 0) {
      const { recalculateCompanyBilling } = await import("@/lib/recalculate-billing");
      const { AdminAuditLog } = await import("@/models/AdminAuditLog");

      for (const change of changedConfigs) {
        const adminUserId = admin.user?._id?.toString() || "";
        const oldMinVal = (change.oldMin as number) ?? 60;
        if (body.recalculateUnbilled === true) {
          await recalculateCompanyBilling(
            id,
            change.gameId,
            oldMinVal,
            change.newMin,
            adminUserId
          );
        } else {
          // Log config changes without modifying existing unbilled entries
          await AdminAuditLog.create({
            action: "RECALCULATE_COMPANY_BILLING",
            adminId: adminUserId,
            targetUserId: adminUserId,
            reason: "Company Minimum Duration configuration changed (Apply only to future bookings)",
            details: {
              companyId: id.toString(),
              gameId: change.gameId.toString(),
              oldMinimumDuration: oldMinVal.toString(),
              newMinimumDuration: change.newMin.toString(),
              existingEntriesUpdated: "NO",
              entriesUpdated: "0",
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, company });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  try {
    const { id } = await params;
    const company = await Company.findById(id);
    if (!company || company.softDeleted) {
      return NextResponse.json({ success: false, message: "Company not found" }, { status: 404 });
    }

    company.softDeleted = true;
    await company.save();

    return NextResponse.json({ success: true, message: "Company soft-deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Failed to delete company" }, { status: 500 });
  }
}
