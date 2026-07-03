import { useQuery } from "@tanstack/react-query";
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
