/** A pair of prices for the two stations, in EUR/L. */
export interface PriceQuote {
  priceFar: number;
  priceNear: number;
}

/**
 * Where prices come from. The UI only depends on this interface, so a
 * CSV or API source can replace manual input without touching the model.
 */
export interface PriceSource {
  getQuote(): Promise<PriceQuote>;
}

/** Fixed prices, as typed in by the user. */
export class ManualPriceSource implements PriceSource {
  constructor(private readonly quote: PriceQuote) {}

  /** Returns the prices given at construction. */
  async getQuote(): Promise<PriceQuote> {
    return this.quote;
  }
}
