import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-seitiger View-Model-Aufbau fürs Dashboard. Alle Reads laufen über den
// RLS-scoped SSR-Client (teacher select policies gaten sie auf die eigenen
// Klassen). Bewusst mehrere kleine Queries + JS-Assembly statt tiefer Embeds —
// robuster gegenüber RLS auf verschachtelten Relationen.

export interface QueueItem {
  submissionId: string;
  skill: "schreiben" | "sprechen";
  student: string;
  studentId: string;
  klasse: string;
  aufgabe: string;
  when: string | null;
}
export interface SessionItem {
  startsAt: string;
  klasse: string;
  ort: string;
}
export interface ClassCard {
  id: string;
  name: string;
  members: number;
  nextStartsAt: string | null;
  offen: number;
}
export interface DashboardData {
  queue: QueueItem[];
  offenWriting: number;
  offenSpeaking: number;
  studentsTotal: number;
  classesTotal: number;
  nextSession: { startsAt: string; klasse: string } | null;
  sessions: SessionItem[];
  classes: ClassCard[];
  avvNeeded: boolean;
}

type Row = Record<string, unknown>;

function nameMapFrom(rows: Row[], idKey: string, nameKey: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of rows) m[r[idKey] as string] = (r[nameKey] as string | null) ?? "";
  return m;
}

