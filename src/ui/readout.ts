import {
  breakevenDistance,
  breakevenPriceGap,
  breakevenVolume,
  savings,
  savingsPct,
} from '../model/savings';
import type { AppState, Store } from '../state';
import { eur, withUnit } from './format';

/** Sets the text of the element with the given id. */
const setText = (id: string, text: string): void => {
  document.getElementById(id)!.textContent = text;
};

/**
 * Fills the result panel from the state and keeps it up to date.
 */
export function mountReadout(store: Store<AppState>): void {
  const render = ({ params: p }: AppState): void => {
    const s = savings(p);

    // headline verdict with colour class
    const verdict = document.getElementById('verdict')!;
    if (Math.abs(s) < 0.005) {
      verdict.textContent = 'Break-even';
      verdict.className = 'verdict';
    } else if (s > 0) {
      verdict.textContent = `Far station saves ${s.toFixed(2)} EUR`;
      verdict.className = 'verdict win';
    } else {
      verdict.textContent = `Near station saves ${(-s).toFixed(2)} EUR`;
      verdict.className = 'verdict lose';
    }

    setText('r_eur', eur(s));
    setText('r_pct', `${savingsPct(p).toFixed(2)} %`);
    setText('r_burn', `${((p.consumption / 100) * p.distFar).toFixed(2)} L`);
    setText('r_bed', withUnit(breakevenDistance(p), 'km'));
    setText('r_bev', withUnit(breakevenVolume(p), 'L'));

    const gap = breakevenPriceGap(p);
    setText(
      'r_beg',
      Number.isFinite(gap)
        ? `${gap.toFixed(3)} EUR/L (now ${(p.priceNear - p.priceFar).toFixed(3)})`
        : 'n/a',
    );
  };

  store.subscribe(render);
  render(store.get());
}
