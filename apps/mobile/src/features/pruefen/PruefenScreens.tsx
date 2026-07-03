import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenCapture from "expo-screen-capture";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, AccentButton, LevelBadge, Loading, Center, Screen } from "../../components/ui";
import { RingGauge, Segmented } from "../../components/widgets";
import { CloseIcon } from "../../components/icons";
import { useSimulations } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { getDraft, upsertDraft, deleteDraft } from "../../lib/db";
import { gradeStream, type GradeEvent } from "../../lib/api";
import type { ExamGrade, ExamResult, ExamTask, AufgabeNr } from "@repo/types";

// 23 · Prüfen (KI-Prüfer Landing) — Simulation 1–4 + Aufgabe 1/2/3.
export function PruefenLandingScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  const { data: sims, isLoading } = useSimulations();
  const [sim, setSim] = useState(1);
  const [auf, setAuf] = useState<AufgabeNr>(1);
  const [expanded, setExpanded] = useState(false); // BUG-9: „Ganze Aufgabe & Beispielaufsatz"

  if (isLoading) return <Loading />;
  const simulation = sims?.find((s) => s.id === sim) ?? sims?.[0];
  const task = simulation?.tasks.find((t) => t.aufgabe === auf) ?? simulation?.tasks[0];

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <AppText role="serif" size={26} color={c.textHi}>Prüfen</AppText>
        <View style={{ backgroundColor: accent.lilaTintLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
          <AppText size={12} color={accent.lila}>✦ KI-Prüfer</AppText>
        </View>
      </View>
      <AppText size={14} color={c.textMuted} style={{ marginTop: 4, marginBottom: 16 }}>Schreibe wie in der echten Prüfung — zwei KI-Prüfer bewerten unabhängig.</AppText>

      <Eyebrow>Simulation</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 14 }}>
        {(sims ?? []).map((s) => (
          <Pressable key={s.id} onPress={() => setSim(s.id)}
            style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: s.id === sim ? c.primaryBtnBg : c.surface, borderWidth: 1, borderColor: c.border }}>
            <AppText role="uiSemi" color={s.id === sim ? c.primaryBtnFg : c.textMuted}>{s.id}</AppText>
          </Pressable>
        ))}
      </View>
      <Segmented options={[1, 2, 3].map((n) => ({ label: `Aufgabe ${n}`, value: n as AufgabeNr }))} value={auf} onChange={setAuf} />

      {task && (
        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: accent.gruenTintLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
              <AppText size={12} color={accent.gruenDarkText}>{task.taskType}</AppText>
            </View>
            <AppText size={12.5} color={c.textMuted}>ca. {task.minWords} Wörter · {task.recommendedMinutes ?? 20} Min</AppText>
          </View>
          <AppText role="serif" size={19} color={c.textHi} lh={26} style={{ marginTop: 10 }}>{task.titleDe}</AppText>
          {/* BUG-9: kein numberOfLines-Clip mehr → vollständige Aufgabe lesbar */}
          <AppText size={14} color={c.textMuted} lh={20} style={{ marginTop: 6 }}>{task.promptDe}</AppText>

          {/* Leitpunkte IMMER direkt zeigen (nicht im Aufklapper versteckt) */}
          {task.bulletPointsDe?.length ? (
            <View style={{ marginTop: 10, gap: 5 }}>
              <Eyebrow>Das sollst du behandeln</Eyebrow>
              {task.bulletPointsDe.map((b, i) => (
                <AppText key={i} size={13.5} color={c.textBody} lh={19}>•  {b}</AppText>
              ))}
            </View>
          ) : null}
          {/* BUG-9 / R2-5: nur der Beispielaufsatz ist aufklappbar — und nur, wenn vorhanden. */}
          {task.sampleAnswerDe ? (
            <>
              <Pressable onPress={() => setExpanded((e) => !e)} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppText size={13} color={accent.lila}>Beispielaufsatz {expanded ? "ausblenden" : "anzeigen"}</AppText>
                <AppText size={12} color={accent.lila}>{expanded ? "▲" : "▼"}</AppText>
              </Pressable>
              {expanded && (
                <View style={{ marginTop: 10, backgroundColor: accent.gruenTintLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: accent.gruen + "33" }}>
                  <Eyebrow color={accent.gruenDarkText}>Beispielaufsatz</Eyebrow>
                  <AppText size={13.5} color={c.textBody} lh={20} style={{ marginTop: 6 }}>{task.sampleAnswerDe}</AppText>
                </View>
              )}
            </>
          ) : null}
          <AccentButton label="Aufgabe schreiben" onPress={() => nav.navigate("Exam", { taskId: task.id })} style={{ marginTop: 16 }} />
        </Card>
      )}
    </>
  );
}

