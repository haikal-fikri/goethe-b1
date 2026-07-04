import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, AccentButton, LevelBadge, Loading, Center } from "../../components/ui";
import { CloseIcon, SpeakerIcon, HeartIcon } from "../../components/icons";
import { WordArrange } from "../../components/WordArrange";
import { useRedemittel, useProfile } from "../../lib/hooks";
import { useInvalidateProgress } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { recordAttempt, startSet, type AttemptResult } from "../../lib/db";
import {
  buildTiles, arraysEqual, buildClozePills, clozeBlanks, parseCloze, makeLessonId, pickExerciseKind,
  inLevelScope, type LevelScope, type Tile,
} from "@repo/core";
import type { RedemittelItem } from "@repo/types";
import * as Speech from "expo-speech";

type Kind = "wordbank" | "cloze";

// 16–19 · Übung (Loop-to-Mastery + Herzen). start_set fixiert Items/Kinds/Herzen;
// jede Einreichung → session-aware record_attempt (Server berechnet correct neu,
// zählt Erstversuch, zieht Herzen bei erstem Fehlversuch, requeued falsche Items
// ans Ende). Set fertig → „Übung abgeschlossen". Fällt ohne 0010 auf den linearen
// Client-Ablauf zurück (kein Herzen/Punkte), damit die Übung immer funktioniert.
export function ExercisePlayer() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const lessonId: string = route.params?.lessonId;
  const mode: "category" | "review" | "daily_mix" = route.params?.mode ?? "category";
  const levelScope: LevelScope = route.params?.levelScope ?? "exam"; // R2-3
  const { session } = useSession();
  const uid = session?.user.id;
  const profile = useProfile();
  const examLevel = profile.data?.level ?? "B1";
  const invalidate = useInvalidateProgress();
  const { data: all, isLoading } = useRedemittel();

  const byId = useMemo(() => new Map((all ?? []).map((it) => [it.id, it])), [all]);
  const fallbackIds = useMemo(
    () => (all ?? []).filter((it) =>
      makeLessonId(it.skill, it.task.code, it.function.code) === lessonId && inLevelScope(it.level, levelScope, examLevel)
    ).map((it) => it.id),
    [all, lessonId, levelScope, examLevel]
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [heartsStart, setHeartsStart] = useState(0);
  const [heartsLeft, setHeartsLeft] = useState(0);
  const [kinds, setKinds] = useState<Map<string, Kind>>(new Map());
  const [queue, setQueue] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [ready, setReady] = useState(false);
  const [present, setPresent] = useState(0); // erhöht sich bei jedem Wechsel → ExerciseItem-Reset
  const startedRef = useRef(false);

  // Serverseitiges Set starten (einmal), sonst Fallback auf lokale Lektion.
  useEffect(() => {
    if (startedRef.current || !all) return;
    startedRef.current = true;
    const useFallback = () => {
      const ids = fallbackIds.slice(0, 12);
      setSessionId(null); setHeartsStart(0); setHeartsLeft(0);
      setKinds(new Map(ids.map((id) => [id, pickExerciseKind(id)])));
      setQueue(ids); setTotal(ids.length); setReady(true);
    };
    if (!uid) { useFallback(); return; }
    startSet(lessonId, mode, levelScope)
      .then((r) => {
        if ("error" in r || !r.items?.length) return useFallback();
        setSessionId(r.sessionId); setHeartsStart(r.hearts); setHeartsLeft(r.hearts);
        setKinds(new Map(r.items.map((it) => [it.id, it.kind])));
        setQueue(r.items.map((it) => it.id)); setTotal(r.items.length); setReady(true);
      })
      .catch(useFallback);
  }, [all, uid, lessonId, mode, fallbackIds]);

  const finish = (comp?: AttemptResult["result"]) => {
    invalidate();
    if (sessionId && comp) {
      nav.replace("UebungAbgeschlossen", {
        firstTryOk: comp.firstTryOk ?? 0, total, heartsLeft: comp.heartsLeft ?? heartsLeft,
        heartsStart, points: comp.points ?? 0, flawless: comp.flawless ?? false,
        dailyMixBonus: comp.dailyMixBonus ?? 0,
      });
    } else {
      nav.goBack();
    }
  };

  // Nach Prüfen: Server-Antwort verarbeiten (oder lokal im Fallback).
  const submit = async (itemId: string, kind: Kind, tokens: string[]): Promise<AttemptResult> => {
    if (!uid) return { correct: arraysEqualLocal(byId.get(itemId), kind, tokens) };
    const res = await recordAttempt({ itemId, lessonId, kind, submittedTokens: tokens, sessionId: sessionId ?? undefined });
    if (res.error) return { correct: arraysEqualLocal(byId.get(itemId), kind, tokens), error: res.error };
    if (typeof res.heartsLeft === "number") setHeartsLeft(res.heartsLeft);
    return res;
  };

  // Nach „Weiter": Queue fortschreiben (korrekt → raus, falsch → ans Ende) + evtl. Abschluss.
  const advance = (correct: boolean, comp?: AttemptResult["result"]) => {
    setQueue((q) => {
      const [head, ...rest] = q;
      const next = correct ? rest : [...rest, head];
      if (correct) setMastered((m) => m + 1);
      if (next.length === 0 || comp?.completed) { finish(comp); return next; }
      setPresent((p) => p + 1);
      return next;
    });
  };

  if (isLoading || !ready) return <Loading label="Übung wird geladen…" />;
  const currentId = queue[0];
  const item = currentId ? byId.get(currentId) : undefined;
  if (!item) return <Center><AppText color={undefined}>Keine Übungen in dieser Kategorie.</AppText></Center>;
  const kind: Kind = kinds.get(item.id) ?? pickExerciseKind(item.id);

  return (
    <ExerciseItem
      key={`${item.id}:${present}`}
      item={item}
      kind={kind}
      mastered={mastered}
      total={total}
      hearts={sessionId ? { start: heartsStart, left: heartsLeft } : null}
      onClose={() => nav.goBack()}
      submit={(tokens) => submit(item.id, kind, tokens)}
      onNext={advance}
    />
  );
}

