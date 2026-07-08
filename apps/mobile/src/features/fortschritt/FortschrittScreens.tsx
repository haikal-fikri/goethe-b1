import React, { useMemo } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, ProgressBar, ListRow, Loading, LevelBadge } from "../../components/ui";
import { RingGauge } from "../../components/widgets";
import { FlameIcon, CheckCircle } from "../../components/icons";
import {
  useProfile, useMyDaily, useMyProgress, useMyExamResults, useSimulations, useMyReadiness, computeStreak,
} from "../../lib/hooks";
import { useRedemittel } from "../../lib/hooks";
import { levelCountUpTo, levelIdSetUpTo } from "@repo/core";
import type { StoredExamResult, ExamSimulation, Module } from "@repo/types";

// ── ENH-1: Probeprüfung-Zustandsmaschine (client-seitig; kein neuer Hook/SQL) ──
type SimState = "NOT_STARTED" | "PARTIAL" | "COMPLETE";
interface SimRow {
  simId: number; title: string; state: SimState;
  gradedCount: number; totalAufgaben: number;
  partialPoints: number; partialMax: number;
  totalPoints?: number; totalMax?: number; totalPct?: number;
  status?: "Bestanden" | "Knapp" | "Nicht best.";
}

/** Neuester Versuch je (simId, aufgabe). Results sind created_at desc → first-seen gewinnt. */
function dedupeLatest(results: StoredExamResult[]): Map<string, StoredExamResult> {
  const m = new Map<string, StoredExamResult>();
  for (const r of results) {
    if (r.simulationId == null) continue;
    const key = `${r.simulationId}:${r.aufgabe}`;
    if (!m.has(key)) m.set(key, r);
  }
  return m;
}

/** Zustand einer Simulation aus Set-Coverage über die tatsächlichen exam_tasks. */
function simState(sim: ExamSimulation, latest: Map<string, StoredExamResult>): SimRow {
  const aufgaben = sim.tasks.map((t) => t.aufgabe);
  const N = aufgaben.length;
  const gradedRows = aufgaben
    .map((a) => latest.get(`${sim.id}:${a}`))
    .filter((r): r is StoredExamResult => !!r);
  const k = gradedRows.length;
  const state: SimState = k === 0 ? "NOT_STARTED" : k < N ? "PARTIAL" : "COMPLETE";
  const partialPoints = gradedRows.reduce((s, r) => s + Number(r.gesamtpunkte), 0);
  const partialMax = gradedRows.reduce((s, r) => s + Number(r.maxPunkte), 0);
  const base: SimRow = {
    simId: sim.id, title: sim.titleDe, state, gradedCount: k, totalAufgaben: N, partialPoints, partialMax,
  };
  if (state !== "COMPLETE") return base;
  const totalPct = partialMax ? Math.round((partialPoints / partialMax) * 100) : 0;
  const status: SimRow["status"] = totalPct >= 60 ? "Bestanden" : totalPct >= 50 ? "Knapp" : "Nicht best.";
  return { ...base, totalPoints: partialPoints, totalMax: partialMax, totalPct, status };
}

const MODULE_LABEL: Record<Module, string> = { schreiben: "Schreiben", sprechen: "Sprechen", konnektoren: "Konnektoren" };

