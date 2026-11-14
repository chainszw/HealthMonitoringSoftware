import { useCallback, useState } from 'react';
import {
  addReading,
  clearReadings,
  loadMission,
  loadReadings,
  resetToSeed,
  saveMission,
  type NewReading,
} from './storage';
import type { MissionProfileId, Reading } from './types';

/** React access to stored readings. Components use this, never localStorage directly. */
export function useReadings() {
  const [readings, setReadings] = useState<Reading[]>(loadReadings);
  const add = useCallback((r: NewReading) => setReadings(addReading(r)), []);
  const reset = useCallback(() => setReadings(resetToSeed()), []);
  const clear = useCallback(() => setReadings(clearReadings()), []);
  return { readings, add, reset, clear };
}

export function useMission() {
  const [mission, setMissionState] = useState<MissionProfileId>(loadMission);
  const setMission = useCallback((id: MissionProfileId) => {
    saveMission(id);
    setMissionState(id);
  }, []);
  return { mission, setMission };
}
