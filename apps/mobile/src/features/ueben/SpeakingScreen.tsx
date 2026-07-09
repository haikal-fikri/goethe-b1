import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, AccentButton, SecondaryButton, LevelBadge, Loading, Center, Hearts, GameOver } from "../../components/ui";
import { CloseIcon, MicIcon, PlayIcon } from "../../components/icons";
import { WordArrange } from "../../components/WordArrange";
import { useRedemittel, useProfile, useInvalidateProgress } from "../../lib/hooks";
import { makeLessonId, buildTiles, arraysEqual, pickExerciseKind, inLevelScope, type LevelScope, type Tile } from "@repo/core";
import { recordSpeechPractice } from "../../lib/db";
import { speakDe, ensureSpeechAudioMode, resetSpeechAudioMode } from "../../lib/tts";

// 20–22 · Sprechen — on-device STT/TTS, speichert NICHTS („wird nicht bewertet").
// Kind pro Item per id-Hash: „wordbank" → 21 Wörter-ordnen (TTS-Prompt + Kacheln),
// sonst → 20/22 Aussprache (laut sprechen + STT-Wortabgleich). „langsamer" = Rate 0.6.
// R2: Read-aloud stoppt bei Teil-Erkennung → Retry-Prompt; Weiter-Gate bis alles
// erkannt (Escape nach MAX_TRIES Fehlversuchen bzw. bei verweigertem Mikro).
// R3: Herzen rein lokal (Server-Spiegel 0012: 3 bei ≤8 Items, sonst 4; Boden 0,
// kein Fail-out) — nur falsches Anordnen-Prüfen zieht ab, read-aloud nie.
const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:„"»«]/g, "").trim();
const SLOW = 0.6;

type SpeechPhase = "idle" | "listening" | "retry" | "success";
// R2: Weiter-Gate — "escape" = nach MAX_TRIES Fehlversuchen freigeben ("hard"/"none" per Konstante umschaltbar).
const GATE: "hard" | "escape" | "none" = "escape";
const MAX_TRIES = 3;