// 24 · Aufgabe (schreiben, Timer, Entwurf-Autosave, Bildschirm-Schutz).
export function ExamScreen() {
  const { c, accent, fonts, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const taskId: string = route.params?.taskId;
  const { session } = useSession();
  const uid = session?.user.id;
  const { data: sims } = useSimulations();
  const task = useMemo<ExamTask | undefined>(() => sims?.flatMap((s) => s.tasks).find((t) => t.id === taskId), [sims, taskId]);

  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState((task?.recommendedMinutes ?? 20) * 60);
  const [phase, setPhase] = useState<"write" | "grading">("write");
  const [progress, setProgress] = useState<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordLimit = (task?.minWords ?? 80) > 60 ? 200 : 100;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  useEffect(() => { ScreenCapture.preventScreenCaptureAsync(); return () => { ScreenCapture.allowScreenCaptureAsync(); }; }, []);
  useEffect(() => { if (uid && task) getDraft(uid, task.id).then((d) => d && setText(d.text)); }, [uid, task?.id]);
  useEffect(() => {
    const iv = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);

  const onChange = (v: string) => {
    setText(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (uid && task) upsertDraft(uid, task.id, v, v.trim() ? v.trim().split(/\s+/).length : 0).catch(() => {});
    }, 800);
  };

  const submit = async () => {
    if (!task) return;
    if (words < 20) return Alert.alert("Zu kurz", "Schreibe mindestens ein paar Sätze.");
    setPhase("grading"); setProgress([]);
    try {
      await gradeStream(task.id, text.trim(), (e: GradeEvent) => {
        if (e.type === "start") setProgress(["Bewertung wird erstellt…"]);
        else if (e.type === "examiner") setProgress((p) => [...p, `Prüfer ${e.label} fertig`]);
        else if (e.type === "third") setProgress((p) => [...p, "Drittbewertung…"]);
        else if (e.type === "error") { Alert.alert("Fehler", e.error); setPhase("write"); }
        else if (e.type === "done") {
          if (uid) deleteDraft(uid, task.id).catch(() => {});
          nav.replace("ExamResult", { result: { reconciled: e.grade as ExamGrade, examiners: e.examiners, thirdUsed: e.thirdUsed } as ExamResult, task, persisted: e.persisted });
        }
      });
    } catch (e) {
      const err = e as Error & { retryAfterSec?: number };
      Alert.alert("Bewertung", err.retryAfterSec ? `${err.message}` : err.message);
      setPhase("write");
    }
  };

  if (!task) return <Loading />;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (phase === "grading")
    return (
      <Center>
        <RingGauge value={0.5} label="✦" />
        <AppText role="serif" size={20} color={c.textHi} style={{ marginTop: 16 }}>Bewertung wird erstellt…</AppText>
        {progress.map((p, i) => <AppText key={i} size={13} color={c.textMuted} style={{ marginTop: 4 }}>{p}</AppText>)}
      </Center>
    );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
        <AppText size={13} color={c.textMuted}>Simulation {task.simulation} · Aufgabe {task.aufgabe}</AppText>
        <View style={{ backgroundColor: accent.goldTintLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
          <AppText role="serifMed" size={14} color={accent.goldText}>{mm}:{ss}</AppText>
        </View>
      </View>

      <ScrollView style={{ marginTop: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <AppText role="serif" size={17} color={c.textHi}>{task.titleDe}</AppText>
          <AppText size={13.5} color={c.textMuted} lh={19} style={{ marginTop: 6 }}>{task.promptDe}</AppText>
          {/* Leitpunkte während des Schreibens sichtbar halten */}
          {task.bulletPointsDe?.length ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {task.bulletPointsDe.map((b, i) => (
                <AppText key={i} size={13} color={c.textBody} lh={18}>•  {b}</AppText>
              ))}
            </View>
          ) : null}
        </Card>
        <TextInput
          value={text} onChangeText={onChange} multiline placeholder="Schreibe hier deinen Text…" placeholderTextColor={c.textFaint}
          style={{ marginTop: 12, minHeight: 220, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, color: c.textHi, fontFamily: fonts.mono, fontSize: 14, lineHeight: 22, textAlignVertical: "top" }}
        />
      </ScrollView>

      {/* R2-6: Safe-Area-Abstand unten, damit „Bewerten lassen" nicht am Rand / unter dem Home-Indicator klebt */}
      <View style={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 10 }}>
        <AppText size={12.5} color={words > wordLimit ? accent.rotText : c.textMuted}>{words} / {wordLimit} Wörter</AppText>
        <AccentButton label="Bewerten lassen" color={accent.lila} onPress={submit} disabled={words < 20 || words > wordLimit} />
      </View>
    </View>
  );
}

// 25 · Bewertung.
export function ExamResultScreen() {
  const { c, accent, fonts } = useTheme();
  const route = useRoute<any>();
  const result: ExamResult = route.params?.result;
  const persisted: boolean = route.params?.persisted ?? false;
  const g = result.reconciled;
  const ratio = g.maxPunkte ? g.gesamtpunkte / g.maxPunkte : 0;
  const bandColor = (b: string) => (b === "A" || b === "B" ? accent.gruen : b === "C" ? accent.gold : accent.rot);

  return (
    <Screen>
      <Card style={{ borderRadius: 24, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Gesamtergebnis</Eyebrow>
          <AppText role="serif" size={30} color={c.textHi} style={{ marginTop: 2 }}>{fmt(g.gesamtpunkte)} / {fmt(g.maxPunkte)}</AppText>
          <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: g.bestanden ? accent.gruenTintLight : accent.rotTintLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <AppText size={13} color={g.bestanden ? accent.gruenDarkText : accent.rotText}>{g.bestanden ? "bestanden" : "nicht bestanden"}</AppText>
          </View>
        </View>
        <RingGauge value={ratio} color={g.bestanden ? accent.gruen : accent.rot} />
      </Card>
      {!persisted && (
        <AppText size={12} color={accent.goldText} style={{ marginTop: 8 }}>Hinweis: Ergebnis konnte nicht gespeichert werden — es erscheint evtl. nicht im Verlauf.</AppText>
      )}

      <Eyebrow>Bewertung nach Kriterien</Eyebrow>
      <View style={{ gap: 10, marginTop: 10 }}>
        {g.criteria.map((cr) => (
          <Card key={cr.key} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: bandColor(cr.band) + "22", alignItems: "center", justifyContent: "center" }}>
              <AppText role="uiBold" size={15} color={bandColor(cr.band)}>{cr.band}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText role="uiSemi" size={14.5} color={c.textHi}>{cr.labelDe}</AppText>
                <AppText size={12.5} color={c.textMuted} style={{ fontFamily: fonts.serif }}>{fmt(cr.punkte)} / {fmt(cr.maxPunkte)}</AppText>
              </View>
              <AppText size={13.5} color={c.textMuted} lh={19} style={{ marginTop: 4 }}>{cr.begruendungDe}</AppText>
            </View>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: 14 }}>
        <Eyebrow>Rückmeldung</Eyebrow>
        <AppText size={14} color={c.textBody} lh={20} style={{ marginTop: 6 }}>{g.summaryDe}</AppText>
      </Card>
      <AppText size={11.5} color={c.textFaint} align="center" style={{ marginTop: 16 }}>Automatisch von einer KI erstellt · ersetzt keine offizielle Prüfung.</AppText>
    </Screen>
  );
}

const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
