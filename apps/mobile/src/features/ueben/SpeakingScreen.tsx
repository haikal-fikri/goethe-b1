import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, AccentButton, SecondaryButton, LevelBadge, Loading, Center } from "../../components/ui";
import { CloseIcon, MicIcon, SpeakerIcon } from "../../components/icons";
import { useRedemittel } from "../../lib/hooks";
import { makeLessonId } from "@repo/core";

// 20–22 · Sprechen (Aussprache/Nachsprechen) — on-device STT/TTS. Speichert
// NICHTS („wird nicht bewertet · läuft auf dem Gerät"). Wortabgleich als Feedback.
const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:„"»«]/g, "").trim();

export function SpeakingScreen() {
  const { c, accent, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const lessonId: string | undefined = route.params?.lessonId;
  const { data: all, isLoading } = useRedemittel();

  const items = useMemo(() => {
    const sprechen = (all ?? []).filter((it) => it.skill === "sprechen" && it.level === "B1");
    if (lessonId) return sprechen.filter((it) => makeLessonId(it.skill, it.task.code, it.function.code) === lessonId);
    return sprechen;
  }, [all, lessonId]);

  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [recognized, setRecognized] = useState("");
  const item = items[idx];

  useSpeechRecognitionEvent("result", (e) => {
    const t = e.results?.[0]?.transcript ?? "";
    setRecognized(t);
  });
  useSpeechRecognitionEvent("end", () => setListening(false));

  const start = async () => {
    setRecognized("");
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: "de-DE", interimResults: true });
  };
  const stop = () => { ExpoSpeechRecognitionModule.stop(); setListening(false); };

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

      <View style={{ position: "absolute", left: 18, right: 18, bottom: 24, flexDirection: "row", gap: 10 }}>
        <SecondaryButton label="Modell" onPress={() => Speech.speak(item.phrase, { language: "de-DE" })} style={{ flex: 1 }} />
        <AccentButton label="Weiter" onPress={() => (idx + 1 < items.length ? (setIdx(idx + 1), setRecognized("")) : nav.goBack())} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
