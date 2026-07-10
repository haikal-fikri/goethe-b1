import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useSession } from "./session";
import * as db from "./db";
import * as api from "./api";

// react-query-Hooks über die RLS-gescopten db-Helfer. Alle „my“-Reads hängen
// an der user.id; ohne Session → disabled (leere Defaults).

export function useProfile() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["profile", uid], enabled: !!uid, queryFn: () => db.getProfile(uid!) });
}

/** Signierte Profilbild-URL (geroutet, Supabase Storage). staleTime < 1 h URL-TTL → rechtzeitig neu signieren. */
export function useAvatarUrl() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["avatarUrl", uid],
    enabled: !!uid,
    queryFn: () => api.getAvatarUrl(),
    staleTime: 50 * 60_000,
  });
}

export function useRedemittel() {
  const { configured } = useSession();
  const profile = useProfile();
  const lang = profile.data?.nativeLanguage ?? "en"; // 0011: Übersetzungs-Overlay je Muttersprache
  return useQuery({
    queryKey: ["redemittel", lang],
    enabled: configured,
    queryFn: () => db.getRedemittel(lang),
    staleTime: 10 * 60_000,
  });
}

/** Muttersprachen-Auswahl (nur enabled=true) für den Settings-Picker (0011). */
export function useLanguages() {
  const { configured } = useSession();
  return useQuery({ queryKey: ["languages"], enabled: configured, queryFn: db.getLanguages, staleTime: 60 * 60_000 });
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

// ── v2 Home (0012): Tagesmix-Status + wöchentliches Readiness-Δ ──────
export function useDailyMixToday() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["dailyMix", uid], enabled: !!uid, queryFn: () => db.getDailyMixToday() });
}

/** „+Δ diese Woche": Overall-Readiness heute − Snapshot von vor ~7 Tagen. */
export function useReadinessDelta() {
  const { session } = useSession();
  const uid = session?.user.id;
  const q = useQuery({ queryKey: ["readinessSnapshots", uid], enabled: !!uid, queryFn: () => db.getReadinessSnapshots() });
  const snaps = q.data ?? []; // captured_on desc
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const past = snaps.find((s) => s.capturedOn <= cutoffKey); // jüngster Snapshot ≥7 Tage alt
  return { weekAgoOverall: past ? past.overall : null, isLoading: q.isLoading };
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
      (["progress", "daily", "examResults", "readiness", "dailyStatus", "dailyMix", "readinessSnapshots"] as const).map((k) =>
        qc.invalidateQueries({ queryKey: [k, uid] })
      )
    );
  }, [qc, uid]);
}

// ── Klasse (0008 Reads + 0015 RPCs) ─────────────────────────────────
// class_enabled-gated: die Klasse-Screens laufen nur bei aktivem Flag; die
// Heute-Klassenkarte übergibt `enabled: classEnabled`, damit my_classes() NICHT
// läuft (und 0015 nicht voraussetzt), solange das Flag aus ist.
export function useMyClasses(opts?: { enabled?: boolean }) {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["myClasses", uid],
    enabled: !!uid && (opts?.enabled ?? true),
    queryFn: () => db.getMyClasses(),
  });
}

export function useClassAssignments(classId: string | undefined) {
  return useQuery({
    queryKey: ["classAssignments", classId],
    enabled: !!classId,
    queryFn: () => db.getClassAssignments(classId!),
  });
}

export function useMySubmissions() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({ queryKey: ["submissions", uid], enabled: !!uid, queryFn: () => db.getMySubmissions(uid!) });
}

export function useClassLeaderboard(classId: string | undefined) {
  return useQuery({
    queryKey: ["classLeaderboard", classId],
    enabled: !!classId,
    queryFn: () => db.getClassLeaderboard(classId!),
  });
}

/** Nach Beitritt/Verlassen die Klasse-Caches invalidieren (kein useMutation-Setup). */
export function useInvalidateClass() {
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  return useCallback(async () => {
    if (!uid) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["myClasses", uid] }),
      qc.invalidateQueries({ queryKey: ["submissions", uid] }),
      qc.invalidateQueries({ queryKey: ["classAssignments"] }), // Präfix-Match über classId
      qc.invalidateQueries({ queryKey: ["classLeaderboard"] }),
      qc.invalidateQueries({ queryKey: ["speakingSubmissions", uid] }),
      qc.invalidateQueries({ queryKey: ["speakingGrades", uid] }),
      qc.invalidateQueries({ queryKey: ["speakingAssignments"] }), // Präfix-Match
    ]);
  }, [qc, uid]);
}

// ── Sprechen (0009 Reads + Consent-RPC) ─────────────────────────────
export function useSpeakingAssignments(classId: string | undefined) {
  return useQuery({
    queryKey: ["speakingAssignments", classId],
    enabled: !!classId,
    queryFn: () => db.getSpeakingAssignments(classId!),
  });
}
export function useMySpeakingSubmissions() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["speakingSubmissions", uid],
    enabled: !!uid,
    queryFn: () => db.getMySpeakingSubmissions(uid!),
  });
}
export function useMySpeakingGrades() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["speakingGrades", uid],
    enabled: !!uid,
    queryFn: () => db.getMySpeakingGrades(),
  });
}
/** Einwilligungs-Gate (nur UX; der Server prüft autoritativ). Bei Re-Eintritt neu prüfen. */
export function useSpeakingConsent() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["speakingConsent", uid],
    enabled: !!uid,
    queryFn: () => db.isSpeakingConsentOk(uid!),
    staleTime: 5 * 60_000,
    refetchOnMount: true,
  });
}
/** Nach finalize die Sprech-Caches invalidieren (Submissions + Noten + Aufgaben-Status). */
export function useInvalidateSpeaking() {
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  return useCallback(async () => {
    if (!uid) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["speakingSubmissions", uid] }),
      qc.invalidateQueries({ queryKey: ["speakingGrades", uid] }),
      qc.invalidateQueries({ queryKey: ["speakingAssignments"] }),
    ]);
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
