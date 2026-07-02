import React, { useMemo } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, ProgressBar, ListRow, Loading } from "../../components/ui";
import { useProfile, useMyDaily, useMyProgress, useMyExamResults, computeStreak } from "../../lib/hooks";
import { useSimulations } from "../../lib/hooks";
import type { StoredExamResult } from "@repo/types";

// 26 · Fortschritt — Serie, Gelernt, Woche; Bereitschaft je Modul;
// Probeprüfungen Schreiben (letzter Versuch je Simulation).
export function FortschrittScreen() {
  const { c, accent, fonts } = useTheme();
  const nav = useNavigation<any>();
  const profile = useProfile();
  const daily = useMyDaily();
  const progress = useMyProgress();
  const results = useMyExamResults();
  const sims = useSimulations();

  const streak = computeStreak(daily.data ?? []);
  const mastered = (progress.data ?? []).filter((p) => p.masteredAt).length;
  const total = progress.data?.length ?? 0;

  // letzter Versuch je Simulation (aggregiert über die 3 Aufgaben → Ø%)
  const perSim = useMemo(() => {
    const byId = new Map<number, StoredExamResult[]>();
    for (const r of results.data ?? []) {
      if (r.simulationId == null) continue;
      const arr = byId.get(r.simulationId) ?? [];
      arr.push(r); byId.set(r.simulationId, arr);
    }
    return Array.from(byId.entries()).map(([simId, rows]) => {
      const pts = rows.reduce((s, r) => s + Number(r.gesamtpunkte), 0);
      const max = rows.reduce((s, r) => s + Number(r.maxPunkte), 0);
      const pct = max ? Math.round((pts / max) * 100) : 0;
      const title = sims.data?.find((s) => s.id === simId)?.titleDe ?? `Simulation ${simId}`;
      return { simId, pct, title, status: pct >= 60 ? "Bestanden" : pct >= 50 ? "Knapp" : "Nicht best." };
    });
  }, [results.data, sims.data]);

  if (profile.isLoading || daily.isLoading) return <Loading />;

  const stat = (label: string, value: string) => (
    <View style={{ flex: 1 }}>
      <AppText role="serif" size={24} color={c.textHi}>{value}</AppText>
      <AppText size={12} color={c.textMuted}>{label}</AppText>
    </View>
  );
  const statusColor = (s: string) => (s === "Bestanden" ? accent.gruen : s === "Knapp" ? accent.gold : accent.rot);

  return (
    <>
      <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 8 }}>{profile.data?.displayName ?? "Fortschritt"}</AppText>
      <AppText size={13} color={c.textMuted} style={{ marginTop: 2, marginBottom: 16 }}>Goethe-Zertifikat B1</AppText>

      <Card style={{ flexDirection: "row" }}>
        {stat("Serie", `${streak} T.`)}
        {stat("Gelernt", `${mastered}/${total}`)}
        {stat("Übungen", `${(daily.data ?? []).reduce((s, d) => s + (d.attempts ?? 0), 0)}`)}
      </Card>

      <View style={{ height: 18 }} />
      <Eyebrow>Probeprüfungen · Schreiben</Eyebrow>
      <Card style={{ marginTop: 8, paddingVertical: 4 }}>
        {perSim.length === 0 ? (
          <AppText size={13.5} color={c.textMuted} style={{ padding: 8 }}>Noch keine Probeprüfung bewertet.</AppText>
        ) : perSim.map((s, i) => (
          <View key={s.simId}>
            {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
            <ListRow
              title={s.title}
              subtitle={s.status}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ backgroundColor: statusColor(s.status) + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <AppText role="serifMed" size={14} color={statusColor(s.status)}>{s.pct}%</AppText>
                  </View>
                </View>
              }
              onPress={() => nav.navigate("Probe", { simId: s.simId })}
            />
          </View>
        ))}
      </Card>
    </>
  );
}

// 27 · Probeprüfung Übersicht — die 3 Aufgaben einer Simulation.
export function ProbeScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const simId: number = route.params?.simId;
  const results = useMyExamResults();
  const rows = (results.data ?? []).filter((r) => r.simulationId === simId).sort((a, b) => a.aufgabe - b.aufgabe);
  const pts = rows.reduce((s, r) => s + Number(r.gesamtpunkte), 0);
  const max = rows.reduce((s, r) => s + Number(r.maxPunkte), 0);
  const bestanden = max ? pts / max >= 0.6 : false;

  return (
    <>
      <Card style={{ borderRadius: 24, marginTop: 8 }}>
        <Eyebrow>Gesamt</Eyebrow>
        <AppText role="serif" size={28} color={c.textHi} style={{ marginTop: 2 }}>{fmt(pts)} / {fmt(max)} Punkte</AppText>
        <AppText size={12.5} color={c.textMuted} style={{ marginTop: 4 }}>Bestehen ab 60 %</AppText>
        <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: (bestanden ? accent.gruen : accent.rot) + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
          <AppText size={13} color={bestanden ? accent.gruenDarkText : accent.rotText}>{bestanden ? "Bestanden" : "Nicht bestanden"}</AppText>
        </View>
      </Card>
      <Eyebrow>Aufgaben</Eyebrow>
      <Card style={{ marginTop: 8, paddingVertical: 4 }}>
        {rows.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
            <ListRow
              title={`Aufgabe ${r.aufgabe}`}
              subtitle={r.bestanden ? "Bestanden" : "Nicht bestanden"}
              right={<AppText role="serifMed" size={14} color={c.textHi}>{Math.round((Number(r.gesamtpunkte) / Number(r.maxPunkte)) * 100)}%</AppText>}
              onPress={() => nav.navigate("ExamResult", { result: r.result, task: undefined, persisted: true })}
            />
          </View>
        ))}
      </Card>
      <AppText size={12} color={c.textMuted} align="center" style={{ marginTop: 12 }}>Tippe eine Aufgabe für die vollständige Bewertung.</AppText>
    </>
  );
}

const fmt = (n: number) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: 1 });
