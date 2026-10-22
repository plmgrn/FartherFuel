/** Inputs of the detour model. Distances are total extra driving (round trip). */
export interface Params {
  consumption: number; // L/100 km
  priceFar: number; // EUR/L at the farther station
  priceNear: number; // EUR/L at the nearer station
  distFar: number; // km of extra driving to the farther station
  distNear: number; // km of extra driving to the nearer station
  volume: number; // L of fuel bought
  tank: number; // L, upper limit for the volume axis
  costPerKm: number; // EUR/km for wear, time value and similar
}

/** Baseline values shown on first load. */
export const DEFAULT_PARAMS: Params = {
  consumption: 9,
  priceFar: 1.601,
  priceNear: 1.719,
  distFar: 24,
  distNear: 0.1,
  volume: 40,
  tank: 60,
  costPerKm: 0,
};