// 26 · Fortschritt — Serie/Gelernt/Woche (3 Karten); Bereitschaft je Modul;
// Probeprüfungen · Schreiben (Coverage-Zustand je Simulation).
export function FortschrittScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  const profile = useProfile();
  const daily = useMyDaily();
  const progress = useMyProgress();
  const results = useMyExamResults();
  const sims = useSimulations();
  const readiness = useMyReadiness();
  const catalog = useRedemittel();

  const streak = computeStreak(daily.data ?? []);
  const examLevel = profile.data?.level ?? "B1";

  // BUG-5 + R2-1: Nenner = Katalog KUMULATIV bis zum Prüfungsniveau (≤ examLevel), Zähler = dort
  // gemeisterte Items. Höherstufen fügt die extra Wendungen hinzu und behält bereits Gelerntes.
  // Spiegelt den kumulativen v_readiness-Filter (migration 0013).
  const total = levelCountUpTo(catalog.data ?? [], examLevel);
  const levelIds = useMemo(() => levelIdSetUpTo(catalog.data ?? [], examLevel), [catalog.data, examLevel]);
  const mastered = (progress.data ?? []).filter((p) => p.masteredAt && levelIds.has(p.itemId)).length;

  // BUG-4: „Woche" = Σ active_seconds der letzten 7 UTC-Tage ÷3600 (eine Dezimale, de-DE).
  const weekHours = useMemo(() => {
    const keys = new Set<string>();
    const d = new Date();
    for (let i = 0; i < 7; i++) { keys.add(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1); }
    const sec = (daily.data ?? []).filter((x) => keys.has(x.day)).reduce((s, x) => s + (x.activeSeconds ?? 0), 0);
    return (sec / 3600).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }, [daily.data]);

  // ENH-1: Zustand ALLER Simulationen; Ø nur über COMPLETE.
  const perSim = useMemo(() => {
    const latest = dedupeLatest(results.data ?? []);
    return (sims.data ?? []).map((sim) => simState(sim, latest));
  }, [results.data, sims.data]);
  const complete = perSim.filter((s) => s.state === "COMPLETE");
  const avgPct = complete.length ? Math.round(complete.reduce((s, r) => s + (r.totalPct ?? 0), 0) / complete.length) : null;

  // BUG-1: Modul-Bereitschaft aus v_readiness (0 bis v_readiness/Übung greift).
  const modScore = (m: Module) => (readiness.data ?? []).find((r) => r.module === m)?.score ?? 0;
  const modules: { m: Module; col: string }[] = [
    { m: "schreiben", col: accent.gruen }, { m: "sprechen", col: accent.blau }, { m: "konnektoren", col: accent.lila },
  ];

  if (profile.isLoading || daily.isLoading) return <Loading />;

  const statusColor = (s?: string) => (s === "Bestanden" ? accent.gruen : s === "Knapp" ? accent.gold : accent.rot);
  const statusText = (s?: string) => (s === "Bestanden" ? accent.gruenDarkText : s === "Knapp" ? accent.goldText : accent.rotText);

  const StatCard = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
    <Card style={{ flex: 1, gap: 3, paddingVertical: 14, paddingHorizontal: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {icon}
        <AppText role="serif" size={22} color={c.textHi}>{value}</AppText>
      </View>
      <AppText size={11.5} color={c.textMuted}>{label}</AppText>
    </Card>
  );

  return (
    <>
      {/* „Fortschritt"-Titel + Prüfungsniveau-Pille oben rechts (statt „Goethe-Zertifikat B1") */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <AppText role="serif" size={26} color={c.textHi}>Fortschritt</AppText>
        <LevelBadge level={examLevel} />
      </View>
      {profile.data?.displayName ? (
        <AppText size={13} color={c.textMuted} style={{ marginTop: 2, marginBottom: 16 }}>{profile.data.displayName}</AppText>
      ) : <View style={{ height: 16 }} />}

      {/* BUG-4: drei getrennte Karten mit Abstand; Serie mit Flamme */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard label="Serie" value={`${streak}`} icon={<FlameIcon size={16} />} />
        <StatCard label="Gelernt" value={`${mastered}/${total}`} />
        <StatCard label="Woche" value={`${weekHours}h`} />
      </View>

      {/* BUG-1: Bereitschaft je Modul (v_readiness) */}
      <View style={{ height: 18 }} />
      <Eyebrow>Bereitschaft je Modul</Eyebrow>
      <Card style={{ marginTop: 8, gap: 12 }}>
        {modules.map(({ m, col }) => (
          <View key={m} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText size={13} color={c.textHi}>{MODULE_LABEL[m]}</AppText>
              <AppText role="serifMed" size={13} color={c.textMuted}>{modScore(m)}%</AppText>
            </View>
            <ProgressBar value={modScore(m) / 100} color={col} height={6} />
          </View>
        ))}
      </Card>

      {/* ENH-1: Probeprüfungen · Schreiben */}
      <View style={{ height: 18 }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Eyebrow>Probeprüfungen · Schreiben</Eyebrow>
        <AppText role="serifMed" size={13} color={c.textMuted}>Ø {avgPct != null ? `${avgPct}%` : "–"}</AppText>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {perSim.length === 0 ? (
          <AppText size={13.5} color={c.textMuted} style={{ padding: 8 }}>Noch keine Probeprüfung.</AppText>
        ) : perSim.map((s, i) => (
          <View key={s.simId}>
            {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
            <ListRow
              title={s.title}
              subtitle={
                s.state === "NOT_STARTED" ? "Nicht begonnen"
                  : s.state === "PARTIAL" ? `${s.gradedCount} von ${s.totalAufgaben} Aufgaben bewertet`
                    : s.status
              }
              right={
                s.state === "PARTIAL" ? (
                  <RingGauge value={s.gradedCount / s.totalAufgaben} size={46} color={accent.gold} label={`${s.gradedCount}/${s.totalAufgaben}`} />
                ) : s.state === "COMPLETE" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ backgroundColor: statusColor(s.status) + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <AppText role="serifMed" size={14} color={statusColor(s.status)}>{s.totalPct}%</AppText>
                    </View>
                    <CheckCircle size={20} color={accent.gruen} />
                  </View>
                ) : (
                  <AppText role="serifMed" size={14} color={c.textFaint}>0/{s.totalAufgaben}</AppText>
                )
              }
              onPress={() => nav.navigate("Probe", { simId: s.simId })}
            />
          </View>
        ))}
      </Card>
    </>
  );
}

// 27 · Probeprüfung Übersicht — Gesamt (Zustand) + alle N Aufgaben (bewertet → Bewertung, sonst CTA → Exam).
export function ProbeScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const simId: number = route.params?.simId;
  const results = useMyExamResults();
  const sims = useSimulations();

  const sim = (sims.data ?? []).find((s) => s.id === simId);
  const latest = useMemo(() => dedupeLatest(results.data ?? []), [results.data]);
  const row = sim ? simState(sim, latest) : null;

  if (!sim || !row) return <Loading />;

  const bandColor = (s?: string) => (s === "Bestanden" ? accent.gruen : s === "Knapp" ? accent.gold : accent.rot);
  const bandText = (s?: string) => (s === "Bestanden" ? accent.gruenDarkText : s === "Knapp" ? accent.goldText : accent.rotText);

  return (
    <>
      <Card style={{ borderRadius: 24, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Gesamt</Eyebrow>
          {row.state === "NOT_STARTED" ? (
            <AppText role="serif" size={22} color={c.textMuted} style={{ marginTop: 4 }}>Noch nicht bewertet</AppText>
          ) : (
            <AppText role="serif" size={28} color={c.textHi} style={{ marginTop: 2 }}>
              {fmt(row.state === "COMPLETE" ? row.totalPoints! : row.partialPoints)} / {fmt(row.state === "COMPLETE" ? row.totalMax! : row.partialMax)} Punkte
            </AppText>
          )}
          {row.state === "PARTIAL" && (
            <AppText size={12.5} color={c.textMuted} style={{ marginTop: 4 }}>{row.gradedCount} von {row.totalAufgaben} Aufgaben bewertet</AppText>
          )}
          {row.state === "COMPLETE" && (
            <>
              <AppText size={12.5} color={c.textMuted} style={{ marginTop: 4 }}>Bestehen ab 60 %</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <View style={{ backgroundColor: bandColor(row.status) + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <AppText size={13} color={bandText(row.status)}>{row.status}</AppText>
                </View>
                <CheckCircle size={20} color={accent.gruen} />
              </View>
            </>
          )}
        </View>
        {row.state === "COMPLETE" ? (
          <RingGauge value={(row.totalPct ?? 0) / 100} label={`${row.totalPct}%`} />
        ) : (
          <RingGauge value={row.gradedCount / row.totalAufgaben} size={72} color={accent.gold} label={`${row.gradedCount}/${row.totalAufgaben}`} />
        )}
      </Card>

      <View style={{ height: 4 }} />
      <Eyebrow>Aufgaben</Eyebrow>
      <Card style={{ marginTop: 8, paddingVertical: 4 }}>
        {sim.tasks.map((task, i) => {
          const r = latest.get(`${sim.id}:${task.aufgabe}`);
          return (
            <View key={task.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
              {r ? (
                <ListRow
                  title={`Aufgabe ${task.aufgabe}`}
                  subtitle={r.bestanden ? "Bestanden" : "Nicht bestanden"}
                  right={<AppText role="serifMed" size={14} color={c.textHi}>{Math.round((Number(r.gesamtpunkte) / Number(r.maxPunkte)) * 100)}%</AppText>}
                  onPress={() => nav.navigate("ExamResult", { result: r.result, task, persisted: true, fromProbe: true })}
                />
              ) : (
                <ListRow
                  title={`Aufgabe ${task.aufgabe}`}
                  subtitle="Nicht bewertet · Aufgabe schreiben"
                  right={<AppText size={13} color={accent.gruen}>Schreiben ›</AppText>}
                  onPress={() => nav.navigate("Exam", { taskId: task.id })}
                />
              )}
            </View>
          );
        })}
      </Card>
      <AppText size={12} color={c.textMuted} align="center" style={{ marginTop: 12 }}>Tippe eine Aufgabe für die vollständige Bewertung.</AppText>
    </>
  );
}

const fmt = (n: number) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 1 });
