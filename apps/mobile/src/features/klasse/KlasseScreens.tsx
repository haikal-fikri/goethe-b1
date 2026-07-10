import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, ScrollView, TextInput, Alert, Pressable, Linking, AppState } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets,
  setAudioModeAsync, requestRecordingPermissionsAsync,
} from "expo-audio";
import { getInfoAsync, deleteAsync } from "expo-file-system/legacy";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, PrimaryButton, AccentButton, SecondaryButton, Center, Loading, LevelBadge, Chip } from "../../components/ui";
import { PeopleIcon, MicIcon, CloseIcon } from "../../components/icons";
import * as db from "../../lib/db";
import * as api from "../../lib/api";
import { resetSpeechAudioMode } from "../../lib/tts";
import { useSession } from "../../lib/session";
import {
  useMyClasses, useClassAssignments, useMySubmissions, useClassLeaderboard, useInvalidateClass,
  useSpeakingAssignments, useMySpeakingSubmissions, useMySpeakingGrades, useSpeakingConsent, useInvalidateSpeaking,
} from "../../lib/hooks";
import type {
  EnrolledClass, Assignment, AssignmentKind, SubmissionStatus,
  SpeakingAssignment, SpeakingSubmission, SpeakingStatus, SpeakingGrade,
} from "@repo/types";

// 29–34 · Klasse. Nur bei aktivem class_enabled sichtbar (Tab flag-gated). Phase 1
// wired: Beitritt, eingeschriebenes Dashboard (my_classes), Aufgabenliste + Status,
// Wochen-Rangliste (class_leaderboard), Verlassen. Sprechen-Aufnahme + Abgabe/
// Bewertung sind Lehrkraft-Phase (deferred) → Aufgaben nur ansehbar, keine Fake-Writes.

// TODO: durch die echte Kurs-/Einschreibe-Website ersetzen (öffnet im externen Browser).
const ENROLL_URL = "https://example.org/kurse";

const KIND_LABEL: Record<AssignmentKind, string> = { writing: "Schreiben", speaking: "Sprechen", practice: "Übung" };
const STATUS_LABEL: Record<SubmissionStatus, string> = { pending: "Begonnen", submitted: "Eingereicht", graded: "Bewertet" };
const statusText = (s?: SubmissionStatus) => (s ? STATUS_LABEL[s] : "Offen");
const SPK_STATUS_LABEL: Record<SpeakingStatus, string> = {
  recorded: "Eingereicht", scored: "In Auswertung", graded: "Bewertet", purged: "Bewertet", failed: "Fehlgeschlagen",
};
const spkStatusText = (s?: SpeakingStatus) => (s ? SPK_STATUS_LABEL[s] : "Offen");

/** display_name → „Vorname N." (Rangliste, datensparsam). Fallback ohne Namen. */
function firstNameShort(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "Teilnehmer:in";
  const parts = n.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}
function initialsOf(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  return n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function formatDueShort(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return `Fällig ${new Date(dueAt).toLocaleDateString("de-DE", { weekday: "short" })}`;
}
function formatDueLong(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return `Fällig ${new Date(dueAt).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" })}`;
}
function mapJoinError(msg?: string): string {
  const m = msg ?? "";
  if (m.includes("invalid_class_code")) return "Ungültiger Code. Bitte prüfe ihn und versuche es erneut.";
  if (m.includes("class_full")) return "Diese Klasse ist voll.";
  if (m.includes("rate_limited")) return "Zu viele Versuche. Bitte warte ein paar Minuten.";
  return "Beitritt fehlgeschlagen. Bitte prüfe den Code.";
}

// ── Tab-Root: Router zwischen Leerzustand (29) und Dashboard (31) ────
export function KlasseScreen() {
  const { c, accent, space } = useTheme();
  const { data, isLoading } = useMyClasses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  const classes = data ?? [];
  if (classes.length === 0) return <KlasseEmpty />;

  const selected = classes.find((k) => k.classId === selectedId) ?? classes[0];
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.scrollBottom }}>
      <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 8, marginBottom: 12 }}>Klasse</AppText>
      {classes.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {classes.map((k) => (
            <Chip key={k.classId} label={k.name} active={k.classId === selected.classId} color={accent.gruen} onPress={() => setSelectedId(k.classId)} />
          ))}
        </ScrollView>
      ) : null}
      <KlasseDashboard cls={selected} />
    </ScrollView>
  );
}