function arraysEqualLocal(item: RedemittelItem | undefined, kind: Kind, tokens: string[]): boolean {
  if (!item) return false;
  const sol = kind === "cloze" ? clozeBlanks(item.clozeTemplate ?? "") : item.tokens;
  return arraysEqual(tokens, sol);
}

function Hearts({ start, left }: { start: number; left: number }) {
  const { accent, c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {Array.from({ length: start }).map((_, i) => (
        <HeartIcon key={i} size={18} strokeWidth={1.9} color={i < left ? accent.gruen : c.textFaint} />
      ))}
    </View>
  );
}

function ExerciseItem({ item, kind, mastered, total, hearts, onClose, submit, onNext }: {
  item: RedemittelItem; kind: Kind; mastered: number; total: number;
  hearts: { start: number; left: number } | null;
  onClose: () => void; submit: (tokens: string[]) => Promise<AttemptResult>; onNext: (correct: boolean, comp?: AttemptResult["result"]) => void;
}) {
  const { c, accent, radius, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const isCloze = kind === "cloze";
  const solution = useMemo(() => (isCloze ? clozeBlanks(item.clozeTemplate ?? "") : item.tokens), [item, isCloze]);
  const pool = useMemo<Tile[]>(() => (isCloze ? buildClozePills(item) : buildTiles(item)), [item, isCloze]);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const [comp, setComp] = useState<AttemptResult["result"]>(null);
  const [busy, setBusy] = useState(false);
  const usedIds = new Set(placed.map((t) => t.id));

  const check = async () => {
    if (busy) return;
    setBusy(true);
    const submitted = placed.map((t) => t.label);
    const res = await submit(submitted);
    setResult(res.correct ?? arraysEqual(submitted, solution));
    setComp(res.result ?? null);
    setBusy(false);
  };

  const clozeParts = isCloze ? parseCloze(item.clozeTemplate ?? "") : [];
  let blankN = -1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      {/* Kopf: Schließen · segmentierter Fortschritt (gemeistert/total) · Herzen */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onClose} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
          {Array.from({ length: total }).map((_, k) => (
            <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k < mastered ? accent.gruen : c.track }} />
          ))}
        </View>
        {hearts ? <Hearts start={hearts.start} left={hearts.left} /> : <AppText size={12.5} color={c.textMuted}>{mastered}/{total}</AppText>}
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
              const filled = placed[blankN];
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

      {/* Word-Bank: Drag&Drop-Arrange (Antwort-Well + Wortbank) mit Tipp-Fallback */}
      {!isCloze && (
        <WordArrange pool={pool} placed={placed} onChange={setPlaced} locked={result !== null} color={accent.gruen} result={result} />
      )}

      {/* Cloze: Pills antippen, um Lücken zu füllen */}
      {isCloze && result === null && (
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
        <Card style={{ marginTop: 16, borderColor: result ? accent.gruen : accent.rot }}>
          <AppText role="uiSemi" size={15} color={result ? accent.gruenDarkText : accent.rotText}>
            {result ? "Richtig!" : "Nicht ganz — kommt später nochmal."}
          </AppText>
          <AppText role="serif" size={17} color={c.textHi} style={{ marginTop: 6 }}>{item.tokens.join(" ")}</AppText>
        </Card>
      )}

      {/* Aktion (R2-6: Safe-Area-Abstand unten) */}
      <View style={{ position: "absolute", left: 18, right: 18, bottom: Math.max(insets.bottom, 16) + 8 }}>
        {result === null ? (
          <AccentButton label="Prüfen" color={c.primaryBtnBg} loading={busy} disabled={placed.length === 0}
            onPress={check} style={{ backgroundColor: c.primaryBtnBg }} />
        ) : (
          <AccentButton label="Weiter" onPress={() => onNext(result, comp)} />
        )}
      </View>
    </View>
  );
}