export async function getDashboardData(sb: SupabaseClient, userId: string): Promise<DashboardData> {
  // Klassen der Lehrkraft.
  const { data: classRows } = await sb.from("classes").select("id, name").order("created_at", { ascending: false });
  const classes = (classRows ?? []) as Array<{ id: string; name: string }>;
  const classIds = classes.map((c) => c.id);
  const classNames = nameMapFrom(classes, "id", "name");

  if (classIds.length === 0) {
    return {
      queue: [],
      offenWriting: 0,
      offenSpeaking: 0,
      studentsTotal: 0,
      classesTotal: 0,
      nextSession: null,
      sessions: [],
      classes: [],
      avvNeeded: await avvNeeded(sb, userId),
    };
  }

  // Mitgliederzahlen.
  const { data: enr } = await sb
    .from("class_enrollments")
    .select("class_id")
    .in("class_id", classIds)
    .eq("status", "active");
  const memberCount: Record<string, number> = {};
  for (const e of (enr ?? []) as Array<{ class_id: string }>) {
    memberCount[e.class_id] = (memberCount[e.class_id] ?? 0) + 1;
  }
  const studentsTotal = Object.values(memberCount).reduce((s, n) => s + n, 0);

  // ── Schreiben-Warteschlange: eingereichte, noch nicht bewertete Abgaben ──
  const { data: subRows } = await sb
    .from("assignment_submissions")
    .select("id, assignment_id, student_id, submitted_at")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });
  const subs = (subRows ?? []) as Array<{ id: string; assignment_id: string; student_id: string; submitted_at: string | null }>;

  const writingAssignIds = [...new Set(subs.map((s) => s.assignment_id))];
  const assignMeta: Record<string, { title: string; kind: string; class_id: string }> = {};
  if (writingAssignIds.length) {
    const { data: a } = await sb
      .from("assignments")
      .select("id, title, kind, class_id")
      .in("id", writingAssignIds);
    for (const r of (a ?? []) as Array<{ id: string; title: string; kind: string; class_id: string }>) {
      assignMeta[r.id] = { title: r.title, kind: r.kind, class_id: r.class_id };
    }
  }

  // ── Sprechen-Warteschlange: transkribiert ('scored'), noch nicht bewertet ──
  const { data: spkRows } = await sb
    .from("speaking_submissions")
    .select("id, assignment_id, student_id, created_at")
    .eq("status", "scored")
    .order("created_at", { ascending: true });
  const spk = (spkRows ?? []) as Array<{ id: string; assignment_id: string; student_id: string; created_at: string | null }>;

  const spkAssignIds = [...new Set(spk.map((s) => s.assignment_id))];
  const spkMeta: Record<string, { teil: number; class_id: string; prompt: string | null }> = {};
  if (spkAssignIds.length) {
    const { data: sa } = await sb
      .from("speaking_assignments")
      .select("id, teil, class_id, prompt_de")
      .in("id", spkAssignIds);
    for (const r of (sa ?? []) as Array<{ id: string; teil: number; class_id: string; prompt_de: string | null }>) {
      spkMeta[r.id] = { teil: r.teil, class_id: r.class_id, prompt: r.prompt_de };
    }
  }

  // Studierenden-Namen (Profile) für beide Warteschlangen.
  const studentIds = [...new Set([...subs.map((s) => s.student_id), ...spk.map((s) => s.student_id)])];
  const studentNames: Record<string, string> = {};
  if (studentIds.length) {
    const { data: p } = await sb.from("profiles").select("id, display_name").in("id", studentIds);
    Object.assign(studentNames, nameMapFrom((p ?? []) as Row[], "id", "display_name"));
  }
  const nameOf = (id: string) => studentNames[id]?.trim() || "Teilnehmende:r";

  const queue: QueueItem[] = [];
  for (const s of subs) {
    const meta = assignMeta[s.assignment_id];
    if (!meta || meta.kind !== "writing") continue;
    queue.push({
      submissionId: s.id,
      skill: "schreiben",
      student: nameOf(s.student_id),
      studentId: s.student_id,
      klasse: classNames[meta.class_id] ?? "—",
      aufgabe: meta.title,
      when: s.submitted_at,
    });
  }
  for (const s of spk) {
    const meta = spkMeta[s.assignment_id];
    if (!meta) continue;
    queue.push({
      submissionId: s.id,
      skill: "sprechen",
      student: nameOf(s.student_id),
      studentId: s.student_id,
      klasse: classNames[meta.class_id] ?? "—",
      aufgabe: meta.prompt ? `Teil ${meta.teil}: ${truncate(meta.prompt, 40)}` : `Sprechen · Teil ${meta.teil}`,
      when: s.created_at,
    });
  }
  queue.sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));

  const offenWriting = queue.filter((q) => q.skill === "schreiben").length;
  const offenSpeaking = queue.filter((q) => q.skill === "sprechen").length;

  // Offene Arbeit je Klasse (für die Klassen-Karten).
  const offenByClass: Record<string, number> = {};
  for (const s of subs) {
    const meta = assignMeta[s.assignment_id];
    if (meta?.kind === "writing") offenByClass[meta.class_id] = (offenByClass[meta.class_id] ?? 0) + 1;
  }
  for (const s of spk) {
    const meta = spkMeta[s.assignment_id];
    if (meta) offenByClass[meta.class_id] = (offenByClass[meta.class_id] ?? 0) + 1;
  }

  // ── Kommende Sitzungen ──
  const nowIso = new Date().toISOString();
  const { data: sessRows } = await sb
    .from("class_sessions")
    .select("id, class_id, starts_at, title, status")
    .in("class_id", classIds)
    .eq("status", "scheduled")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(8);
  const sess = (sessRows ?? []) as Array<{ class_id: string; starts_at: string; title: string | null }>;
  const sessions: SessionItem[] = sess.map((s) => ({
    startsAt: s.starts_at,
    klasse: classNames[s.class_id] ?? "—",
    ort: s.title ?? "—",
  }));
  const nextByClass: Record<string, string> = {};
  for (const s of sess) if (!nextByClass[s.class_id]) nextByClass[s.class_id] = s.starts_at;

  const classCards: ClassCard[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    members: memberCount[c.id] ?? 0,
    nextStartsAt: nextByClass[c.id] ?? null,
    offen: offenByClass[c.id] ?? 0,
  }));

  return {
    queue,
    offenWriting,
    offenSpeaking,
    studentsTotal,
    classesTotal: classes.length,
    nextSession: sess[0] ? { startsAt: sess[0].starts_at, klasse: classNames[sess[0].class_id] ?? "—" } : null,
    sessions: sessions.slice(0, 4),
    classes: classCards.slice(0, 3),
    avvNeeded: await avvNeeded(sb, userId),
  };
}

async function avvNeeded(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await sb.from("teacher_agreements").select("teacher_id").eq("teacher_id", userId).maybeSingle();
  return !data;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
