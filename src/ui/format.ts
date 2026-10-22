/** Formats a signed money amount, for example "+1.28 EUR". */
export const eur = (x: number): string =>
  `${x < 0 ? '-' : '+'}${Math.abs(x).toFixed(2)} EUR`;

/** Formats a number with a unit, or "never" when it is not finite. */
export const withUnit = (x: number, unit: string, digits = 1): string =>
  Number.isFinite(x) ? `${x.toFixed(digits)} ${unit}` : 'never';
