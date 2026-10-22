import type { Params } from './params';

/**
 * Fuel burned on a detour.
 * @param dist extra driving in km
 * @returns litres burned
 */
const burned = (p: Params, dist: number): number => (p.consumption / 100) * dist;

/**
 * Total cost of refuelling at the near station: fuel bought plus fuel
 * burned on its detour (both paid at the near price), plus other km costs.
 */
export function nearCost(p: Params): number {
  return p.priceNear * (p.volume + burned(p, p.distNear)) + p.costPerKm * p.distNear;
}

/**
 * Money saved by driving to the far station instead of the near one.
 * Positive means the far station wins.
 */
export function savings(p: Params): number {
  // same fuel state at the end, so the far detour fuel is bought too
  const costFar =
    p.priceFar * (p.volume + burned(p, p.distFar)) + p.costPerKm * p.distFar;
  return nearCost(p) - costFar;
}

/** Savings as a percentage of the near-station cost (0 if that cost is 0). */
export function savingsPct(p: Params): number {
  const cost = nearCost(p);
  return cost > 0 ? (100 * savings(p)) / cost : 0;
}

/**
 * Longest extra distance to the far station that still saves money.
 * @returns km, or NaN when extra driving costs nothing per km
 */
export function breakevenDistance(p: Params): number {
  const perKm = (p.consumption / 100) * p.priceFar + p.costPerKm;
  // far cost equals near cost: Pf*V + perKm*D = nearCost
  return perKm > 0 ? (nearCost(p) - p.priceFar * p.volume) / perKm : NaN;
}

/**
 * Smallest purchase volume at which the far station pays off.
 * @returns litres (0 if it always pays off), or NaN if the far station is not cheaper
 */
export function breakevenVolume(p: Params): number {
  const gap = p.priceNear - p.priceFar;
  if (gap <= 0) return NaN;
  // solve V*(Pn - Pf) = extra far detour cost - extra near detour cost
  const farExtra = p.priceFar * burned(p, p.distFar) + p.costPerKm * p.distFar;
  const nearExtra = p.priceNear * burned(p, p.distNear) + p.costPerKm * p.distNear;
  return Math.max(0, (farExtra - nearExtra) / gap);
}

/**
 * Smallest price gap (EUR/L) between the stations for the far one to pay off,
 * keeping the far price fixed.
 * @returns EUR/L, or NaN when nothing is bought
 */
export function breakevenPriceGap(p: Params): number {
  const bf = burned(p, p.distFar);
  const bn = burned(p, p.distNear);
  const denom = p.volume + bn;
  // solve savings = 0 for the near price, then subtract the far price
  return denom > 0
    ? (p.priceFar * (bf - bn) + p.costPerKm * (p.distFar - p.distNear)) / denom
    : NaN;
}