// 29 · Leerzustand „Noch keine Klasse".
function KlasseEmpty() {
  const { c, accent, tint } = useTheme();
  const nav = useNavigation<any>();
  return (
    <Center>
      <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: tint("lila"), alignItems: "center", justifyContent: "center" }}>
        <PeopleIcon size={34} color={accent.lila} />
      </View>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 16 }}>Noch keine Klasse</AppText>
      <AppText size={14} color={c.textMuted} align="center" lh={20} style={{ marginTop: 6 }}>
        Tritt der Klasse deiner Lehrkraft bei, um Aufgaben und Feedback zu erhalten.
      </AppText>
      <PrimaryButton label="Klasse beitreten" onPress={() => nav.navigate("KlasseJoin")} style={{ marginTop: 20, alignSelf: "stretch" }} />
      {/* Kein Code? → externer Browser zur Website, um sich für einen Kurs einzuschreiben. */}
      <AppText size={13} color={c.textMuted} align="center" style={{ marginTop: 16 }}>Keinen Code?</AppText>
      <Pressable onPress={() => Linking.openURL(ENROLL_URL)} hitSlop={8} style={{ marginTop: 4 }}>
        <AppText size={13.5} color={accent.gruen}>Kurse auf unserer Website ansehen ↗</AppText>
      </Pressable>
    </Center>
  );
}

