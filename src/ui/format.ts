/** Formats a signed money amount, for example "+1.28 EUR". */
export const eur = (x: number): string =>
  `${x < 0 ? '-' : '+'}${Math.abs(x).toFixed(2)} EUR`;
