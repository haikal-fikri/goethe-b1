import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenCapture from "expo-screen-capture";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, AccentButton, SecondaryButton, LevelBadge, Loading, Center, Screen } from "../../components/ui";
import { RingGauge, Segmented } from "../../components/widgets";
import { CloseIcon, BackIcon } from "../../components/icons";
import { useSimulations } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { getDraft, upsertDraft, deleteDraft } from "../../lib/db";
import { getDeadline, setDeadline as storeDeadline, clearDeadline, getActiveSim, setActiveSim, wipeSim } from "../../lib/examTimer";
import { gradeStream, type GradeEvent } from "../../lib/api";
import type { ExamGrade, ExamResult, ExamTask, AufgabeNr } from "@repo/types";

// ⚠️ Prüfungsintegrität: Kopieren/Einfügen im Prüfungs-Editor (Screen-Capture-Block-Ergänzung).
// An `__DEV__` gebunden: in Dev-Builds erlaubt (Beispieltexte zum AI-Testen einfügbar),
// in Release-Builds IMMER blockiert — kann nicht versehentlich aktiviert ausgeliefert werden.
const ALLOW_EXAM_PASTE = __DEV__;

// 23 · Prüfen (KI-Prüfer Landing) — Simulation 1–4 + Aufgabe 1/2/3.
export function PruefenLandingScreen() {
  const { c, accent, tint } = useTheme();
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
        <View style={{ backgroundColor: tint("lila"), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
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
            <View style={{ backgroundColor: tint("gruen"), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
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
                <View style={{ marginTop: 10, backgroundColor: tint("gruen"), borderRadius: 12, padding: 12, borderWidth: 1, borderColor: accent.gruen + "33" }}>
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

// 24 · Aufgabe (schreiben, wall-clock-Timer, Entwurf-Autosave, Bildschirm-Schutz).
// BUG-11: Timer ist wall-clock-verankert (remaining = deadline − now, je taskId persistiert)
// → Verlassen/Hintergrund/Wiedereintritt setzt NIE zurück. Eine aktive Simulation (≤3
// gleichzeitige Aufgaben-Timer); Wechsel zu anderer Sim → Bestätigung → wipe+neu starten.
// Bei 0:00 → Editor sperren + Auto-Submit (words<20 → sperren ohne Bewertung). Kein Kopieren/Einfügen.
// R6: „Prüfung abbrechen" = Deadline+Entwurf weg → zurück; „Text löschen" = nur Text, Timer läuft.
export function ExamScreen() {
  const { c, accent, fonts, radius, tint } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const taskId: string = route.params?.taskId;
  const { session } = useSession();
  const uid = session?.user.id;
  const { data: sims } = useSimulations();
  const task = useMemo<ExamTask | undefined>(() => sims?.flatMap((s) => s.tasks).find((t) => t.id === taskId), [sims, taskId]);

  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);        // Editor gesperrt (Zeit abgelaufen)
  const [phase, setPhase] = useState<"write" | "grading">("write");
  const [progress, setProgress] = useState<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiredRef = useRef(false);
  const wordLimit = (task?.minWords ?? 80) > 60 ? 200 : 100;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const durMs = (task?.recommendedMinutes ?? 20) * 60_000;

  useEffect(() => { ScreenCapture.preventScreenCaptureAsync(); return () => { ScreenCapture.allowScreenCaptureAsync(); }; }, []);
  // Sekundentakt nur für die Anzeige; Quelle der Wahrheit ist die persistierte Deadline.
  useEffect(() => { const iv = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(iv); }, []);

  // Einmalig: Single-Sim-Lock prüfen + persistierte Deadline laden/anlegen + Entwurf laden.
  useEffect(() => {
    if (!task || !sims) return;
    let cancelled = false;
    const initDeadline = async (reset: boolean) => {
      let dl = reset ? null : await getDeadline(task.id);
      if (dl == null) { dl = Date.now() + durMs; await storeDeadline(task.id, dl); }
      if (cancelled) return;
      setDeadline(dl);
      const isExpired = dl - Date.now() <= 0;
      expiredRef.current = isExpired; setLocked(isExpired); setReady(true);
      if (uid) getDraft(uid, task.id).then((d) => { if (!cancelled && d) setText(d.text); });
    };
    (async () => {
      const active = await getActiveSim();
      if (active != null && active !== task.simulation) {
        Alert.alert("Neue Simulation starten?", "Das löscht deinen aktuellen Fortschritt und startet den Timer neu.", [
          { text: "Abbrechen", style: "cancel", onPress: () => nav.goBack() },
          { text: "Neu starten", style: "destructive", onPress: async () => {
              const oldSim = sims.find((s) => s.id === active);
              await wipeSim(uid, oldSim?.tasks.map((t) => t.id) ?? []);
              await setActiveSim(task.simulation);
              await initDeadline(true);
            } },
        ]);
        return;
      }
      if (active == null) await setActiveSim(task.simulation);
      await initDeadline(false);
    })();
    return () => { cancelled = true; };
  }, [task?.id, sims]);

  const remaining = deadline != null ? Math.max(0, Math.round((deadline - nowTick) / 1000)) : Math.round(durMs / 1000);

  const onChange = (v: string) => {
    if (locked) return;
    setText(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (uid && task) upsertDraft(uid, task.id, v, v.trim() ? v.trim().split(/\s+/).length : 0).catch(() => {});
    }, 800);
  };

  const submit = async (auto = false) => {
    if (!task) return;
    if (words < 20) { if (!auto) Alert.alert("Zu kurz", "Schreibe mindestens ein paar Sätze."); return; }
    setPhase("grading"); setProgress([]);
    try {
      await gradeStream(task.id, text.trim(), (e: GradeEvent) => {
        if (e.type === "start") setProgress(["Bewertung wird erstellt…"]);
        else if (e.type === "examiner") setProgress((p) => [...p, `Prüfer ${e.label} fertig`]);
        else if (e.type === "third") setProgress((p) => [...p, "Drittbewertung…"]);
        else if (e.type === "error") { Alert.alert("Fehler", e.error); setPhase("write"); }
        else if (e.type === "done") {
          if (uid) deleteDraft(uid, task.id).catch(() => {});
          clearDeadline(task.id).catch(() => {});
          nav.replace("ExamResult", { result: { reconciled: e.grade as ExamGrade, examiners: e.examiners, thirdUsed: e.thirdUsed } as ExamResult, task, persisted: e.persisted });
        }
      });
    } catch (e) {
      const err = e as Error & { retryAfterSec?: number };
      Alert.alert("Bewertung", err.retryAfterSec ? `${err.message}` : err.message);
      setPhase("write");
    }
  };

  // Bei 0:00 → sperren + Auto-Submit (words<20 → gesperrt, „Zeit abgelaufen"-Banner, keine Bewertung).
  useEffect(() => {
    if (!ready || deadline == null || expiredRef.current) return;
    if (remaining <= 0) {
      expiredRef.current = true; setLocked(true);
      if (words >= 20) submit(true);
    }
  }, [remaining, ready, deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  // R6: Prüfung abbrechen — Deadline weg (nächster Start = frischer Timer), Entwurf verwerfen,
  // zurück zum aufrufenden Screen (Prüfen-Landing oder Fortschritt/Probe). ACTIVE_SIM bleibt
  // gesetzt (andere Aufgaben der Sim können laufen; Sim-Wechsel-Flow unverändert).
  const abortExam = () => {
    if (!task) return;
    Alert.alert("Prüfung abbrechen?", "Dein Text wird verworfen und der Timer gestoppt. Beim nächsten Start beginnt die Aufgabe von vorn.", [
      { text: "Weiter schreiben", style: "cancel" },
      { text: "Prüfung abbrechen", style: "destructive", onPress: async () => {
          if (saveTimer.current) clearTimeout(saveTimer.current); // Autosave nicht nachträglich feuern
          await clearDeadline(task.id).catch(() => {});
          if (uid) await deleteDraft(uid, task.id).catch(() => {});
          nav.goBack();
        } },
    ]);
  };

  // R6: ehem. „Verwerfen & neu starten" — jetzt nur Text + Entwurf löschen, Timer läuft weiter.
  const clearText = () => {
    if (!task) return;
    Alert.alert("Text löschen?", "Dein Text und der gespeicherte Entwurf werden gelöscht. Der Timer läuft weiter.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: async () => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          if (uid) await deleteDraft(uid, task.id).catch(() => {});
          setText("");
        } },
    ]);
  };

  if (!task || !ready) return <Loading />;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const expired = remaining <= 0;

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
        <View style={{ backgroundColor: expired ? tint("rot") : tint("gold"), paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
          <AppText role="serifMed" size={14} color={expired ? accent.rotText : accent.goldText}>{mm}:{ss}</AppText>
        </View>
      </View>
      {!locked && (
        <Pressable onPress={clearText} hitSlop={8} style={{ alignSelf: "flex-end", marginTop: 6 }}>
          <AppText size={12} color={accent.rotText}>Text löschen</AppText>
        </Pressable>
      )}

      {expired && (
        <View style={{ marginTop: 8, backgroundColor: tint("rot"), borderRadius: 12, padding: 10 }}>
          <AppText size={13} color={accent.rotText}>
            Zeit abgelaufen{words < 20 ? " — zu kurz zum Bewerten." : " — reiche zum Bewerten ein."}
          </AppText>
        </View>
      )}

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
        {/* Kopieren/Einfügen: via ALLOW_EXAM_PASTE (oben) gesteuert — TEMP an fürs AI-Testen. */}
        <TextInput
          value={text} onChangeText={onChange} multiline editable={!locked}
          contextMenuHidden={!ALLOW_EXAM_PASTE} selectTextOnFocus={false}
          placeholder="Schreibe hier deinen Text…" placeholderTextColor={c.textFaint}
          style={{ marginTop: 12, minHeight: 220, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, color: c.textHi, fontFamily: fonts.mono, fontSize: 14, lineHeight: 22, textAlignVertical: "top", opacity: locked ? 0.6 : 1 }}
        />
      </ScrollView>

      {/* R2-6: Safe-Area-Abstand unten, damit „Bewerten lassen" nicht am Rand / unter dem Home-Indicator klebt */}
      <View style={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 10 }}>
        <AppText size={12.5} color={words > wordLimit ? accent.rotText : c.textMuted}>{words} / {wordLimit} Wörter</AppText>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <SecondaryButton label="Prüfung abbrechen" onPress={abortExam} style={{ flex: 1 }} />
          <AccentButton label="Bewerten lassen" color={accent.lila} onPress={() => submit(false)}
            disabled={words < 20 || words > wordLimit} style={{ flex: 1.2 }} />
        </View>
      </View>
    </View>
  );
}

// 25 · Bewertung.
export function ExamResultScreen() {
  const { c, accent, fonts, tint } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const result: ExamResult = route.params?.result;
  const persisted: boolean = route.params?.persisted ?? false;
  const fromProbe: boolean = route.params?.fromProbe ?? false; // nur beim Aufruf aus Fortschritt→Probe→Aufgabe
  const g = result.reconciled;
  const ratio = g.maxPunkte ? g.gesamtpunkte / g.maxPunkte : 0;
  const bandColor = (b: string) => (b === "A" || b === "B" ? accent.gruen : b === "C" ? accent.gold : accent.rot);

  return (
    <Screen>
      {/* Zurück nur aus dem Fortschritt→Probe→Aufgabe-Pfad (nicht nach frischer Bewertung, die per replace kommt). */}
      {fromProbe && nav.canGoBack() && (
        <Pressable onPress={() => nav.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Zurück"
          style={{ alignSelf: "flex-start", paddingVertical: 4, marginBottom: 4 }}>
          <BackIcon color={c.textMuted} />
        </Pressable>
      )}
      <Card style={{ borderRadius: 24, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Gesamtergebnis</Eyebrow>
          <AppText role="serif" size={30} color={c.textHi} style={{ marginTop: 2 }}>{fmt(g.gesamtpunkte)} / {fmt(g.maxPunkte)}</AppText>
          <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: g.bestanden ? tint("gruen") : tint("rot"), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
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
