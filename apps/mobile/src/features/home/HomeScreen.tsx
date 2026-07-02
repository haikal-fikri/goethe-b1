import React from "react";
import { View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, ProgressBar } from "../../components/ui";
import { RingGauge } from "../../components/widgets";
import { FlameIcon } from "../../components/icons";
import { useProfile, useMyDaily, useMyProgress, useMyExamResults, computeStreak } from "../../lib/hooks";
import { SKILL_LABEL } from "@repo/types";

// 09 · Heute. Readiness (aus Prüfungsergebnissen), Serie, „Lernen"-Karten,
// „Nachschlagen ›" (→ Lernen im Heute-Stack). Klassenkarte in v1 ausgeblendet.
export function HomeScreen() {
  const { c, accent, fonts } = useTheme();
  const nav = useNavigation<any>();
  const profile = useProfile();
  const daily = useMyDaily();
  const progress = useMyProgress();
  const results = useMyExamResults();

  const streak = computeStreak(daily.data ?? []);
  const name = profile.data?.displayName ?? "";
  const passed = (results.data ?? []).filter((r) => r.bestanden).length;
  const readiness = results.data && results.data.length > 0 ? Math.round((passed / results.data.length) * 100) : 0;

  const examDate = profile.data?.examDate ? new Date(profile.data.examDate) : null;
  const daysLeft = examDate ? Math.ceil((examDate.getTime() - Date.now()) / 86400000) : null;

  const skills: { key: "schreiben" | "sprechen" | "shared"; col: string }[] = [
    { key: "schreiben", col: accent.gruen },
    { key: "sprechen", col: accent.blau },
    { key: "shared", col: accent.lila },
  ];

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 8 }}>
        <View>
          <AppText size={13} color={c.textMuted}>{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</AppText>
          <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 2 }}>Guten Tag{name ? `, ${name}` : ""}</AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: accent.goldTintLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
          <FlameIcon size={15} />
          <AppText role="serifMed" size={15} color={accent.goldText}>{streak}</AppText>
        </View>
      </View>

      {/* Readiness */}
      <Card style={{ borderRadius: 24, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Prüfungsbereit</Eyebrow>
          <AppText role="serif" size={36} color={c.textHi} style={{ marginTop: 2 }}>{readiness}%</AppText>
          {daysLeft != null && (
            <AppText size={12.5} color={c.textMuted} style={{ marginTop: 6 }}>
              Prüfung {examDate!.toLocaleDateString("de-DE", { day: "numeric", month: "long" })} · in {daysLeft} Tagen
            </AppText>
          )}
        </View>
        <RingGauge value={readiness / 100} />
      </Card>

      {/* Lernen-Karten */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 9 }}>
        <Eyebrow>Lernen</Eyebrow>
        <Pressable onPress={() => nav.navigate("Lernen")}>
          <AppText size={13} color={accent.gruen}>Nachschlagen ›</AppText>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {skills.map((s) => {
          const items = (progress.data ?? []).filter((p) => p.lessonId.startsWith(s.key));
          const mastered = items.filter((p) => p.masteredAt).length;
          const pct = items.length ? mastered / items.length : 0;
          return (
            <Card key={s.key} onPress={() => nav.navigate("Ueben")} style={{ flex: 1, padding: 13, gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: s.col + "22", alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 13, height: 13, borderRadius: 4, backgroundColor: s.col }} />
              </View>
              <AppText role="uiSemi" size={13.5} color={c.textHi}>{SKILL_LABEL[s.key]}</AppText>
              <ProgressBar value={pct} color={s.col} height={5} />
              <AppText size={11.5} color={c.textMuted} style={{ fontFamily: fonts.serif }}>{Math.round(pct * 100)}%</AppText>
            </Card>
          );
        })}
      </View>
    </>
  );
}
