import type { Params } from '../model/params';
import type { AppState, Store, ViewMode } from '../state';

/** One number input bound to a field of the state. */
interface Field {
  id: string;
  target: 'params' | 'view';
  key: keyof Params | 'mapMaxDist';
  positive?: boolean; // must be > 0, not just >= 0
}

const FIELDS: Field[] = [
  { id: 'volume', target: 'params', key: 'volume' },
  { id: 'distFar', target: 'params', key: 'distFar' },
  { id: 'consumption', target: 'params', key: 'consumption', positive: true },
  { id: 'priceFar', target: 'params', key: 'priceFar' },
  { id: 'priceNear', target: 'params', key: 'priceNear' },
  { id: 'distNear', target: 'params', key: 'distNear' },
  { id: 'costPerKm', target: 'params', key: 'costPerKm' },
  { id: 'tank', target: 'params', key: 'tank', positive: true },
  { id: 'mapMaxDist', target: 'view', key: 'mapMaxDist', positive: true },
];

/** Reads a field's current value out of the state. */
function read(state: AppState, f: Field): number {
  return f.target === 'params' ? state.params[f.key as keyof Params] : state.mapMaxDist;
}

/**
 * Keeps the selected point (volume, distFar) inside the map ranges, so the
 * marker cannot end up off the chart after a range change.
 */
function clampSelection(state: AppState): AppState {
  const volume = Math.min(state.params.volume, state.params.tank);
  const distFar = Math.min(state.params.distFar, state.mapMaxDist);
  return { ...state, params: { ...state.params, volume, distFar } };
}

/**
 * Binds the form inputs to the store, in both directions.
 * Typing updates the state; state changes (such as map clicks) update the inputs.
 */
export function mountControls(store: Store<AppState>): void {
  const input = (id: string) => document.getElementById(id) as HTMLInputElement;

  // typing: validate, write to the store, clamp the selection
  for (const f of FIELDS) {
    input(f.id).addEventListener('input', (e) => {
      const x = parseFloat((e.target as HTMLInputElement).value);
      if (!Number.isFinite(x) || x < 0 || (f.positive && x <= 0)) return;

      const s = store.get();
      const next: AppState =
        f.target === 'params'
          ? { ...s, params: { ...s.params, [f.key]: x } }
          : { ...s, mapMaxDist: x };
      const { params, mapMaxDist } = clampSelection(next);
      store.set({ params, mapMaxDist });
    });
  }

  const mode = document.getElementById('mode') as HTMLSelectElement;
  mode.addEventListener('change', () => store.set({ mode: mode.value as ViewMode }));

  // store to inputs, skipping the one being typed in
  store.subscribe((s) => {
    for (const f of FIELDS) {
      const el = input(f.id);
      if (document.activeElement !== el) el.value = String(Number(read(s, f).toFixed(3)));
    }
  });
  FIELDS.forEach((f) => (input(f.id).value = String(read(store.get(), f))));
}
