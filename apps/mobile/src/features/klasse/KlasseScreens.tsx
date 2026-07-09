import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, TextInput, Alert, Pressable, Linking } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, PrimaryButton, AccentButton, SecondaryButton, Center, Loading, LevelBadge, Chip } from "../../components/ui";
import { PeopleIcon, MicIcon, CloseIcon } from "../../components/icons";
import * as db from "../../lib/db";
import { useMyClasses, useClassAssignments, useMySubmissions, useClassLeaderboard, useInvalidateClass } from "../../lib/hooks";
import type { EnrolledClass, Assignment, AssignmentKind, SubmissionStatus } from "@repo/types";

// 29–34 · Klasse. Nur bei aktivem class_enabled sichtbar (Tab flag-gated). Phase 1
// wired: Beitritt, eingeschriebenes Dashboard (my_classes), Aufgabenliste + Status,
// Wochen-Rangliste (class_leaderboard), Verlassen. Sprechen-Aufnahme + Abgabe/
// Bewertung sind Lehrkraft-Phase (deferred) → Aufgaben nur ansehbar, keine Fake-Writes.

// TODO: durch die echte Kurs-/Einschreibe-Website ersetzen (öffnet im externen Browser).
const ENROLL_URL = "https://example.org/kurse";

const KIND_LABEL: Record<AssignmentKind, string> = { writing: "Schreiben", speaking: "Sprechen", practice: "Übung" };
const STATUS_LABEL: Record<SubmissionStatus, string> = { pending: "Begonnen", submitted: "Eingereicht", graded: "Bewertet" };
const statusText = (s?: SubmissionStatus) => (s ? STATUS_LABEL[s] : "Offen");

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

  const statusColor = (s?: SubmissionStatus) =>
    s === "graded" ? accent.gruen : s === "submitted" ? accent.blau : s === "pending" ? accent.gold : c.textFaint;
  const kindColor = (k: AssignmentKind) => (k === "speaking" ? accent.blau : k === "writing" ? accent.gruen : accent.lila);
  const subStatus = (aid: string) => (submissions.data ?? []).find((s) => s.assignmentId === aid)?.status;

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

// 32–34 · Sprechen Teil 2 — inaktive Shells (Lehrkraft-Phase). Kein Recording,
// keine Abgabe: die Aufnahme + der Upload zur Bewertung folgen mit R2 + /api/speaking/*.
export function SprechenTaskScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 16 }}>Ein Thema präsentieren</AppText>
      <Card style={{ marginTop: 16 }}>
        <Eyebrow color={accent.blau}>Deine Aufgabe</Eyebrow>
        <AppText size={14} color={c.textBody} lh={20} style={{ marginTop: 6 }}>Präsentiere das Thema in ca. 3 Minuten anhand der Stichpunkte.</AppText>
      </Card>
      <View style={{ position: "absolute", left: 18, right: 18, bottom: 24 }}>
        <AppText size={12.5} color={c.textMuted} align="center" style={{ marginBottom: 10 }}>Die Aufnahme ist bald verfügbar.</AppText>
        <AccentButton label="Aufnahme starten" color={accent.blau} onPress={() => nav.navigate("SprechenRecord")} />
      </View>
    </View>
  );
}

export function SprechenRecordScreen() {
  const { c, accent, tint } = useTheme();
  const nav = useNavigation<any>();
  const [seconds, setSeconds] = useState(300);
  useEffect(() => {
    const iv = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : (nav.navigate("SprechenReview"), 0))), 1000);
    return () => clearInterval(iv);
  }, []);
  const mm = Math.floor(seconds / 60), ss = String(seconds % 60).padStart(2, "0");
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
      <PrimaryButton label="Aufnahme stoppen" onPress={() => nav.navigate("SprechenReview")} style={{ marginTop: 24, alignSelf: "stretch" }} />
    </Center>
  );
}

export function SprechenReviewScreen() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <AppText role="serif" size={22} color={c.textHi}>Deine Aufnahme</AppText>
      <Card style={{ marginTop: 16 }}>
        <AppText size={14} color={c.textMuted}>Höre dir die Aufnahme an, bevor du sie einreichst.</AppText>
      </Card>
      <View style={{ position: "absolute", left: 18, right: 18, bottom: 24 }}>
        {/* Kein Fake-Write: die Abgabe an die Lehrkraft folgt in der Lehrkraft-Phase. */}
        <AppText size={12.5} color={c.textMuted} align="center" style={{ marginBottom: 10 }}>Die Abgabe an die Lehrkraft ist bald verfügbar.</AppText>
        <SecondaryButton label="Neu aufnehmen" onPress={() => nav.navigate("SprechenRecord")} />
      </View>
    </View>
  );
}
