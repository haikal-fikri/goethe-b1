import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, ProgressBar, LevelBadge, ListRow, Loading, NiveauChips } from "../../components/ui";
import { SKILL_ICON } from "../../components/icons";
import { useRedemittel, useMyProgress, useProfile } from "../../lib/hooks";
import { getSkillGroups, inLevelScope, type LevelScope } from "@repo/core";
import { SKILL_LABEL } from "@repo/types";

const SKILL_COL: Record<string, string> = { schreiben: "#1C8A5B", sprechen: "#2B7FD4", shared: "#7A52D9" };

// 14 · Übungsbereiche — 3 Skills mit Fortschritt.
export function UebenBereicheScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  const { data: items, isLoading } = useRedemittel();
  const progress = useMyProgress();
  const groups = useMemo(() => getSkillGroups(items ?? []), [items]);

  if (isLoading) return <Loading />;
  return (
    <>
      <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 8 }}>Übungsbereiche</AppText>
      <AppText size={14} color={c.textMuted} style={{ marginTop: 4, marginBottom: 16 }}>Wähle einen Bereich und trainiere Wendungen.</AppText>
      <View style={{ gap: 12 }}>
        {groups.map((g) => {
          const col = SKILL_COL[g.skill] ?? accent.gruen;
          const count = g.tasks.reduce((n, t) => n + t.functions.reduce((m, f) => m + f.count, 0), 0);
          const mastered = (progress.data ?? []).filter((p) => p.lessonId.startsWith(g.skill) && p.masteredAt).length;
          const pct = count ? Math.min(1, mastered / count) : 0;
          const Icon = SKILL_ICON[g.skill];
          return (
            <Card key={g.skill} onPress={() => nav.navigate("UebenArea", { skill: g.skill })} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: col + "22", alignItems: "center", justifyContent: "center" }}>
                <Icon size={22} color={col} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText role="uiSemi" size={15.5} color={c.textHi}>{SKILL_LABEL[g.skill]}</AppText>
                <AppText size={12.5} color={c.textMuted} style={{ marginBottom: 6 }}>{g.tasks.length} Aufgaben · {count} Wendungen</AppText>
                <ProgressBar value={pct} color={col} />
              </View>
            </Card>
          );
        })}
      </View>
    </>
  );
}

// 15 · Bereich-Detail — Kategorien (lessons) je Aufgabe. R2-3: Niveau-Filter (opt-in).
export function UebenAreaScreen() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const skill: string = route.params?.skill;
  const { data: items, isLoading } = useRedemittel();
  const profile = useProfile();
  const examLevel = profile.data?.level ?? "B1";
  const [scope, setScope] = useState<LevelScope>("exam");
  const groups = useMemo(() => getSkillGroups(items ?? []), [items]);
  const group = groups.find((g) => g.skill === skill);

  // Anzahl der Wendungen einer Funktion IM gewählten Niveau-Filter.
  const scopedCount = (f: { levels: string[]; countByLevel: Record<string, number> }) =>
    f.levels.reduce((n, lvl) => n + (inLevelScope(lvl as "B1", scope, examLevel) ? (f.countByLevel[lvl] ?? 0) : 0), 0);

  if (isLoading) return <Loading />;
  if (!group) return null;
  return (
    <>
      <AppText role="serif" size={24} color={c.textHi} style={{ marginTop: 8, marginBottom: 12 }}>{SKILL_LABEL[skill as "schreiben"]}</AppText>
      <NiveauChips value={scope} onChange={setScope} examLevel={examLevel} />
      <View style={{ gap: 18, marginTop: 16 }}>
        {group.tasks.map((t) => {
          const fns = t.functions.filter((f) => scopedCount(f) > 0);
          if (fns.length === 0) return null;
          return (
            <View key={t.taskCode}>
              <Eyebrow>{t.taskLabel}</Eyebrow>
              <Card style={{ marginTop: 8, paddingVertical: 4 }}>
                {fns.map((f, i) => (
                  <View key={f.functionCode}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
                    <ListRow
                      title={f.functionName}
                      subtitle={`${scopedCount(f)} Wendungen`}
                      right={<LevelBadge level={f.levels[0] ?? "B1"} />}
                      // BUG-7: Sprechen → Sprechen-Player; sonst Wortbank/Cloze. Niveau-Scope mitgeben.
                      onPress={() => nav.navigate(skill === "sprechen" ? "Speaking" : "Exercise", { lessonId: f.lessonId, levelScope: scope })}
                    />
                  </View>
                ))}
              </Card>
            </View>
          );
        })}
      </View>
    </>
  );
}