// 31 · Eingeschriebenes Dashboard: Kopf (Name · Lehrkraft · N Mitglieder),
// Aufgaben (+ eigener Status), Wochen-Rangliste, Verlassen.
function KlasseDashboard({ cls }: { cls: EnrolledClass }) {
  const { c, accent, tint } = useTheme();
  const nav = useNavigation<any>();
  const invalidate = useInvalidateClass();
  const assignments = useClassAssignments(cls.classId);
  const submissions = useMySubmissions();
  const leaderboard = useClassLeaderboard(cls.classId);
  const speakingAssignments = useSpeakingAssignments(cls.classId);
  const speakingSubs = useMySpeakingSubmissions();

  const statusColor = (s?: SubmissionStatus) =>
    s === "graded" ? accent.gruen : s === "submitted" ? accent.blau : s === "pending" ? accent.gold : c.textFaint;
  const kindColor = (k: AssignmentKind) => (k === "speaking" ? accent.blau : k === "writing" ? accent.gruen : accent.lila);
  const subStatus = (aid: string) => (submissions.data ?? []).find((s) => s.assignmentId === aid)?.status;
  // Sprech-Abgaben stecken in speaking_submissions (eigene Tabelle), nicht in assignment_submissions.
  const spkStatusColor = (s?: SpeakingStatus) =>
    s === "graded" || s === "purged" ? accent.gruen : s === "scored" ? accent.gold : s === "recorded" ? accent.blau : s === "failed" ? accent.rot : c.textFaint;
  const spkSubOf = (aid: string) => (speakingSubs.data ?? []).find((s) => s.assignmentId === aid);

  const leave = () => {
    Alert.alert("Klasse verlassen?", `Möchtest du „${cls.name}" wirklich verlassen?`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Verlassen", style: "destructive", onPress: async () => { await db.leaveClass(cls.classId); await invalidate(); } },
    ]);
  };

  const rows = assignments.data ?? [];
  const board = leaderboard.data ?? [];
  const AVATAR = [accent.gruen, accent.blau, accent.lila, accent.gold, accent.rot];

  return (
    <>
      <Card style={{ backgroundColor: c.primaryBtnBg, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <LevelBadge level="B1" />
        <View style={{ flex: 1 }}>
          <AppText role="uiSemi" size={15} color={c.primaryBtnFg}>{cls.name}</AppText>
          <AppText size={12.5} color={c.primaryBtnFg} style={{ opacity: 0.7 }}>
            {cls.teacherName ?? "Lehrkraft"} · {cls.memberCount} {cls.memberCount === 1 ? "Mitglied" : "Mitglieder"}
          </AppText>
        </View>
      </Card>

      <View style={{ marginTop: 20, marginBottom: 8 }}><Eyebrow>Aufgaben</Eyebrow></View>
      {assignments.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <AppText size={13.5} color={c.textMuted}>Noch keine Aufgaben.</AppText>
      ) : (
        rows.map((a) => {
          const st = subStatus(a.id);
          const due = formatDueShort(a.dueAt);
          return (
            <Card key={a.id} onPress={() => nav.navigate("KlasseAufgabe", { assignment: a })} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow color={kindColor(a.kind)}>{KIND_LABEL[a.kind]}</Eyebrow>
                {due ? (
                  <View style={{ backgroundColor: tint("gold"), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <AppText size={11.5} color={accent.goldText}>{due}</AppText>
                  </View>
                ) : null}
              </View>
              <AppText role="uiSemi" size={15} color={c.textHi} style={{ marginTop: 6 }}>{a.title}</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(st) }} />
                <AppText size={13} color={c.textMuted}>{statusText(st)}</AppText>
              </View>
            </Card>
          );
        })
      )}

      {(speakingAssignments.data ?? []).length > 0 ? (
        <>
          <View style={{ marginTop: 22, marginBottom: 8 }}><Eyebrow color={accent.blau}>Sprechen</Eyebrow></View>
          {(speakingAssignments.data ?? []).map((a) => {
            const sub = spkSubOf(a.id);
            const due = formatDueShort(a.dueAt);
            return (
              <Card key={a.id} onPress={() => nav.navigate("SprechenTask", { assignment: a })} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Eyebrow color={accent.blau}>Sprechen · Teil {a.teil}</Eyebrow>
                  {due ? (
                    <View style={{ backgroundColor: tint("gold"), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                      <AppText size={11.5} color={accent.goldText}>{due}</AppText>
                    </View>
                  ) : null}
                </View>
                <AppText role="uiSemi" size={15} color={c.textHi} style={{ marginTop: 6 }} numberOfLines={2}>{a.promptDe}</AppText>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: spkStatusColor(sub?.status) }} />
                  <AppText size={13} color={c.textMuted}>{spkStatusText(sub?.status)}</AppText>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      <View style={{ marginTop: 22, marginBottom: 8 }}><Eyebrow>Rangliste · diese Woche</Eyebrow></View>
      <Card>
        {leaderboard.isLoading ? (
          <Loading />
        ) : board.length === 0 ? (
          <AppText size={13.5} color={c.textMuted}>Noch keine Punkte diese Woche.</AppText>
        ) : (
          board.map((e, i) => (
            <View
              key={e.userId}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10, backgroundColor: e.isMe ? accent.gruen + "14" : "transparent" }}
            >
              <AppText role="serif" size={15} color={c.textMuted} style={{ width: 20, textAlign: "center" }}>{e.rank}</AppText>
              <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: AVATAR[i % AVATAR.length] + "26", alignItems: "center", justifyContent: "center" }}>
                <AppText role="uiSemi" size={12} color={AVATAR[i % AVATAR.length]}>{initialsOf(e.displayName)}</AppText>
              </View>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppText role="uiSemi" size={14} color={c.textHi}>{firstNameShort(e.displayName)}</AppText>
                {e.isMe ? (
                  <View style={{ backgroundColor: accent.gruen, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}>
                    <AppText size={10.5} color="#fff">Du</AppText>
                  </View>
                ) : null}
              </View>
              <AppText role="serifMed" size={15} color={c.textHi}>{e.points}</AppText>
            </View>
          ))
        )}
      </Card>

      <SecondaryButton label="Klasse verlassen" onPress={leave} style={{ marginTop: 20 }} />
    </>
  );
}

// 30 · Beitreten per Code, mit Vorschau (find_class_by_code) vor der Bestätigung.
export function KlasseJoinScreen() {
  const { c, accent, fonts, radius } = useTheme();
  const nav = useNavigation<any>();
  const invalidate = useInvalidateClass();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ classId: string; className: string } | null>(null);
  const lastLookup = useRef("");

  // Debounced-Vorschau (find_class_by_code teilt sich das 10/15min-Rate-Limit mit
  // join_class → nur einmal ~500 ms nach der letzten Eingabe, ab 6 Zeichen).
  useEffect(() => {
    const cc = code.trim().toUpperCase();
    if (cc.length < 6) { setPreview(null); return; }
    const t = setTimeout(() => {
      if (cc === lastLookup.current) return;
      lastLookup.current = cc;
      db.findClassByCode(cc).then(setPreview).catch(() => setPreview(null));
    }, 500);
    return () => clearTimeout(t);
  }, [code]);

  const join = async () => {
    setBusy(true);
    const r = await db.joinClass(code);
    setBusy(false);
    if (r.ok) { await invalidate(); nav.goBack(); }
    else Alert.alert("Beitritt fehlgeschlagen", mapJoinError(r.error));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 22, paddingTop: 56 }}>
      <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
      <AppText role="serif" size={24} color={c.textHi} style={{ marginTop: 16 }}>Klasse beitreten</AppText>
      <AppText size={14} color={c.textMuted} style={{ marginTop: 6 }}>Gib den Code deiner Lehrkraft ein.</AppText>
      <TextInput
        value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="K73F9AB2" placeholderTextColor={c.textFaint}
        autoCapitalize="characters" autoCorrect={false} maxLength={8} textAlign="center"
        style={{ marginTop: 20, height: 60, borderRadius: radius.input, borderWidth: 1.5, borderColor: accent.gruen, color: c.textHi, fontFamily: fonts.mono, fontSize: 24, letterSpacing: 6, backgroundColor: c.surface }}
      />
      {preview ? (
        <Card style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <LevelBadge level="B1" />
          <View style={{ flex: 1 }}>
            <AppText role="uiSemi" size={14.5} color={c.textHi}>{preview.className}</AppText>
            <AppText size={12.5} color={accent.gruenDarkText} style={{ marginTop: 2 }}>Klasse gefunden ✓</AppText>
          </View>
        </Card>
      ) : null}
      <PrimaryButton label="Klasse beitreten" onPress={join} loading={busy} disabled={code.length < 4} style={{ marginTop: 18 }} />
    </View>
  );
}

