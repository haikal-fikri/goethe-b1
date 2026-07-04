import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteDraft } from "./db";

// BUG-11: per-Aufgabe wall-clock deadlines + the single active simulation, persisted
// locally (AsyncStorage — non-sensitive; avoids a DB migration). remaining = deadline − now,
// so exit/re-entry/background never reset the timer. One sim active at a time; a sim has
// ≤3 Aufgaben → ≤3 concurrent timers automatically.

const DEADLINE_KEY = (taskId: string) => `exam:deadline:${taskId}`;
const ACTIVE_SIM_KEY = "exam:activeSim";

export async function getDeadline(taskId: string): Promise<number | null> {
  const v = await AsyncStorage.getItem(DEADLINE_KEY(taskId));
  return v ? Number(v) : null;
}
export async function setDeadline(taskId: string, epochMs: number): Promise<void> {
  await AsyncStorage.setItem(DEADLINE_KEY(taskId), String(epochMs));
}
export async function clearDeadline(taskId: string): Promise<void> {
  await AsyncStorage.removeItem(DEADLINE_KEY(taskId));
}

export async function getActiveSim(): Promise<number | null> {
  const v = await AsyncStorage.getItem(ACTIVE_SIM_KEY);
  return v ? Number(v) : null;
}
export async function setActiveSim(sim: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_SIM_KEY, String(sim));
}

/** Cross-Sim-Wechsel / „Verwerfen": Deadlines + Entwürfe einer Simulation löschen. */
export async function wipeSim(uid: string | undefined, taskIds: string[]): Promise<void> {
  await Promise.all(
    taskIds.flatMap((tid) => [
      clearDeadline(tid),
      uid ? deleteDraft(uid, tid).catch(() => {}) : Promise.resolve(),
    ])
  );
}
