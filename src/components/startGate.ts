import { useSyncExternalStore } from 'react';
import type { ScenarioId } from '../data/scenarios';
import type { DataMode } from '../lib/dataSource';

// Owner B: in-memory state for the start screen. It shows on every page load ("before the site
// starts") and can be reopened from the header. Not persisted on purpose.

export type Experience = 'console' | 'zoe';

export interface StartState {
  open: boolean;
  /** How the data was set up on the start screen (for the header chip). */
  mode?: DataMode;
  scenario?: ScenarioId;
}

let state: StartState = { open: true };
const listeners = new Set<() => void>();

function set(next: StartState) {
  state = next;
  listeners.forEach((l) => l());
}

export function openStart(): void {
  set({ ...state, open: true });
}

export function closeStart(mode: DataMode, scenario?: ScenarioId): void {
  set(scenario ? { open: false, mode, scenario } : { open: false, mode });
}

export function useStart(): StartState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
