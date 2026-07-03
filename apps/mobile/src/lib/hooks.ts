import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useSession } from "./session";
import * as db from "./db";

// react-query-Hooks über die RLS-gescopten db-Helfer. Alle „my“-Reads hängen
// an der user.id; ohne Session → disabled (leere Defaults).

export function useProfile() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["profile", uid], enabled: !!uid, queryFn: () => db.getProfile(uid!) });
}

export function useRedemittel() {
  const { configured } = useSession();
  return useQuery({ queryKey: ["redemittel"], enabled: configured, queryFn: db.getRedemittel, staleTime: 10 * 60_000 });
}

export function useSimulations() {
  const { configured } = useSession();
  return useQuery({ queryKey: ["simulations"], enabled: configured, queryFn: db.getSimulations, staleTime: 10 * 60_000 });
}

export function useMyProgress() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["progress", uid], enabled: !!uid, queryFn: () => db.getMyProgress(uid!) });
}

export function useMyDaily() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["daily", uid], enabled: !!uid, queryFn: () => db.getMyDaily(uid!) });
}

export function useMyExamResults() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["examResults", uid], enabled: !!uid, queryFn: () => db.getMyExamResults(uid!) });
}

// ── Gamification-Reads (0010) ───────────────────────────────────────
export function useMyReadiness() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["readiness", uid], enabled: !!uid, queryFn: () => db.getMyReadiness() });
}

export function useMyDailyStatus() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["dailyStatus", uid], enabled: !!uid, queryFn: () => db.getMyDailyStatus() });
}

/**
 * BUG-1 / Gamification: nach jedem Schreibpfad (record_attempt, complete_set, Grade)
 * die betroffenen „my“-Caches invalidieren, damit Readiness/Gelernt/Serie sofort
 * nachladen (statt bis zu 60 s stale zu bleiben). Ohne Session ein No-op.
 */
export function useInvalidateProgress() {
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  return useCallback(async () => {
    if (!uid) return;
    await Promise.all(
      (["progress", "daily", "examResults", "readiness", "dailyStatus"] as const).map((k) =>
        qc.invalidateQueries({ queryKey: [k, uid] })
      )
    );
  }, [qc, uid]);
}

/**
 * BUG-4 „Woche": Vordergrund-Sitzungszeit erfassen und periodisch (alle 30 s + beim
 * Hintergrund) über bump_active_seconds nach daily_activity.active_seconds flushen.
 * Einmal im Root montieren. Braucht 0010 (schlägt sonst still fehl).
 */
export function useActiveTimeTracker() {
  const { session } = useSession();
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    let active = AppState.currentState === "active";
    let start = Date.now();
    const flush = () => {
      if (!active) return;
      const secs = Math.round((Date.now() - start) / 1000);
      start = Date.now();
      if (secs > 0) db.bumpActiveSeconds(secs).catch(() => {});
    };
    const interval = setInterval(flush, 30_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") { active = true; start = Date.now(); }
      else { flush(); active = false; }
    });
    return () => { clearInterval(interval); sub.remove(); flush(); };
  }, [uid]);
}

/** Streak in Tagen aus daily_activity (aufeinanderfolgende aktive UTC-Tage). */
export function computeStreak(days: { day: string; attempts: number; examsGraded?: number }[]): number {
  const active = new Set(days.filter((d) => (d.attempts ?? 0) > 0 || (d.examsGraded ?? 0) > 0).map((d) => d.day));
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (active.has(key)) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
    else if (streak === 0 && key === new Date().toISOString().slice(0, 10)) { d.setUTCDate(d.getUTCDate() - 1); }
    else break;
  }
  return streak;
}
