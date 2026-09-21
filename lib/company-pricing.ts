import mongoose from "mongoose";
import { PricingRule } from "@/models/PricingRule";

/**
 * Safely extracts company minimum duration for a specific game.
 */
export function getCompanyMinDuration(
  company: any,
  gameId: any,
  defaultDuration: number = 60
): number {
  if (!company || !company.gameConfigurations || !Array.isArray(company.gameConfigurations)) {
    return defaultDuration || 60;
  }
  const targetIdStr = (gameId?._id || gameId || "").toString();
  const customConfig = company.gameConfigurations.find((gc: any) => {
    const configGameIdStr = (gc.gameId?._id || gc.gameId || "").toString();
    return configGameIdStr === targetIdStr;
  });
  return customConfig && customConfig.minimumDuration ? Number(customConfig.minimumDuration) : (defaultDuration || 60);
}

/**
 * Safely extracts company discount override for a specific game.
 */
export function getCompanyGameDiscount(company: any, gameId: any) {
  if (!company || !company.gameDiscounts || !Array.isArray(company.gameDiscounts)) {
    return null;
  }
  const targetIdStr = (gameId?._id || gameId || "").toString();
  return company.gameDiscounts.find((gd: any) => {
    const discountGameIdStr = (gd.gameId?._id || gd.gameId || "").toString();
    return discountGameIdStr === targetIdStr;
  });
}

/**
 * Finds the appropriate PricingRule for a company game unit (baseUnitMinutes).
 */
export async function getCompanyPricingRule(gameId: any, baseUnitMinutes: number) {
  const gameIdObj = typeof gameId === "string" ? new mongoose.Types.ObjectId(gameId) : (gameId?._id || gameId);

  // 1. Try exact duration match for 1 player first
  let rule = await PricingRule.findOne({
    gameId: gameIdObj,
    durationMinutes: baseUnitMinutes,
    minPlayers: { $lte: 1 },
    maxPlayers: { $gte: 1 },
    active: { $ne: false },
  }).lean();

  // 2. Try exact duration match for any player count
  if (!rule) {
    rule = await PricingRule.findOne({
      gameId: gameIdObj,
      durationMinutes: baseUnitMinutes,
      active: { $ne: false },
    }).lean();
  }

  // 3. Fallback: Any active rule for 1 player
  if (!rule) {
    rule = await PricingRule.findOne({
      gameId: gameIdObj,
      minPlayers: { $lte: 1 },
      maxPlayers: { $gte: 1 },
      active: { $ne: false },
    }).lean();
  }

  // 4. Fallback: Any active rule for this game
  if (!rule) {
    rule = await PricingRule.findOne({
      gameId: gameIdObj,
      active: { $ne: false },
    }).lean();
  }

  return rule;
}

/**
 * Calculates rate per company minimum duration unit (baseUnitMinutes).
 * Scales proportionally if only a rule for a different duration exists.
 */
export function calculateRatePerUnit(rule: any, baseUnitMinutes: number): number {
  if (!rule) return 0;

  let basePrice = rule.mode === "PER_PLAYER"
    ? (rule.pricePerPlayer || 0)
    : ((rule.baseCourtPrice || 0) + (rule.pricePerPlayer || 0));

  if (rule.durationMinutes && rule.durationMinutes !== baseUnitMinutes) {
    return Math.round(basePrice * (baseUnitMinutes / rule.durationMinutes));
  }

  return basePrice;
}
