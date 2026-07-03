import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, AccentButton, SecondaryButton, LevelBadge, Loading, Center } from "../../components/ui";
import { CloseIcon, MicIcon, PlayIcon } from "../../components/icons";
import { useRedemittel, useProfile } from "../../lib/hooks";
import { makeLessonId, buildTiles, arraysEqual, pickExerciseKind, inLevelScope, type LevelScope, type Tile } from "@repo/core";
import { recordSpeechPractice } from "../../lib/db";

// 20–22 · Sprechen — on-device STT/TTS, speichert NICHTS („wird nicht bewertet").
// Kind pro Item per id-Hash: „wordbank" → 21 Wörter-ordnen (TTS-Prompt + Kacheln),
// sonst → 20/22 Aussprache (laut sprechen + STT-Wortabgleich). „langsamer" = Rate 0.6.
const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:„"»«]/g, "").trim();
const SLOW = 0.6;

export function SpeakingScreen() {
  const { c, accent, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const lessonId: string | undefined = route.params?.lessonId;
  const levelScope: LevelScope = route.params?.levelScope ?? "exam"; // R2-3
  const { data: all, isLoading } = useRedemittel();
  const profile = useProfile();
  const examLevel = profile.data?.level ?? "B1";

  const items = useMemo(() => {
    const sprechen = (all ?? []).filter((it) => it.skill === "sprechen" && inLevelScope(it.level, levelScope, examLevel));
    if (lessonId) return sprechen.filter((it) => makeLessonId(it.skill, it.task.code, it.function.code) === lessonId);
    return sprechen;
  }, [all, lessonId, levelScope, examLevel]);

  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [recognized, setRecognized] = useState("");
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const item = items[idx];

  useSpeechRecognitionEvent("result", (e) => setRecognized(e.results?.[0]?.transcript ?? ""));
  useSpeechRecognitionEvent("end", () => setListening(false));

  const arrange = item ? pickExerciseKind(item.id) === "wordbank" : false; // 21 vs 20/22
  const pool = useMemo<Tile[]>(() => (item && arrange ? buildTiles(item) : []), [item, arrange]);
  const usedIds = new Set(placed.map((t) => t.id));

  const speak = (rate = 1) => item && Speech.speak(item.phrase, { language: "de-DE", rate });
  const start = async () => {
    setRecognized("");
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: "de-DE", interimResults: true });
  };
  const stop = () => { ExpoSpeechRecognitionModule.stop(); setListening(false); };

  const next = () => {
    if (item) recordSpeechPractice(item.id).catch(() => {}); // Streak + Coverage (braucht 0010; still-fail ok)
    setRecognized(""); setPlaced([]); setResult(null); setListening(false);
    if (idx + 1 < items.length) setIdx(idx + 1); else nav.goBack();
  };

  if (isLoading) return <Loading />;
  if (!item) return <Center><AppText color={c.textMuted}>Keine Sprechübungen verfügbar.</AppText></Center>;

  const targetWords = item.phrase.split(/\s+/).map(norm).filter(Boolean);
  const saidWords = new Set(recognized.split(/\s+/).map(norm).filter(Boolean));
  const hit = targetWords.filter((w) => saidWords.has(w)).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
          {items.map((_, k) => <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k <= idx ? accent.blau : c.track }} />)}
        </View>
        <AppText size={12.5} color={c.textMuted}>{idx + 1}/{items.length}</AppText>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
        <LevelBadge level={item.level} />
        <AppText size={13} color={c.textMuted}>Sprechen · {item.function.nameDe}</AppText>
      </View>

      {arrange ? (
        // ── 21 · Wörter ordnen: TTS-Prompt (kein Text/Englisch) + Kacheln ──
        <>
          <Card style={{ marginTop: 12 }}>
            <Eyebrow>Hör zu und ordne die Wörter</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
              <Pressable onPress={() => speak(1)} style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: accent.blau, alignItems: "center", justifyContent: "center" }}>
                <PlayIcon size={20} />
              </Pressable>
              <Pressable onPress={() => speak(SLOW)} hitSlop={8}>
                <AppText size={13} color={accent.blau}>↻ langsamer</AppText>
              </Pressable>
            </View>
          </Card>

          {/* Antwort-Well */}
          <View style={{ minHeight: 60, marginTop: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.borderStrong, borderRadius: radius.tile, padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: c.surfaceSunken }}>
            {placed.map((t, k) => (
              <Pressable key={t.id} disabled={result !== null} onPress={() => setPlaced(placed.filter((_, i) => i !== k))}>
                <View style={{ backgroundColor: result === false ? accent.rot : accent.blau, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.tile }}>
                  <AppText role="uiSemi" size={15} color="#fff">{t.label}</AppText>
                </View>
              </Pressable>
            ))}
          </View>

          {result === null ? (
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
          ) : (
            <Card style={{ marginTop: 16, borderColor: result ? accent.gruen : accent.rot }}>
              <AppText role="uiSemi" size={15} color={result ? accent.gruenDarkText : accent.rotText}>{result ? "Richtig!" : "Nicht ganz."}</AppText>
              <AppText role="serif" size={17} color={c.textHi} style={{ marginTop: 6 }}>{item.phrase}</AppText>
            </Card>
          )}

          <View style={{ position: "absolute", left: 18, right: 18, bottom: Math.max(insets.bottom, 16) + 8 }}>
            {result === null ? (
              <AccentButton label="Prüfen" color={accent.blau} disabled={placed.length === 0}
                onPress={() => setResult(arraysEqual(placed.map((t) => t.label), item.tokens))} />
            ) : (
              <AccentButton label="Weiter" onPress={next} />
            )}
          </View>
        </>
      ) : (
        // ── 20/22 · Aussprache/Nachsprechen: laut sprechen + STT ──
        <>
          <Card style={{ marginTop: 12 }}>
            <Eyebrow>Sag diesen Satz</Eyebrow>
            <AppText role="serif" size={20} color={c.textHi} lh={28} style={{ marginTop: 8 }}>{item.phrase}</AppText>
            {recognized ? (
              <View style={{ marginTop: 10, backgroundColor: hit >= targetWords.length ? accent.gruenTintLight : accent.goldTintLight, borderRadius: 10, padding: 10 }}>
                <AppText size={13} color={hit >= targetWords.length ? accent.gruenDarkText : accent.goldText}>
                  {hit} von {targetWords.length} Wörtern erkannt
                </AppText>
              </View>
            ) : null}
          </Card>

          <View style={{ alignItems: "center", marginTop: 30, gap: 10 }}>
            <Pressable onPress={listening ? stop : start}
              style={{ width: 74, height: 74, borderRadius: 999, backgroundColor: listening ? accent.rot : accent.blau, alignItems: "center", justifyContent: "center" }}>
              <MicIcon size={30} color="#fff" strokeWidth={2} />
            </Pressable>
            <AppText size={13} color={c.textMuted}>{listening ? "Höre zu… tippe zum Stoppen" : "Tippe und sprich laut"}</AppText>
            <AppText size={11.5} color={c.textFaint}>Übung – wird nicht bewertet · läuft auf dem Gerät</AppText>
          </View>

          <View style={{ position: "absolute", left: 18, right: 18, bottom: Math.max(insets.bottom, 16) + 8, flexDirection: "row", gap: 10 }}>
            <SecondaryButton label="Modell" onPress={() => speak(1)} style={{ flex: 1 }} />
            <SecondaryButton label="langsamer" onPress={() => speak(SLOW)} style={{ flex: 1 }} />
            <AccentButton label="Weiter" color={accent.blau} onPress={next} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </View>
  );
}