// 32 · Aufgaben-Detail (nur lesend in Phase 1 — Abgabe/Bewertung = Lehrkraft-Phase).
export function KlasseAufgabeScreen() {
  const { c, accent } = useTheme();
  const route = useRoute<any>();
  const assignment: Assignment | undefined = route.params?.assignment;
  const submissions = useMySubmissions();
  if (!assignment) return <Loading />;
  const st = (submissions.data ?? []).find((s) => s.assignmentId === assignment.id)?.status;
  const due = formatDueLong(assignment.dueAt);
  const kindColor = assignment.kind === "speaking" ? accent.blau : assignment.kind === "writing" ? accent.gruen : accent.lila;
  const statusColor = st === "graded" ? accent.gruen : st === "submitted" ? accent.blau : st === "pending" ? accent.gold : c.textFaint;
  return (
    <>
      <Eyebrow color={kindColor}>{KIND_LABEL[assignment.kind]}</Eyebrow>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 6 }}>{assignment.title}</AppText>
      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
          <AppText size={13.5} color={c.textBody}>{statusText(st)}</AppText>
        </View>
        {due ? <AppText size={13} color={c.textMuted} style={{ marginTop: 8 }}>{due}</AppText> : null}
      </Card>
      <Card style={{ marginTop: 12 }}>
        <AppText size={13.5} color={c.textMuted} lh={20}>
          Die Abgabe wird in einer späteren Version verfügbar sein. Deine Lehrkraft bewertet eingereichte Aufgaben.
        </AppText>
      </Card>
    </>
  );
}

