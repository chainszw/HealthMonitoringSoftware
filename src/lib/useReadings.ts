import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { API_TOKEN, API_URL } from './apiConfig';
import {
  getRoutineDay,
  localDay,
  markDone,
  markUndone,
  routineStreak,
  routineWeek,
  type RoutineTask,
} from './routine';
import { signIn, signOut } from './session';
import { getMissionDay } from './today';
import {
  addReading,
  clearReadings,
  deleteReading,
  getReadingsSnapshot,
  getRoutineSnapshot,
  loadMissionStart,
  loadRoutineLog,
  saveRoutineLog,
  subscribeRoutine,
  getSessionSnapshot,
  loadMission,
  resetToSeed,
  saveMission,
  subscribeReadings,
  subscribeSession,
  updateReading,
  type NewReading,
  type ReadingPatch,
} from './storage';
import { getSyncStatus, startSync, subscribeSyncStatus, type SyncStatus } from './sync';
import type { MissionProfileId } from './types';

/**
 * React access to stored readings. Components use this, never localStorage directly.
 * Every component using it sees the same data, including changes pulled by sync.
 * Starts background sync when VITE_API_URL is set; otherwise the app is local-only.
 */
export function useReadings() {
  const readings = useSyncExternalStore(subscribeReadings, getReadingsSnapshot);
  useEffect(() => {
    startSync(API_URL, { defaultToken: API_TOKEN });
  }, []);
  const add = useCallback((r: NewReading) => {
    addReading(r);
  }, []);
  const update = useCallback((id: string, patch: ReadingPatch) => {
    updateReading(id, patch);
  }, []);
  const remove = useCallback((id: string) => {
    deleteReading(id);
  }, []);
  const reset = useCallback(() => {
    resetToSeed();
  }, []);
  const clear = useCallback(() => {
    clearReadings();
  }, []);
  return { readings, add, update, remove, reset, clear };
}

/**
 * Who is signed in for sync, plus sign-in/out for a sign-in screen. `signIn(token)` resolves to
 * `{ ok: true, crew }` or `{ ok: false, error }` (an error message to show).
 */
export function useSession() {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot);
  const signInWithToken = useCallback((token: string) => signIn(API_URL, token), []);
  return { session, signIn: signInWithToken, signOut };
}

/** Sync state for a status badge. `status` is 'disabled' when no server is configured. */
export function useSync(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}

export function useMission() {
  const [mission, setMissionState] = useState<MissionProfileId>(loadMission);
  const setMission = useCallback((id: MissionProfileId) => {
    saveMission(id);
    setMissionState(id);
  }, []);
  return { mission, setMission };
}

/**
 * Routine state for a task list (the tasks' text comes from content.json): today's items with
 * done times, the streak of fully done days, the last 7 days, and toggle(taskId).
 */
export function useRoutine<T extends RoutineTask>(tasks: T[]) {
  const log = useSyncExternalStore(subscribeRoutine, getRoutineSnapshot);
  const readings = useSyncExternalStore(subscribeReadings, getReadingsSnapshot);
  const toggle = useCallback((taskId: string) => {
    const current = loadRoutineLog();
    const done = current[localDay(new Date())]?.[taskId];
    saveRoutineLog(done ? markUndone(current, taskId) : markDone(current, taskId));
  }, []);
  return useMemo(() => {
    const now = new Date();
    return {
      day: getRoutineDay(tasks, log, now, readings),
      streak: routineStreak(tasks, log, now, readings),
      week: routineWeek(tasks, log, now, 7, readings),
      toggle,
    };
  }, [tasks, log, readings, toggle]);
}

/** Mission day (1-based) from the stored mission start, or from the first reading. */
export function useMissionDay(): number {
  const readings = useSyncExternalStore(subscribeReadings, getReadingsSnapshot);
  return getMissionDay(readings, new Date(), loadMissionStart());
}
