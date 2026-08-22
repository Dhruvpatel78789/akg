import { Company } from "@/models/Company";
import { Game } from "@/models/Game";
import { recalculateCompanyBilling } from "./recalculate-billing";

export async function runCompanyMigration() {
  try {
    const games = await Game.find({ active: { $ne: false } }).lean();
    const gameMap = new Map(games.map(g => [g._id.toString(), g.duration || 60]));

    const companies = await Company.find({ softDeleted: false });

    for (const company of companies) {
      let updated = false;
      const currentConfigs = company.gameConfigurations || [];
      const currentConfigGameIds = new Set(currentConfigs.map((gc: any) => gc.gameId.toString()));

      const allowedIds = company.allowedGameIds || [];
      for (const gameIdObj of allowedIds) {
        const gameIdStr = gameIdObj.toString();
        if (!currentConfigGameIds.has(gameIdStr)) {
          const defaultDuration = gameMap.get(gameIdStr) || 60;
          currentConfigs.push({
            gameId: gameIdObj,
            minimumDuration: defaultDuration
          });
          updated = true;
        }
      }

      if (updated) {
        company.gameConfigurations = currentConfigs;
        await company.save();
        console.log(`Initialized default game configurations for company: ${company.name}`);
      }

      // Automatically recalculate existing unbilled entries as part of this startup run
      for (const config of company.gameConfigurations || []) {
        const gameIdStr = config.gameId.toString();
        const defaultDuration = gameMap.get(gameIdStr) || 60;
        await recalculateCompanyBilling(
          company._id.toString(),
          gameIdStr,
          defaultDuration, // old duration
          config.minimumDuration, // new duration
          "SYSTEM" // adminId string (will trigger default admin user resolver inside helper)
        );
      }
    }
  } catch (err) {
    console.error("Failed to run company game configurations migration:", err);
  }
}