// 32 · Sprech-Aufgabe: Aufgabenstellung + Einwilligungs-Gate (read-only) → Aufnahme.
export function SprechenTaskScreen() {
  const { c, accent, tint } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const assignment: SpeakingAssignment | undefined = route.params?.assignment;
  const consent = useSpeakingConsent();
  const mySubs = useMySpeakingSubmissions();

  if (!assignment) return <Loading />;
  const existing = (mySubs.data ?? []).find((s) => s.assignmentId === assignment.id);
  const due = formatDueLong(assignment.dueAt);
  const consentOk = consent.data === true;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 16 }}>Ein Thema präsentieren</AppText>
      <Card style={{ marginTop: 16 }}>
        <Eyebrow color={accent.blau}>Deine Aufgabe · Teil {assignment.teil}</Eyebrow>
        <AppText size={14} color={c.textBody} lh={20} style={{ marginTop: 6 }}>{assignment.promptDe}</AppText>
        {due ? <AppText size={12.5} color={c.textMuted} style={{ marginTop: 10 }}>{due}</AppText> : null}
      </Card>
      {existing ? (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.blau }} />
            <AppText size={13.5} color={c.textBody}>{spkStatusText(existing.status)}</AppText>
          </View>
        </Card>
      ) : null}

      <View style={{ position: "absolute", left: 18, right: 18, bottom: 24 }}>
        {consent.isLoading ? (
          <Loading />
        ) : (
          <>
            {consent.data === false ? (
              <Card style={{ marginBottom: 12, backgroundColor: tint("gold") }}>
                <AppText size={13} color={c.textBody} lh={19}>
                  Für Sprachaufnahmen fehlt die Einwilligung. Sie wird von deiner Lehrkraft bzw. deinen Erziehungsberechtigten erfasst.
                </AppText>
              </Card>
            ) : null}
            {existing ? (
              <SecondaryButton
                label="Ergebnis ansehen"
                onPress={() => nav.navigate("SprechenReview", { assignment, submissionId: existing.id })}
                style={{ marginBottom: 10 }}
              />
            ) : null}
            {existing?.status === "graded" ? null : (
              <AccentButton
                label={existing ? "Neu aufnehmen" : "Aufnahme starten"}
                color={accent.blau}
                disabled={!consentOk}
                onPress={() => nav.navigate("SprechenRecord", { assignment })}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

// 33 · Aufnahme (expo-audio) → submit → R2-PUT → finalize. ≤5:00, ≤20 MB.
export function SprechenRecordScreen() {
  const { c, accent, tint } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const assignment: SpeakingAssignment | undefined = route.params?.assignment;
  const qc = useQueryClient();
  const { session } = useSession();
  const uid = session?.user.id;
  const invalidateSpeaking = useInvalidateSpeaking();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

  const [phase, setPhase] = useState<"prepare" | "recording" | "confirm">("prepare");
  const [recUri, setRecUri] = useState<string | null>(null);
  const [recMs, setRecMs] = useState(0);
  const [recBytes, setRecBytes] = useState(0);
  const [up, setUp] = useState<"idle" | "submitting" | "uploading" | "finalizing">("idle");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const submittedRef = useRef(false);
  const recUriRef = useRef<string | null>(null);
  recUriRef.current = recUri;

  // Mikrofon-Rechte → Aufnahme-Session → Aufnahme starten.
  const begin = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Mikrofon nötig", "Bitte erlaube den Mikrofonzugriff, um eine Aufnahme zu machen.");
        nav.goBack();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      resetSpeechAudioMode(); // Aufnahme kippt die iOS-Session → TTS-Cache invalidieren
      await recorder.prepareToRecordAsync();
      recorder.record();
      stoppingRef.current = false;
      setPhase("recording");
    } catch {
      Alert.alert("Fehler", "Die Aufnahme konnte nicht gestartet werden.");
      nav.goBack();
    } finally {
      startingRef.current = false;
    }
  }, [nav, recorder]);

  const doStop = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const durMs = recState.durationMillis;
    try { await recorder.stop(); } catch { /* egal */ }
    const uri = recorder.uri;
    if (!uri) {
      Alert.alert("Fehler", "Die Aufnahme wurde nicht gespeichert.");
      nav.goBack();
      return;
    }
    let size = 0;
    try {
      const info = await getInfoAsync(uri);
      if (info.exists && typeof info.size === "number") size = info.size;
    } catch { /* Größe optional */ }
    if (durMs > 300000 || size > 20 * 1024 * 1024) {
      Alert.alert("Aufnahme zu lang oder zu groß", "Bitte nimm eine Aufnahme von höchstens 5 Minuten auf.");
      deleteAsync(uri, { idempotent: true }).catch(() => {});
      startingRef.current = false;
      begin();
      return;
    }
    setRecUri(uri); setRecMs(durMs); setRecBytes(size); setPhase("confirm");
  }, [recorder, recState.durationMillis, nav, begin]);

  useEffect(() => { begin(); }, [begin]);

  // Auto-Stopp KURZ vor 5:00: der Poll-Takt (~500 ms) überschießt sonst die
  // 300000er-Grenze (z. B. 300240) → doStops „> 300000"-Reject würde die volle
  // Aufnahme verwerfen. Mit 298000 bleibt die behaltene Datei sicher unter dem Cap.
  useEffect(() => {
    if (phase === "recording" && recState.durationMillis >= 298000) void doStop();
  }, [phase, recState.durationMillis, doStop]);

  // App in den Hintergrund während der Aufnahme → stoppen (kein Background-Audio).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active" && phase === "recording") void doStop();
    });
    return () => sub.remove();
  }, [phase, doStop]);

  // Verlassen: Aufnahme stoppen, Session zurücksetzen, nicht abgesendete Datei löschen.
  useEffect(() => {
    return () => {
      try { recorder.stop(); } catch { /* egal */ }
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      resetSpeechAudioMode();
      const u = recUriRef.current;
      if (u && !submittedRef.current) deleteAsync(u, { idempotent: true }).catch(() => {});
    };
  }, [recorder]);

  function handleErr(e: api.LmsError, subId: string | null) {
    setUp("idle");
    if (e.reason === "consent_required") {
      if (uid) qc.invalidateQueries({ queryKey: ["speakingConsent", uid] });
      Alert.alert("Einwilligung fehlt", "Für Sprachaufnahmen fehlt die Einwilligung.");
      nav.goBack();
      return;
    }
    if (e.status === 429) {
      const secs = e.retryAfterSec ?? 60;
      setCooldownUntil(Date.now() + secs * 1000);
      Alert.alert("Zu viele Aufnahmen", `Bitte in etwa ${Math.max(1, Math.ceil(secs / 60))} Minute(n) erneut versuchen.`);
      return;
    }
    if (e.status === 422) {
      Alert.alert("Aufnahme ungültig", "Die Aufnahme ist zu lang oder zu groß. Bitte nimm sie neu auf.");
      return;
    }
    // Audio ist bereits hochgeladen (subId gesetzt) → im Review die Auswertung erneut anstoßen.
    if (subId && (e.status === 409 || e.status === 503)) {
      submittedRef.current = true;
      const u = recUriRef.current; // lokale Kopie ist redundant (liegt auf R2) → aufräumen
      if (u) deleteAsync(u, { idempotent: true }).catch(() => {});
      nav.replace("SprechenReview", { assignment, submissionId: subId });
      return;
    }
    Alert.alert("Fehler", e.message || "Bitte später erneut versuchen.");
  }

  async function absenden() {
    if (!recUri || !assignment) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;
    let subId: string | null = null;
    try {
      setUp("submitting");
      let sub = await api.speakingSubmit(assignment.id);
      subId = sub.submissionId;
      setUp("uploading");
      try {
        await api.uploadSpeakingAudio(sub.uploadUrl, recUri);
      } catch {
        // Presign evtl. abgelaufen (≤300 s) → einmal frisch anfordern + erneut PUTen.
        sub = await api.speakingSubmit(assignment.id);
        subId = sub.submissionId;
        await api.uploadSpeakingAudio(sub.uploadUrl, recUri);
      }
      setUp("finalizing");
      await api.speakingFinalize(subId);
      submittedRef.current = true;
      deleteAsync(recUri, { idempotent: true }).catch(() => {});
      await invalidateSpeaking();
      nav.replace("SprechenReview", { assignment, submissionId: subId });
    } catch (e) {
      handleErr(e as api.LmsError, subId);
    }
  }

  if (!assignment) return <Loading />;
  const busy = up !== "idle";

  if (phase === "prepare") {
    return <Center><Loading label="Aufnahme wird vorbereitet…" /></Center>;
  }
  if (phase === "recording") {
    const remain = Math.max(0, 300 - Math.floor(recState.durationMillis / 1000));
    const mm = Math.floor(remain / 60), ss = String(remain % 60).padStart(2, "0");
    return (
      <Center>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: tint("rot"), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.rot }} />
          <AppText size={12} color={accent.rotText}>AUFNAHME LÄUFT</AppText>
        </View>
        <View style={{ width: 104, height: 104, borderRadius: 999, backgroundColor: accent.blau, alignItems: "center", justifyContent: "center", marginTop: 24 }}>
          <MicIcon size={40} color="#fff" strokeWidth={2} />
        </View>
        <AppText role="serif" size={40} color={c.textHi} style={{ marginTop: 20 }}>{mm}:{ss}</AppText>
        <AppText size={13} color={c.textMuted}>verbleibend · max. 5:00</AppText>
        <PrimaryButton label="Aufnahme stoppen" onPress={() => void doStop()} style={{ marginTop: 24, alignSelf: "stretch" }} />
      </Center>
    );
  }
  // confirm
  const secs = Math.round(recMs / 1000);
  const mmC = Math.floor(secs / 60), ssC = String(secs % 60).padStart(2, "0");
  const sizeLabel = recBytes ? ` · ${Math.round(recBytes / 1024)} KB` : "";
  const upLabel = up === "submitting" ? "Wird vorbereitet…" : up === "uploading" ? "Wird hochgeladen…" : up === "finalizing" ? "Wird ausgewertet…" : "Absenden";
  return (
    <Center>
      <View style={{ width: 88, height: 88, borderRadius: 999, backgroundColor: tint("blau"), alignItems: "center", justifyContent: "center" }}>
        <MicIcon size={34} color={accent.blau} strokeWidth={2} />
      </View>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 18 }}>Aufnahme fertig</AppText>
      <AppText size={13.5} color={c.textMuted} style={{ marginTop: 6 }}>{mmC}:{ssC}{sizeLabel}</AppText>
      <AccentButton label={upLabel} color={accent.blau} loading={busy} disabled={busy} onPress={absenden} style={{ marginTop: 28, alignSelf: "stretch" }} />
      <SecondaryButton
        label="Neu aufnehmen"
        disabled={busy}
        onPress={() => {
          if (recUri) deleteAsync(recUri, { idempotent: true }).catch(() => {});
          setRecUri(null); setUp("idle"); setPhase("prepare");
          startingRef.current = false; begin();
        }}
        style={{ marginTop: 10 }}
      />
    </Center>
  );
}

