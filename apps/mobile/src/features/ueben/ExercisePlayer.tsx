import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, AccentButton, PrimaryButton, LevelBadge, Loading, Center } from "../../components/ui";
import { CloseIcon, BulbIcon, SpeakerIcon } from "../../components/icons";
import { useRedemittel } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { recordAttempt } from "../../lib/db";
import {
  buildTiles, arraysEqual, buildClozePills, clozeBlanks, parseCloze, makeLessonId, type Tile,
} from "@repo/core";
import type { RedemittelItem } from "@repo/types";
import * as Speech from "expo-speech";

// 16–19 · Übung (Wortbank / Lückentext). Jede Einreichung ruft record_attempt
// (Server berechnet correct neu). „Prüfen" → Lösung → „Weiter" (nächstes Item).
export function ExercisePlayer() {
  const { c, accent, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const lessonId: string = route.params?.lessonId;
  const { session } = useSession();
  const { data: all, isLoading } = useRedemittel();

  const items = useMemo(
    () => (all ?? []).filter((it) => makeLessonId(it.skill, it.task.code, it.function.code) === lessonId && it.level === "B1"),
    [all, lessonId]
  );
  const [idx, setIdx] = useState(0);
  const item = items[idx];

  if (isLoading) return <Loading label="Übung wird geladen…" />;
  if (!item) return <Center><AppText color={c.textMuted}>Keine Übungen in dieser Kategorie.</AppText></Center>;

  const isCloze = Boolean(item.clozeTemplate);
  return (
    <ExerciseItem
      key={item.id}
      item={item}
      isCloze={isCloze}
      lessonId={lessonId}
      index={idx}
      total={items.length}
      uid={session?.user.id}
      onClose={() => nav.goBack()}
      onNext={() => (idx + 1 < items.length ? setIdx(idx + 1) : nav.goBack())}
    />
  );
}

function ExerciseItem({ item, isCloze, lessonId, index, total, uid, onClose, onNext }: {
  item: RedemittelItem; isCloze: boolean; lessonId: string; index: number; total: number;
  uid?: string; onClose: () => void; onNext: () => void;
}) {
  const { c, accent, radius, fonts } = useTheme();
  const solution = useMemo(() => (isCloze ? clozeBlanks(item.clozeTemplate ?? "") : item.tokens), [item, isCloze]);
  const pool = useMemo<Tile[]>(() => (isCloze ? buildClozePills(item) : buildTiles(item)), [item, isCloze]);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const usedIds = new Set(placed.map((t) => t.id));

  const check = async () => {
    const submitted = placed.map((t) => t.label);
    const localCorrect = arraysEqual(submitted, solution);
    setResult(localCorrect); // optimistisch; Server bestätigt
    if (uid) {
      await recordAttempt({ itemId: item.id, lessonId, kind: isCloze ? "cloze" : "wordbank", submittedTokens: submitted }).catch(() => {});
    }
  };

  const clozeParts = isCloze ? parseCloze(item.clozeTemplate ?? "") : [];
  let blankN = -1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      {/* Kopf */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onClose} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
          {Array.from({ length: total }).map((_, k) => (
            <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k <= index ? accent.gruen : c.track }} />
          ))}
        </View>
        <AppText size={12.5} color={c.textMuted}>{index + 1}/{total}</AppText>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
        <LevelBadge level={item.level} />
        <AppText size={13} color={c.textMuted}>{item.function.nameDe}</AppText>
      </View>

      {/* Prompt */}
      <Card style={{ marginTop: 12 }}>
        {isCloze ? (
          <AppText role="serif" size={19} color={c.textHi} lh={28}>
            {clozeParts.map((p, k) => {
              if (p.kind === "text") return <AppText key={k} role="serif" size={19} color={c.textHi}>{p.value}</AppText>;
              blankN++;
              const n = blankN;
              const filled = placed[n];
              return (
                <AppText key={k} role="serif" size={19} color={filled ? accent.blau : c.textFaint}>
                  {filled ? filled.label : "_____"}
                </AppText>
              );
            })}
          </AppText>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Eyebrow>Englisch</Eyebrow>
              <Pressable onPress={() => Speech.speak(item.phrase, { language: "de-DE" })} hitSlop={8}>
                <SpeakerIcon size={18} color={c.textMuted} />
              </Pressable>
            </View>
            <AppText role="serif" size={20} color={c.textHi} lh={28} style={{ marginTop: 8 }}>{item.translation}</AppText>
          </>
        )}
      </Card>

      {/* Antwort-Well */}
      {!isCloze && (
        <View style={{ minHeight: 60, marginTop: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.borderStrong, borderRadius: radius.tile, padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: c.surfaceSunken }}>
          {placed.map((t, k) => (
            <Pressable key={t.id} disabled={result !== null} onPress={() => setPlaced(placed.filter((_, i) => i !== k))}>
              <View style={{ backgroundColor: result === false ? accent.rot : result === true ? accent.gruen : accent.gruen, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.tile }}>
                <AppText role="uiSemi" size={15} color="#fff">{t.label}</AppText>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Wortbank */}
      {result === null && (
        <>
          <AppText size={12.5} color={c.textMuted} style={{ marginTop: 16, marginBottom: 8 }}>Wortbank · tippe zum Einsetzen</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {pool.map((t) => {
              const used = usedIds.has(t.id);
              return (
                <Pressable key={t.id} disabled={used} onPress={() => setPlaced([...placed, t])}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.tile, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: used ? 0.4 : 1 }}>
                    <AppText role="uiSemi" size={15} color={used ? c.textFaint : c.textHi} style={used ? { textDecorationLine: "line-through" } : undefined}>{t.label}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Lösung */}
      {result !== null && (
        <Card style={{ marginTop: 16, borderColor: result ? accent.gruen : accent.rot, backgroundColor: result ? accent.gruenTintLight : accent.rotTintLight }}>
          <AppText role="uiSemi" size={15} color={result ? accent.gruenDarkText : accent.rotText}>{result ? "Richtig!" : "Nicht ganz."}</AppText>
          <AppText role="serif" size={18} color={c.textHi} lh={26} style={{ marginTop: 8 }}>{item.phrase}</AppText>
          {item.examples?.[0] && (
            <AppText size={13.5} color={c.textMuted} lh={19} style={{ marginTop: 8, fontStyle: "italic" }}>{item.examples[0].de}</AppText>
          )}
        </Card>
      )}

      {/* Bottom */}
      <View style={{ position: "absolute", left: 18, right: 18, bottom: 24, flexDirection: "row", gap: 10 }}>
        {result === null ? (
          <>
            <View style={{ width: 50, height: 52, borderRadius: radius.input, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }}>
              <BulbIcon />
            </View>
            <PrimaryButton label="Prüfen" onPress={check} disabled={placed.length === 0} style={{ flex: 1 }} />
          </>
        ) : (
          <AccentButton label="Weiter" onPress={onNext} style={{ flex: 1 }} />
        )}
      </View>
    </View>
  );
}
