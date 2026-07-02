import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, ListRow, LevelBadge, Loading } from "../../components/ui";
import { useRedemittel, useProfile } from "../../lib/hooks";
import { getSkillGroups, getLessonItems } from "@repo/core";
import { SKILL_LABEL } from "@repo/types";

const SKILL_COL: Record<string, string> = { schreiben: "#1C8A5B", sprechen: "#2B7FD4", shared: "#7A52D9" };

// 11 · Lernen (Übersicht) — 3 Bereichskarten. Erreichbar nur von Heute.
export function LernenScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  const { data: items, isLoading } = useRedemittel();
  const groups = useMemo(() => getSkillGroups(items ?? []), [items]);
  if (isLoading) return <Loading />;
  return (
    <>
      <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 8 }}>Lernen</AppText>
      <AppText size={14} color={c.textMuted} style={{ marginTop: 4, marginBottom: 16 }}>Alle Redemittel zum Nachschlagen.</AppText>
      <View style={{ gap: 12 }}>
        {groups.map((g) => {
          const col = SKILL_COL[g.skill] ?? accent.gruen;
          const count = g.tasks.reduce((n, t) => n + t.functions.reduce((m, f) => m + f.count, 0), 0);
          return (
            <Card key={g.skill} onPress={() => nav.navigate("LernenArea", { skill: g.skill })} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: col + "22", alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: col }} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText role="uiSemi" size={15.5} color={c.textHi}>{SKILL_LABEL[g.skill]}</AppText>
                <AppText size={12.5} color={c.textMuted}>{g.tasks.length} Aufgaben · {count} Redemittel</AppText>
              </View>
              <AppText color={c.textFaint} size={18}>›</AppText>
            </Card>
          );
        })}
      </View>
    </>
  );
}

// 12 · Lernen · Bereich — Kategorien.
export function LernenAreaScreen() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const skill: string = route.params?.skill;
  const { data: items, isLoading } = useRedemittel();
  const groups = useMemo(() => getSkillGroups(items ?? []), [items]);
  const group = groups.find((g) => g.skill === skill);
  if (isLoading) return <Loading />;
  if (!group) return null;
  return (
    <>
      <AppText role="serif" size={24} color={c.textHi} style={{ marginTop: 8 }}>{SKILL_LABEL[skill as "schreiben"]}</AppText>
      <View style={{ gap: 18, marginTop: 16 }}>
        {group.tasks.map((t) => (
          <View key={t.taskCode}>
            <Eyebrow>{t.taskLabel}</Eyebrow>
            <Card style={{ marginTop: 8, paddingVertical: 4 }}>
              {t.functions.map((f, i) => (
                <View key={f.functionCode}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
                  <ListRow title={f.functionName} subtitle={`${f.count} Wendungen`} right={<LevelBadge level={f.levels[0] ?? "B1"} />}
                    onPress={() => nav.navigate("LernenCategory", { lessonId: f.lessonId, title: f.functionName })} />
                </View>
              ))}
            </Card>
          </View>
        ))}
      </View>
    </>
  );
}

// 13 · Redemittel · Kategorie — ausklappbare Zeilen mit Übersetzung (Muttersprache).
export function LernenCategoryScreen() {
  const { c, accent } = useTheme();
  const route = useRoute<any>();
  const lessonId: string = route.params?.lessonId;
  const title: string = route.params?.title ?? "Redemittel";
  const { data: items, isLoading } = useRedemittel();
  const list = useMemo(() => getLessonItems(items ?? [], lessonId, "B1"), [items, lessonId]);
  const [open, setOpen] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  return (
    <>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 8, marginBottom: 12 }}>{title}</AppText>
      <View style={{ gap: 10 }}>
        {list.map((it) => {
          const isOpen = open === it.id;
          return (
            <Card key={it.id} onPress={() => setOpen(isOpen ? null : it.id)}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <AppText role="serif" size={16.5} color={c.textHi} lh={22}>{it.phrase}</AppText>
                  <AppText size={13} color={c.textMuted} style={{ marginTop: 3 }}>{it.translation}</AppText>
                </View>
                <LevelBadge level={it.level} />
              </View>
              {isOpen && it.examples?.[0] && (
                <View style={{ marginTop: 10, backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12 }}>
                  <AppText role="serif" size={14.5} color={c.textBody} lh={20} style={{ fontStyle: "italic" }}>{it.examples[0].de}</AppText>
                  {it.examples[0].en && <AppText size={12.5} color={c.textMuted} style={{ marginTop: 4 }}>{it.examples[0].en}</AppText>}
                </View>
              )}
            </Card>
          );
        })}
      </View>
    </>
  );
}
