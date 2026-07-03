import React from "react";
import { View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, LevelBadge } from "../../components/ui";
import { RingGauge } from "../../components/widgets";
import { FlameIcon } from "../../components/icons";
import { useProfile, useMyDaily, useMyReadiness, useMyDailyStatus, useMyProgress, computeStreak } from "../../lib/hooks";
import { SKILL_LABEL } from "@repo/types";
import type { Module } from "@repo/types";

// 09 · Heute. Readiness-Ring (v_readiness), Serie + Avatar, Tagesziel,
// „Lernen"-Karten (→ Lernbereich 12/15). Klassenkarte in v1 ausgeblendet.
export function HomeScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  const profile = useProfile();
  const daily = useMyDaily();
  const readiness = useMyReadiness();
  const dailyStatus = useMyDailyStatus();
  const progress = useMyProgress();
  const hasReview = (progress.data ?? []).some((p) => p.masteredAt); // „Wiederholen" erscheint, wenn Items fällig sind

  const streak = computeStreak(daily.data ?? []);
  const name = profile.data?.displayName ?? "";
  const initials = (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  // BUG-1: Readiness aus v_readiness (Modul-Scores → gewichtetes Gesamt, Schreiben höchstes Gewicht).
  const modScore = (m: Module) => (readiness.data ?? []).find((r) => r.module === m)?.score ?? 0;
  const overall = Math.round(0.5 * modScore("schreiben") + 0.25 * modScore("sprechen") + 0.25 * modScore("konnektoren"));

  const examLevel = profile.data?.level ?? "B1";
  const examDate = profile.data?.examDate ? new Date(profile.data.examDate) : null;
  const created = profile.data?.createdAt ? new Date(profile.data.createdAt) : null;
  const daysLeft = examDate ? Math.ceil((examDate.getTime() - Date.now()) / 86400000) : null;

  // On-Track-Signal (konvexe Rampe: erwartet = 80·f², f = Anteil der verstrichenen Prep-Zeit).
  let track: { label: string; col: string } | null = null;
  if (examDate && created && examDate.getTime() > created.getTime()) {
    const f = Math.max(0, Math.min(1, (Date.now() - created.getTime()) / (examDate.getTime() - created.getTime())));
    const expected = 80 * f * f;
    track = overall >= expected
      ? { label: "auf Kurs", col: accent.gruen }
      : overall > expected - 15
        ? { label: "etwas hinterher", col: accent.gold }
        : { label: "im Rückstand", col: accent.rot };
  }

  const goalMet = dailyStatus.data?.goalMetToday ?? false;

  const skills: { key: "schreiben" | "sprechen" | "shared"; col: string }[] = [
    { key: "schreiben", col: accent.gruen },
    { key: "sprechen", col: accent.blau },
    { key: "shared", col: accent.lila },
  ];

  return (
    <>
      {/* BUG-3: Kopf = Datum/Gruß · Serie-Pille + Avatar (→ Einstellungen 10) */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText size={13} color={c.textMuted}>{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</AppText>
          <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 2 }}>Guten Tag{name ? `, ${name}` : ""}</AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: accent.goldTintLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
            <FlameIcon size={15} />
            <AppText role="serifMed" size={15} color={accent.goldText}>{streak}</AppText>
          </View>
          <Pressable
            onPress={() => nav.navigate("Settings")}
            accessibilityRole="button" accessibilityLabel="Einstellungen"
            style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: accent.lila + "26", alignItems: "center", justifyContent: "center" }}
          >
            <AppText role="uiSemi" size={14} color={accent.lila}>{initials}</AppText>
          </Pressable>
        </View>
      </View>

      {/* BUG-1: Readiness-Ring aus v_readiness + On-Track-Signal */}
      <Card style={{ borderRadius: 24, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1 }}>
          {/* R2-4: Prüfungsniveau-Pille direkt neben dem Eyebrow-Text */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Eyebrow>Prüfungsbereit</Eyebrow>
            <LevelBadge level={examLevel} />
          </View>
          <AppText role="serif" size={36} color={c.textHi} style={{ marginTop: 2 }}>{overall}%</AppText>
          {daysLeft != null && (
            <AppText size={12.5} color={c.textMuted} style={{ marginTop: 6 }}>
              Prüfung {examDate!.toLocaleDateString("de-DE", { day: "numeric", month: "long" })} · in {daysLeft} Tagen
            </AppText>
          )}
          {track && (
            <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: track.col + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
              <AppText size={12} color={track.col}>{track.label}</AppText>
            </View>
          )}
        </View>
        <RingGauge value={overall / 100} />
      </Card>

      {/* Tagesziel-Meter (v_daily_status) */}
      <Card style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }}>
        <View>
          <AppText role="uiSemi" size={14} color={c.textHi}>Tagesziel</AppText>
          <AppText size={12} color={c.textMuted} style={{ marginTop: 2 }}>{goalMet ? "Heute erreicht — weiter so!" : "Übe eine Runde, um es zu erreichen"}</AppText>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: (goalMet ? accent.gruen : c.track) + (goalMet ? "22" : "") }}>
          <AppText size={13} color={goalMet ? accent.gruenDarkText : c.textMuted}>{goalMet ? "✓ erreicht" : "offen"}</AppText>
        </View>
      </Card>

      {/* „Wiederholen"-Karte (Gamification): → start_set('review') über den Übungs-Player */}
      {hasReview && (
        <Card onPress={() => nav.navigate("Exercise", { lessonId: "review", mode: "review" })}
          style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, borderColor: accent.gold + "44" }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: accent.gold + "22", alignItems: "center", justifyContent: "center" }}>
            <AppText size={20}>↻</AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText role="uiSemi" size={14.5} color={c.textHi}>Wiederholen</AppText>
            <AppText size={12.5} color={c.textMuted} style={{ marginTop: 2 }}>Frische fällige Wendungen wieder auf</AppText>
          </View>
          <AppText size={18} color={c.textFaint}>›</AppText>
        </Card>
      )}

      {/* BUG-2: Lernen-Karten → Lernbereich (12/15), KEINE Fortschrittsleiste */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 9 }}>
        <Eyebrow>Lernen</Eyebrow>
        <Pressable onPress={() => nav.navigate("Lernen")}>
          <AppText size={13} color={accent.gruen}>Nachschlagen ›</AppText>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {skills.map((s) => (
          <Card key={s.key} onPress={() => nav.navigate("LernenArea", { skill: s.key })} style={{ flex: 1, padding: 13, gap: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: s.col + "22", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 13, height: 13, borderRadius: 4, backgroundColor: s.col }} />
            </View>
            <AppText role="uiSemi" size={13.5} color={c.textHi}>{SKILL_LABEL[s.key]}</AppText>
          </Card>
        ))}
      </View>
    </>
  );
}
