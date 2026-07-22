import { Offer } from "@/models/Offer";
import { Coupon } from "@/models/Coupon";
import { CouponUsage } from "@/models/CouponUsage";
import mongoose from "mongoose";

export interface PromotionCandidate {
  id: string;
  type: "AUTO_OFFER" | "COUPON";
  name: string;
  discountType: "FLAT" | "PERCENTAGE";
  value: number;
  maxDiscount?: number;
  canCombine: boolean;
  allowedOfferIds: string[];
  doc: any;
}

export interface AppliedPromotion {
  name: string;
  discountAmount: number;
  type: "AUTO_OFFER" | "COUPON";
}

export async function calculateBestDiscount(
  bookingCost: number,
  gameId: string,
  date: string,
  startTime: string,
  couponIdOrCode?: string,
  userId?: string | mongoose.Types.ObjectId
) {
  const [year, month, day] = date.split("-").map(Number);
  const bookingDate = new Date(year, month - 1, day);
  const dayOfWeek = bookingDate.getDay();
  const [hours] = startTime.split(":").map(Number);

  // 1. Fetch all active auto offers
  const autoOffers = await Offer.find({ active: true });
  const applicableAutoOffers: PromotionCandidate[] = [];

  for (const offer of autoOffers) {
    if (offer.daysOfWeek && offer.daysOfWeek.length > 0) {
      if (!offer.daysOfWeek.includes(dayOfWeek)) continue;
    }
    if (offer.startHour !== undefined && offer.endHour !== undefined) {
      if (hours < offer.startHour || hours > offer.endHour) continue;
    }
    const matchesGame =
      offer.applyToAllGames ||
      (!offer.gameId && (!offer.applicableGames || offer.applicableGames.length === 0)) ||
      (offer.applicableGames &&
        offer.applicableGames.some((g: any) => g.toString() === gameId.toString())) ||
      (offer.gameId && offer.gameId.toString() === gameId.toString());

    if (!matchesGame) continue;

    applicableAutoOffers.push({
      id: offer._id.toString(),
      type: "AUTO_OFFER",
      name: offer.name,
      discountType: offer.discountType as "FLAT" | "PERCENTAGE",
      value: offer.value,
      canCombine: offer.canCombine || false,
      allowedOfferIds: (offer.allowedOfferIds || []).map((id: any) => id.toString()),
      doc: offer,
    });
  }

  // 2. Fetch applied coupon (if any)
  let appliedCouponCandidate: PromotionCandidate | null = null;
  let couponError = "";

  if (couponIdOrCode) {
    const query = mongoose.Types.ObjectId.isValid(couponIdOrCode)
      ? { _id: couponIdOrCode }
      : { code: couponIdOrCode.toUpperCase() };

    const coupon = await Coupon.findOne({ ...query, active: true });
    if (!coupon) {
      couponError = "Coupon code is invalid or inactive.";
    } else if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      couponError = "Coupon has expired.";
    } else {
      const minVal = coupon.minimumOrderValue ?? coupon.minBookingAmount ?? 0;
      if (bookingCost < minVal) {
        couponError = `This coupon is valid only on orders of ₹${minVal} or more.`;
      } else if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        couponError = "Coupon usage limit reached.";
      } else {
        if (userId) {
          const priorUsage = await CouponUsage.findOne({
            couponId: coupon._id,
            userId,
          });
          if (priorUsage) {
            couponError = "You have already used this coupon code.";
          }
        }

        if (!couponError) {
          appliedCouponCandidate = {
            id: coupon._id.toString(),
            type: "COUPON",
            name: coupon.code,
            discountType: (coupon.discountType || coupon.type) as "FLAT" | "PERCENTAGE",
            value: coupon.discountValue ?? coupon.value ?? 0,
            maxDiscount: coupon.maximumDiscount ?? coupon.maxDiscount ?? 0,
            canCombine: true, // Coupon can combine if the active auto-offers allow combining with it
            allowedOfferIds: [],
            doc: coupon,
          };
        }
      }
    }
  }

  // 3. Build compatibility and subsets
  const candidates: PromotionCandidate[] = [...applicableAutoOffers];
  if (appliedCouponCandidate) {
    candidates.push(appliedCouponCandidate);
  }

  // Recursive function to find the best compatible subset of promotions
  let bestSubset: PromotionCandidate[] = [];
  let maxTotalDiscount = 0;

  const checkMutualCompatibility = (subset: PromotionCandidate[]) => {
    for (let i = 0; i < subset.length; i++) {
      for (let j = i + 1; j < subset.length; j++) {
        const a = subset[i];
        const b = subset[j];

        // We can never combine two coupons
        if (a.type === "COUPON" && b.type === "COUPON") {
          return false;
        }

        // Compatibility checks
        if (a.type === "AUTO_OFFER" && b.type === "AUTO_OFFER") {
          if (!a.canCombine || !b.canCombine) return false;
          if (!a.allowedOfferIds.includes(b.id) || !b.allowedOfferIds.includes(a.id)) {
            return false;
          }
        } else {
          // One is Auto Offer, one is Coupon
          const autoOffer = a.type === "AUTO_OFFER" ? a : b;
          const coupon = a.type === "COUPON" ? a : b;
          if (!autoOffer.canCombine) return false;
          if (!autoOffer.allowedOfferIds.includes(coupon.id)) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const getSubsets = (arr: PromotionCandidate[]): PromotionCandidate[][] => {
    const results: PromotionCandidate[][] = [[]];
    for (const value of arr) {
      const len = results.length;
      for (let i = 0; i < len; i++) {
        results.push(results[i].concat(value));
      }
    }
    return results;
  };

  const allSubsets = getSubsets(candidates);

  for (const subset of allSubsets) {
    if (!checkMutualCompatibility(subset)) continue;

    // Calculate discount for this compatible subset in deterministic order:
    // 1. Auto Offers
    // 2. Coupon
    let runningCost = bookingCost;
    let subsetDiscount = 0;

    const autoOffersInSubset = subset.filter((p) => p.type === "AUTO_OFFER");
    const couponsInSubset = subset.filter((p) => p.type === "COUPON");

    // Apply auto offers first
    for (const offer of autoOffersInSubset) {
      let disc = 0;
      if (offer.discountType === "FLAT") {
        disc = offer.value;
      } else {
        disc = (runningCost * offer.value) / 100;
      }
      disc = Math.min(disc, runningCost);
      runningCost -= disc;
      subsetDiscount += disc;
    }

    // Apply coupon second
    for (const coupon of couponsInSubset) {
      let disc = 0;
      if (coupon.discountType === "FLAT") {
        disc = coupon.value;
      } else {
        disc = (runningCost * coupon.value) / 100;
      }
      if (coupon.maxDiscount && coupon.maxDiscount > 0) {
        disc = Math.min(disc, coupon.maxDiscount);
      }
      disc = Math.min(disc, runningCost);
      runningCost -= disc;
      subsetDiscount += disc;
    }

    if (subsetDiscount > maxTotalDiscount) {
      maxTotalDiscount = subsetDiscount;
      bestSubset = subset;
    }
  }

  // 4. Construct response of applied promotions with their exact individual discounts
  let runningCost = bookingCost;
  const appliedPromotions: AppliedPromotion[] = [];

  const autoOffersInBest = bestSubset.filter((p) => p.type === "AUTO_OFFER");
  const couponsInBest = bestSubset.filter((p) => p.type === "COUPON");

  for (const offer of autoOffersInBest) {
    let disc = 0;
    if (offer.discountType === "FLAT") {
      disc = offer.value;
    } else {
      disc = (runningCost * offer.value) / 100;
    }
    disc = Math.min(disc, runningCost);
    runningCost -= disc;
    appliedPromotions.push({
      name: offer.name,
      discountAmount: disc,
      type: "AUTO_OFFER",
    });
  }

  for (const coupon of couponsInBest) {
    let disc = 0;
    if (coupon.discountType === "FLAT") {
      disc = coupon.value;
    } else {
      disc = (runningCost * coupon.value) / 100;
    }
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      disc = Math.min(disc, coupon.maxDiscount);
    }
    disc = Math.min(disc, runningCost);
    runningCost -= disc;
    appliedPromotions.push({
      name: coupon.name,
      discountAmount: disc,
      type: "COUPON",
    });
  }

  // If a coupon code was passed but didn't make it into the best subset, check why to return error
  if (couponIdOrCode && couponsInBest.length === 0 && !couponError) {
    const couponObj = appliedCouponCandidate?.doc;
    if (couponObj) {
      const activeAutoOffers = applicableAutoOffers.filter((o) =>
        bestSubset.some((b) => b.id === o.id)
      );
      for (const offer of activeAutoOffers) {
        if (!offer.canCombine) {
          couponError = "This coupon cannot be combined with another promotion.";
        } else if (!offer.allowedOfferIds.includes(appliedCouponCandidate!.id)) {
          couponError = `${couponObj.code} cannot be combined with ${offer.name}.`;
        }
      }
    }
  }

  return {
    couponError,
    appliedPromotions,
    totalDiscount: maxTotalDiscount,
    payableAmount: Math.max(0, bookingCost - maxTotalDiscount),
  };
}