const CRIT_LABEL: Record<string, string> = {
  erfuellung: "Erfüllung", kohaerenz: "Kohärenz", wortschatz: "Wortschatz", strukturen: "Strukturen", aussprache: "Aussprache",
};
function SpeakingBands({ criteria }: { criteria: unknown }) {
  const { c } = useTheme();
  if (!criteria || typeof criteria !== "object") return null;
  const obj = criteria as Record<string, unknown>;
  const keys = Object.keys(CRIT_LABEL).filter((k) => obj[k] != null);
  if (keys.length === 0) return null;
  return (
    <View style={{ marginTop: 14, gap: 7 }}>
      {keys.map((k) => (
        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText size={13} color={c.textMuted}>{CRIT_LABEL[k]}</AppText>
          <AppText role="uiSemi" size={13.5} color={c.textHi}>{String(obj[k])}</AppText>
        </View>
      ))}
    </View>
  );
}

// 34 · Status + Transkript (ab „scored") + Note & Feedback (ab Freigabe). Kein Playback.
export function SprechenReviewScreen() {
  const { c, accent } = useTheme();
  const route = useRoute<any>();
  const assignment: SpeakingAssignment | undefined = route.params?.assignment;
  const submissionId: string | undefined = route.params?.submissionId;
  const subs = useMySpeakingSubmissions();
  const grades = useMySpeakingGrades();
  const invalidateSpeaking = useInvalidateSpeaking();
  const [busy, setBusy] = useState(false);

  const sub =
    (subs.data ?? []).find((s) => s.id === submissionId) ??
    (assignment ? (subs.data ?? []).find((s) => s.assignmentId === assignment.id) : undefined);
  const grade = sub ? (grades.data ?? []).find((g) => g.submissionId === sub.id) : undefined;

  const retry = async () => {
    if (!sub) return;
    setBusy(true);
    try {
      await api.speakingFinalize(sub.id);
    } catch (e) {
      Alert.alert("Auswertung nicht möglich", (e as api.LmsError).message || "Bitte später erneut versuchen.");
    } finally {
      // Immer invalidieren: bei 409 ist der Server bereits weiter (scored/graded) →
      // Refetch zeigt Transkript/Note statt endlos „ausstehend" mit 409-Button.
      await invalidateSpeaking();
      setBusy(false);
    }
  };

  if (subs.isLoading) return <Loading />;

  return (
    <>
      <AppText role="serif" size={22} color={c.textHi}>Deine Aufnahme</AppText>

      {!sub ? (
        <Card style={{ marginTop: 16 }}><AppText size={14} color={c.textMuted}>Keine Abgabe gefunden.</AppText></Card>
      ) : sub.status === "recorded" ? (
        <>
          <Card style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.blau }} />
              <AppText size={14} color={c.textBody}>Eingereicht — Auswertung ausstehend.</AppText>
            </View>
            <AppText size={13} color={c.textMuted} lh={19} style={{ marginTop: 8 }}>
              Sobald die Auswertung läuft, erscheint hier das Transkript. Deine Lehrkraft bewertet die Aufnahme anschließend.
            </AppText>
          </Card>
          <AccentButton label="Auswertung erneut versuchen" color={accent.blau} loading={busy} disabled={busy} onPress={retry} style={{ marginTop: 16 }} />
        </>
      ) : sub.status === "failed" ? (
        <Card style={{ marginTop: 16 }}>
          <AppText size={14} color={c.textBody} lh={20}>Die Auswertung ist fehlgeschlagen. Bitte nimm die Aufnahme neu auf.</AppText>
        </Card>
      ) : (
        <>
          {grade && grade.releasedAt ? (
            <Card style={{ marginTop: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow color={grade.bestanden ? accent.gruen : accent.rot}>{grade.bestanden ? "Bestanden" : "Nicht bestanden"}</Eyebrow>
                {grade.gesamt != null ? <AppText role="serifMed" size={20} color={c.textHi}>{grade.gesamt}</AppText> : null}
              </View>
              {grade.feedbackDe ? <AppText size={13.5} color={c.textBody} lh={20} style={{ marginTop: 10 }}>{grade.feedbackDe}</AppText> : null}
              <SpeakingBands criteria={grade.criteria} />
            </Card>
          ) : (
            <Card style={{ marginTop: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.gold }} />
                <AppText size={14} color={c.textBody}>In Auswertung — deine Lehrkraft bewertet die Aufnahme.</AppText>
              </View>
            </Card>
          )}
          {sub.transcript ? (
            <Card style={{ marginTop: 12 }}>
              <Eyebrow>Transkript</Eyebrow>
              <AppText size={13.5} color={c.textBody} lh={21} style={{ marginTop: 8 }}>{sub.transcript}</AppText>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}
