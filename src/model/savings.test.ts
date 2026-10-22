import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS as base } from './params';
import {
  breakevenDistance,
  breakevenPriceGap,
  breakevenVolume,
  savings,
  savingsPct,
} from './savings';

describe('savings', () => {
  it('matches a hand-calculated baseline', () => {
    // 40*0.118 - 0.09*(24*1.601 - 0.1*1.719)
    expect(savings(base)).toBeCloseTo(1.2773, 3);
  });

  it('is zero at the break-even distance', () => {
    const distFar = breakevenDistance(base);
    expect(savings({ ...base, distFar })).toBeCloseTo(0, 9);
  });

  it('is zero at the break-even volume', () => {
    const volume = breakevenVolume(base);
    expect(savings({ ...base, volume })).toBeCloseTo(0, 9);
  });

  it('is zero at the break-even price gap', () => {
    const gap = breakevenPriceGap(base);
    expect(savings({ ...base, priceNear: base.priceFar + gap })).toBeCloseTo(0, 9);
  });

  it('never breaks even on volume when the far station is not cheaper', () => {
    expect(breakevenVolume({ ...base, priceNear: base.priceFar })).toBeNaN();
  });

  it('keeps the sign of savings in percent form', () => {
    expect(savingsPct(base)).toBeGreaterThan(0);
    expect(savingsPct({ ...base, distFar: 80 })).toBeLessThan(0);
  });
});
