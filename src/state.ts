import { DEFAULT_PARAMS, type Params } from './model/params';

/** What the map colours show. */
export type ViewMode = 'eur' | 'pct';

/** Everything the UI renders from. */
export interface AppState {
  params: Params;
  mapMaxDist: number; // km, top of the distance axis
  mode: ViewMode;
}

/** State on first load. */
export const initialState: AppState = {
  params: DEFAULT_PARAMS,
  mapMaxDist: 60,
  mode: 'eur',
};

/** Minimal observable store. */
export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: (state: T) => void): void;
}

/**
 * Creates a store holding one immutable state object.
 * `set` shallow-merges the patch and notifies all subscribers.
 */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners: Array<(state: T) => void> = [];

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(listener) {
      listeners.push(listener);
    },
  };
}