export function SpeakingScreen() {
  const { c, accent, tint } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const lessonId: string | undefined = route.params?.lessonId;
  const levelScope: LevelScope = route.params?.levelScope ?? "exam"; // R2-3
  const { data: all, isLoading } = useRedemittel();
  const profile = useProfile();
  const examLevel = profile.data?.level ?? "B1";
  const invalidate = useInvalidateProgress();

  const items = useMemo(() => {
    const sprechen = (all ?? []).filter((it) => it.skill === "sprechen" && inLevelScope(it.level, levelScope, examLevel));
    if (lessonId) return sprechen.filter((it) => makeLessonId(it.skill, it.task.code, it.function.code) === lessonId);
    return sprechen;
  }, [all, lessonId, levelScope, examLevel]);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<SpeechPhase>("idle");
  const phaseRef = useRef<SpeechPhase>("idle"); // synchron zur Phase — Event-Guards ohne Stale-Closure/StrictMode-Doppel
  const setPhaseSync = (p: SpeechPhase) => { phaseRef.current = p; setPhase(p); };
  const startingRef = useRef(false); // synchroner Guard für das Permission-await-Fenster von start()
  const [tries, setTries] = useState(0);
  const [micDenied, setMicDenied] = useState(false);
  const [passed, setPassed] = useState(false); // einmal alle Wörter erkannt → Weiter bleibt frei (auch bei erneutem Aufnehmen)
  const [recognized, setRecognized] = useState("");
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const [heartsLost, setHeartsLost] = useState(0);
  const [gameOver, setGameOver] = useState(false); // Herzen leer → Runde vorbei
  const item = items[idx];

  // R3: Zweistufigkeit wie start_set (0012): 3 Herzen bei ≤8 Items, sonst 4.
  const heartsStart = items.length <= 8 ? 3 : 4;
  const heartsLeft = Math.max(0, heartsStart - heartsLost);

  const wordsOf = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);
  const targetWords = useMemo(() => (item ? wordsOf(item.phrase) : []), [item]); // konstant je Item
  const allHit = (transcript: string) => {
    if (targetWords.length === 0) return true; // degenerierte Phrase → nie blockieren
    const said = new Set(wordsOf(transcript));
    return targetWords.every((w) => said.has(w));
  };

  useSpeechRecognitionEvent("result", (e) => {
    const t = e.results?.[0]?.transcript ?? "";
    setRecognized(t);
    if (phaseRef.current === "listening" && allHit(t)) {
      ExpoSpeechRecognitionModule.stop(); // Auto-Stopp, sobald alles erkannt (auch interim)
      setPhaseSync("success");
      setPassed(true);
    }
  });
  useSpeechRecognitionEvent("end", () => {
    resetSpeechAudioMode(); // STT hinterlässt .playAndRecord/measurement → nächste TTS setzt die Session neu
    if (phaseRef.current !== "listening") return; // success/idle (Weiter/Abbruch) bleiben stehen
    setTries((n) => n + 1);
    setPhaseSync("retry");
  });

  const arrange = item ? pickExerciseKind(item.id) === "wordbank" : false; // 21 vs 20/22
  const pool = useMemo<Tile[]>(() => (item && arrange ? buildTiles(item) : []), [item, arrange]);

  const speak = (rate = 1) => { if (item) speakDe(item.phrase, rate).catch(() => {}); };
  const start = async () => {
    if (phaseRef.current === "listening" || startingRef.current) return; // Doppel-Tap-Guard (deckt auch das Permission-await-Fenster)
    startingRef.current = true;
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { setMicDenied(true); return; } // ohne Mikro feuert nie ein "end" → Gate freigeben
      setRecognized("");
      setPhaseSync("listening");
      ExpoSpeechRecognitionModule.start({ lang: "de-DE", interimResults: true });
    } finally {
      startingRef.current = false;
    }
  };
  const stop = () => ExpoSpeechRecognitionModule.stop(); // Phase wechselt über das "end"-Event

  const next = () => {
    if (phaseRef.current === "listening") ExpoSpeechRecognitionModule.abort(); // spätes "end" → no-op auf idle
    if (heartsLeft === 0) { invalidate().catch(() => {}); setGameOver(true); return; } // Herzen leer (nur falsches Anordnen zieht ab)
    if (item) {
      // Erfolg = Anordnen korrekt geprüft ODER alle Wörter per STT erkannt. Der 3-Versuch-Escape
      // und verweigertes Mikro zählen als Aktivität (Serie), aber NICHT als gemeistert.
      const success = arrange ? result === true : passed === true;
      const firstTry = arrange ? result === true : (passed === true && tries === 0);
      recordSpeechPractice(item.id, success, firstTry).catch(() => {}); // Readiness+XP bei Erfolg, sonst Coverage/Serie
      if (success || idx + 1 >= items.length) invalidate().catch(() => {}); // Ring/Gelernt/Serie sofort nachladen
    }
    setRecognized(""); setPlaced([]); setResult(null); setPhaseSync("idle"); setTries(0);
    setMicDenied(false); setPassed(false); // pro Item frisch — sonst leckt eine Verweigerung/ein Erfolg aufs nächste
    if (idx + 1 < items.length) setIdx(idx + 1); else nav.goBack();
  };

  // Game-over-Neustart (lokal, keine Session): gleiches Set ab vorn, volle Herzen.
  const retry = () => {
    setGameOver(false); setIdx(0); setHeartsLost(0);
    setRecognized(""); setPlaced([]); setResult(null); setPhaseSync("idle");
    setTries(0); setMicDenied(false); setPassed(false);
  };

  useEffect(() => { ensureSpeechAudioMode(); }, []); // R1: Session hörbar machen, bevor der erste Play-Tap kommt
  useEffect(() => () => { ExpoSpeechRecognitionModule.abort(); Speech.stop(); }, []); // Unmount-Cleanup

  if (isLoading) return <Loading />;
  if (!item) return <Center><AppText color={c.textMuted}>Keine Sprechübungen verfügbar.</AppText></Center>;
  if (gameOver) return <GameOver heartsStart={heartsStart} mastered={idx} total={items.length} onRetry={retry} onExit={() => nav.goBack()} />;

  const saidWords = new Set(wordsOf(recognized));
  const hit = targetWords.filter((w) => saidWords.has(w)).length;
  const listening = phase === "listening";
  const canProceed = GATE === "none" || passed || micDenied || (GATE === "escape" && tries >= MAX_TRIES);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
          {items.map((_, k) => <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k <= idx ? accent.blau : c.track }} />)}
        </View>
        <Hearts start={heartsStart} left={heartsLeft} />
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

          {/* 21 · Wörter ordnen per Drag & Drop (Tipp-Fallback) */}
          <WordArrange pool={pool} placed={placed} onChange={setPlaced} locked={result !== null} color={accent.blau} result={result} />

          {result !== null && (
            <Card style={{ marginTop: 16, borderColor: result ? accent.gruen : accent.rot }}>
              <AppText role="uiSemi" size={15} color={result ? accent.gruenDarkText : accent.rotText}>{result ? "Richtig!" : "Nicht ganz."}</AppText>
              <AppText role="serif" size={17} color={c.textHi} style={{ marginTop: 6 }}>{item.phrase}</AppText>
            </Card>
          )}

          <View style={{ position: "absolute", left: 18, right: 18, bottom: Math.max(insets.bottom, 16) + 8 }}>
            {result === null ? (
              <AccentButton label="Prüfen" color={accent.blau} disabled={placed.length === 0}
                onPress={() => {
                  const ok = arraysEqual(placed.map((t) => t.label), item.tokens);
                  setResult(ok);
                  if (!ok) setHeartsLost((n) => n + 1); // R3: nur Anordnen zieht Herzen; read-aloud nie
                }} />
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
            {phase === "success" ? (
              <View style={{ marginTop: 10, backgroundColor: tint("gruen"), borderRadius: 10, padding: 10 }}>
                <AppText size={13} color={accent.gruenDarkText}>Alle Wörter erkannt — sehr gut!</AppText>
              </View>
            ) : phase === "retry" ? (
              <View style={{ marginTop: 10, backgroundColor: tint("gold"), borderRadius: 10, padding: 10 }}>
                <AppText size={13} color={accent.goldText}>{hit} von {targetWords.length} Wörtern erkannt — versuch es noch einmal.</AppText>
                {canProceed ? (
                  <AppText size={12} color={c.textMuted} style={{ marginTop: 4 }}>Du kannst trotzdem weitermachen.</AppText>
                ) : null}
              </View>
            ) : micDenied ? (
              <View style={{ marginTop: 10, backgroundColor: tint("gold"), borderRadius: 10, padding: 10 }}>
                <AppText size={13} color={accent.goldText}>Mikrofon nicht erlaubt — du kannst trotzdem weitermachen.</AppText>
              </View>
            ) : recognized ? (
              <View style={{ marginTop: 10, backgroundColor: tint("gold"), borderRadius: 10, padding: 10 }}>
                <AppText size={13} color={accent.goldText}>{hit} von {targetWords.length} Wörtern erkannt</AppText>
              </View>
            ) : null}
          </Card>

          <View style={{ alignItems: "center", marginTop: 30, gap: 10 }}>
            <Pressable onPress={listening ? stop : start}
              style={{ width: 74, height: 74, borderRadius: 999, backgroundColor: listening ? accent.rot : accent.blau, alignItems: "center", justifyContent: "center" }}>
              <MicIcon size={30} color="#fff" strokeWidth={2} />
            </Pressable>
            <AppText size={13} color={c.textMuted}>
              {listening ? "Höre zu… tippe zum Stoppen" : phase === "retry" ? "Tippe und versuch es noch einmal" : "Tippe und sprich laut"}
            </AppText>
            <AppText size={11.5} color={c.textFaint}>Übung – wird nicht bewertet · läuft auf dem Gerät</AppText>
          </View>

          <View style={{ position: "absolute", left: 18, right: 18, bottom: Math.max(insets.bottom, 16) + 8, flexDirection: "row", gap: 10 }}>
            {/* Während der Aufnahme gesperrt — sonst würde das Modell-TTS ins offene Mikro laufen und den Satz „von selbst" erkennen. */}
            <SecondaryButton label="Modell" onPress={() => speak(1)} disabled={listening} style={{ flex: 1 }} />
            <SecondaryButton label="langsamer" onPress={() => speak(SLOW)} disabled={listening} style={{ flex: 1 }} />
            <AccentButton label="Weiter" color={accent.blau} onPress={next} disabled={!canProceed} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </View>
  );
}
