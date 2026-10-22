import {
  breakevenDistance,
  breakevenPriceGap,
  breakevenVolume,
  savings,
  savingsPct,
} from '../model/savings';
import type { Params } from '../model/params';
import type { AppState, Store } from '../state';

/** Sets the text of the element with the given id. */
const setText = (id: string, text: string): void => {
  document.getElementById(id)!.textContent = text;
};

/**
 * One sentence describing the outcome for the chosen purchase.
 * @returns plain text, no markup
 */
function resultSentence(p: Params): string {
  const s = savings(p);
  const pct = savingsPct(p);
  const trip =
    `Buying ${p.volume.toFixed(1)} L at the farther station ` +
    `(${p.priceFar.toFixed(3)} EUR/L, ${p.distFar.toFixed(1)} km extra) ` +
    `instead of the nearer one (${p.priceNear.toFixed(3)} EUR/L)`;

  // below half a cent the two options are the same for practical purposes
  if (Math.abs(s) < 0.005) return `${trip} costs about the same.`;
  if (s > 0) return `${trip} saves ${s.toFixed(2)} EUR, ${pct.toFixed(1)} % of the nearer station’s cost.`;
  return `${trip} costs ${(-s).toFixed(2)} EUR more, ${(-pct).toFixed(1)} % over the nearer station’s cost.`;
}

/**
 * Fills the result sentence and the break-even lines, and keeps them current.
 */
export function mountReadout(store: Store<AppState>): void {
  const render = ({ params: p }: AppState): void => {
    setText('result', resultSentence(p));

    // longest detour that still pays off at this volume
    const dist = breakevenDistance(p);
    setText(
      'limit-distance',
      dist > 0
        ? `At ${p.volume.toFixed(1)} L the farther station is worth it up to ${dist.toFixed(1)} km extra.`
        : `At ${p.volume.toFixed(1)} L the farther station is not worth any extra driving.`,
    );

    // smallest purchase that pays off at this distance
    const vol = breakevenVolume(p);
    let volText = `At ${p.distFar.toFixed(1)} km extra you need to buy at least ${vol.toFixed(1)} L.`;
    if (Number.isNaN(vol)) volText = 'The farther station is not cheaper per litre, so buying more does not help.';
    else if (vol === 0) volText = `At ${p.distFar.toFixed(1)} km extra the farther station pays off at any volume.`;
    else if (vol > p.tank) volText += ` That is more than the ${p.tank} L tank.`;
    setText('limit-volume', volText);

    // smallest price difference that pays off for this purchase
    const gap = breakevenPriceGap(p);
    setText(
      'limit-gap',
      Number.isFinite(gap)
        ? `The price difference must be at least ${gap.toFixed(3)} EUR/L; it is ${(p.priceNear - p.priceFar).toFixed(3)} EUR/L.`
        : 'No fuel is bought, so there is no price difference to compare.',
    );

    setText('limit-burn', `The detour burns ${((p.consumption / 100) * p.distFar).toFixed(2)} L of fuel.`);
  };

  store.subscribe(render);
  render(store.get());
}
