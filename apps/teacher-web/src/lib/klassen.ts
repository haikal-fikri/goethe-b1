import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-seitiger View-Model-Aufbau für die Klassen-Screens (Phase 5). Spiegelt
// dashboard.ts: mehrere kleine, RLS-gescopte Reads + JS-Assembly statt tiefer
// Embeds. Es werden AUSSCHLIESSLICH real vorhandene Spalten gelesen — die im
// Design-Mock gezeigten Felder (Prüfungsbereitschaft %, Punkte/Rangliste,
// Sim-Durchschnitt) haben KEINE DB-Grundlage und tauchen hier bewusst nicht auf.

type Row = Record<string, unknown>;

/* ── Klassen-Liste ─────────────────────────────────────────────────────── */

export interface ClassListItem {
  id: string;
  name: string;
  org: string | null;
  termLabel: string | null;
  members: number;
  offen: number;
  nextStartsAt: string | null;
  joinCode: string;
  archived: boolean;
}

export async function getClassList(sb: SupabaseClient): Promise<ClassListItem[]> {
  const { data: classRows } = await sb
    .from("classes")
    .select("id, name, join_code, term_start, term_end, org_id, archived_at")
    .order("created_at", { ascending: false });
  const classes = (classRows ?? []) as Array<{
    id: string;
    name: string;
    join_code: string;
    term_start: string | null;
    term_end: string | null;
    org_id: string | null;
    archived_at: string | null;
  }>;
  if (classes.length === 0) return [];
  const classIds = classes.map((c) => c.id);

  // Mitgliederzahlen (aktive Einschreibungen).
  const memberCount = await countActiveMembers(sb, classIds);

  // Organisations-Namen.
  const orgIds = [...new Set(classes.map((c) => c.org_id).filter((x): x is string => !!x))];
  const orgNames: Record<string, string> = {};
  if (orgIds.length) {
    const { data } = await sb.from("organizations").select("id, name").in("id", orgIds);
    for (const o of (data ?? []) as Array<{ id: string; name: string }>) orgNames[o.id] = o.name;
  }

  // Offene Bewertungen je Klasse.
  const offenByClass = await openGradingByClass(sb, classIds);

  // Nächste geplante Sitzung je Klasse.
  const nowIso = new Date().toISOString();
  const { data: sessRows } = await sb
    .from("class_sessions")
    .select("class_id, starts_at")
    .in("class_id", classIds)
    .eq("status", "scheduled")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });
  const nextByClass: Record<string, string> = {};
  for (const s of (sessRows ?? []) as Array<{ class_id: string; starts_at: string }>) {
    if (!nextByClass[s.class_id]) nextByClass[s.class_id] = s.starts_at;
  }

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    org: c.org_id ? orgNames[c.org_id] ?? null : null,
    termLabel: termLabel(c.term_start, c.term_end),
    members: memberCount[c.id] ?? 0,
    offen: offenByClass[c.id] ?? 0,
    nextStartsAt: nextByClass[c.id] ?? null,
    joinCode: c.join_code,
    archived: !!c.archived_at,
  }));
}

/* ── Klassen-Detail ────────────────────────────────────────────────────── */

export interface RosterEntry {
  studentId: string;
  name: string;
  status: string; // enrollment_status ('active')
  joinedAt: string | null;
  offen: number; // offene (eingereichte, unbewertete) Abgaben dieser Person in dieser Klasse
}

export interface DetailAssignment {
  id: string;
  title: string;
  kind: "writing" | "speaking" | "practice";
  dueAt: string | null;
  submitted: number; // Teilnehmende, die eingereicht haben
  total: number; // aktive Mitglieder
  offen: number; // noch zu bewerten
}

export interface DetailSession {
  id: string;
  startsAt: string;
  title: string | null; // trägt zugleich Raum/Ort — es gibt keine separate Ortsspalte
  status: string; // session_status
  present: number;
  absent: number;
  late: number;
  excused: number;
  recorded: number; // Summe erfasster Anwesenheits-Einträge
}

export interface PendingInvite {
  id: string;
  email: string;
  createdAt: string | null;
  expiresAt: string | null;
}

export interface ClassDetailVM {
  id: string;
  name: string;
  joinCode: string;
  org: string | null;
  termLabel: string | null;
  archived: boolean;
  members: number;
  roster: RosterEntry[];
  assignments: DetailAssignment[];
  sessions: DetailSession[];
  invites: PendingInvite[];
}

export async function getClassDetail(sb: SupabaseClient, classId: string): Promise<ClassDetailVM | null> {
  const { data: cls } = await sb
    .from("classes")
    .select("id, name, join_code, term_start, term_end, org_id, archived_at")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return null; // RLS-gescoped → fremde/ungültige Klasse ⇒ notFound()
  const c = cls as {
    id: string;
    name: string;
    join_code: string;
    term_start: string | null;
    term_end: string | null;
    org_id: string | null;
    archived_at: string | null;
  };

  // Organisation.
  let org: string | null = null;
  if (c.org_id) {
    const { data } = await sb.from("organizations").select("name").eq("id", c.org_id).maybeSingle();
    org = (data as { name: string } | null)?.name ?? null;
  }

  // Roster (aktive Einschreibungen) + Namen.
  const { data: enrRows } = await sb
    .from("class_enrollments")
    .select("student_id, status, joined_at")
    .eq("class_id", classId)
    .eq("status", "active");
  const enrollments = (enrRows ?? []) as Array<{ student_id: string; status: string; joined_at: string | null }>;
  const studentIds = enrollments.map((e) => e.student_id);

  const nameOf: Record<string, string> = {};
  if (studentIds.length) {
    const { data: p } = await sb.from("profiles").select("id, display_name").in("id", studentIds);
    for (const r of (p ?? []) as Row[]) nameOf[r.id as string] = ((r.display_name as string | null) ?? "").trim();
  }

  // Schreib-/Übungs-Aufgaben der Klasse.
  const { data: aRows } = await sb
    .from("assignments")
    .select("id, title, kind, due_at, created_at")
    .eq("class_id", classId)
    .order("due_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const assignments = (aRows ?? []) as Array<{
    id: string;
    title: string;
    kind: "writing" | "speaking" | "practice";
    due_at: string | null;
  }>;
  const writingIds = assignments.filter((a) => a.kind === "writing").map((a) => a.id);

  // Sprech-Aufgaben der Klasse.
  const { data: saRows } = await sb
    .from("speaking_assignments")
    .select("id, teil, prompt_de, due_at")
    .eq("class_id", classId)
    .order("due_at", { ascending: false, nullsFirst: false });
  const spkAssigns = (saRows ?? []) as Array<{ id: string; teil: number; prompt_de: string | null; due_at: string | null }>;
  const spkIds = spkAssigns.map((s) => s.id);

  // Abgaben.
  let wSubs: Array<{ assignment_id: string; student_id: string; status: string }> = [];
  if (writingIds.length) {
    const { data } = await sb
      .from("assignment_submissions")
      .select("assignment_id, student_id, status")
      .in("assignment_id", writingIds);
    wSubs = (data ?? []) as typeof wSubs;
  }
  let sSubs: Array<{ assignment_id: string; student_id: string; status: string }> = [];
  if (spkIds.length) {
    const { data } = await sb
      .from("speaking_submissions")
      .select("assignment_id, student_id, status")
      .in("assignment_id", spkIds);
    sSubs = (data ?? []) as typeof sSubs;
  }

  const total = studentIds.length;

  // Offene Arbeit je Teilnehmende:r (Schreiben 'submitted' + Sprechen 'scored').
  const openByStudent: Record<string, number> = {};
  for (const s of wSubs) if (s.status === "submitted") openByStudent[s.student_id] = (openByStudent[s.student_id] ?? 0) + 1;
  for (const s of sSubs) if (s.status === "scored") openByStudent[s.student_id] = (openByStudent[s.student_id] ?? 0) + 1;

  const roster: RosterEntry[] = enrollments
    .map((e) => ({
      studentId: e.student_id,
      name: nameOf[e.student_id] || "Teilnehmende:r",
      status: e.status,
      joinedAt: e.joined_at,
      offen: openByStudent[e.student_id] ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  // Fortschritt je Schreib-/Übungs-Aufgabe.
  const wByAssign: Record<string, { students: Set<string>; offen: number }> = {};
  for (const s of wSubs) {
    const g = (wByAssign[s.assignment_id] ??= { students: new Set(), offen: 0 });
    if (s.status === "submitted" || s.status === "graded") g.students.add(s.student_id);
    if (s.status === "submitted") g.offen++;
  }
  const assignmentRows: DetailAssignment[] = assignments.map((a) => {
    const g = wByAssign[a.id];
    return {
      id: a.id,
      title: a.title,
      kind: a.kind,
      dueAt: a.due_at,
      submitted: g ? g.students.size : 0,
      total,
      offen: g ? g.offen : 0,
    };
  });

  // Fortschritt je Sprech-Aufgabe.
  const sByAssign: Record<string, { students: Set<string>; offen: number }> = {};
  for (const s of sSubs) {
    const g = (sByAssign[s.assignment_id] ??= { students: new Set(), offen: 0 });
    g.students.add(s.student_id);
    if (s.status === "scored") g.offen++;
  }
  for (const sa of spkAssigns) {
    const g = sByAssign[sa.id];
    assignmentRows.push({
      id: sa.id,
      title: sa.prompt_de ? `Teil ${sa.teil}: ${truncate(sa.prompt_de, 44)}` : `Sprechen · Teil ${sa.teil}`,
      kind: "speaking",
      dueAt: sa.due_at,
      submitted: g ? g.students.size : 0,
      total,
      offen: g ? g.offen : 0,
    });
  }

  // Anwesenheit: jüngste Sitzungen + Zusammenfassung je Sitzung.
  const { data: sessRows } = await sb
    .from("class_sessions")
    .select("id, starts_at, title, status")
    .eq("class_id", classId)
    .order("starts_at", { ascending: false })
    .limit(10);
  const sessArr = (sessRows ?? []) as Array<{ id: string; starts_at: string; title: string | null; status: string }>;
  const sessIds = sessArr.map((s) => s.id);
  const attBy: Record<string, { present: number; absent: number; late: number; excused: number; recorded: number }> = {};
  if (sessIds.length) {
    const { data: att } = await sb.from("attendance").select("session_id, status").in("session_id", sessIds);
    for (const a of (att ?? []) as Array<{ session_id: string; status: string }>) {
      const g = (attBy[a.session_id] ??= { present: 0, absent: 0, late: 0, excused: 0, recorded: 0 });
      g.recorded++;
      if (a.status === "present") g.present++;
      else if (a.status === "absent") g.absent++;
      else if (a.status === "late") g.late++;
      else if (a.status === "excused") g.excused++;
    }
  }
  const sessions: DetailSession[] = sessArr.map((s) => {
    const g = attBy[s.id] ?? { present: 0, absent: 0, late: 0, excused: 0, recorded: 0 };
    return { id: s.id, startsAt: s.starts_at, title: s.title, status: s.status, ...g };
  });

  // Offene Einladungen (Revoke betrifft nur 'pending').
  const { data: invRows } = await sb
    .from("class_invites")
    .select("id, email, created_at, expires_at")
    .eq("class_id", classId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const invites: PendingInvite[] = ((invRows ?? []) as Array<{
    id: string;
    email: string;
    created_at: string | null;
    expires_at: string | null;
  }>).map((i) => ({ id: i.id, email: i.email, createdAt: i.created_at, expiresAt: i.expires_at }));

  return {
    id: c.id,
    name: c.name,
    joinCode: c.join_code,
    org,
    termLabel: termLabel(c.term_start, c.term_end),
    archived: !!c.archived_at,
    members: total,
    roster,
    assignments: assignmentRows,
    sessions,
    invites,
  };
}

/* ── Helfer ────────────────────────────────────────────────────────────── */

async function countActiveMembers(sb: SupabaseClient, classIds: string[]): Promise<Record<string, number>> {
  const { data } = await sb.from("class_enrollments").select("class_id").in("class_id", classIds).eq("status", "active");
  const m: Record<string, number> = {};
  for (const e of (data ?? []) as Array<{ class_id: string }>) m[e.class_id] = (m[e.class_id] ?? 0) + 1;
  return m;
}

// Offene Bewertungen je Klasse: Schreiben ('submitted') + Sprechen ('scored').
async function openGradingByClass(sb: SupabaseClient, classIds: string[]): Promise<Record<string, number>> {
  const offen: Record<string, number> = {};

  const { data: aRows } = await sb.from("assignments").select("id, class_id, kind").in("class_id", classIds);
  const writingClassOf: Record<string, string> = {};
  const writingIds: string[] = [];
  for (const a of (aRows ?? []) as Array<{ id: string; class_id: string; kind: string }>) {
    if (a.kind === "writing") {
      writingClassOf[a.id] = a.class_id;
      writingIds.push(a.id);
    }
  }
  if (writingIds.length) {
    const { data: subs } = await sb
      .from("assignment_submissions")
      .select("assignment_id")
      .eq("status", "submitted")
      .in("assignment_id", writingIds);
    for (const s of (subs ?? []) as Array<{ assignment_id: string }>) {
      const cid = writingClassOf[s.assignment_id];
      if (cid) offen[cid] = (offen[cid] ?? 0) + 1;
    }
  }

  const { data: saRows } = await sb.from("speaking_assignments").select("id, class_id").in("class_id", classIds);
  const spkClassOf: Record<string, string> = {};
  const spkIds: string[] = [];
  for (const sa of (saRows ?? []) as Array<{ id: string; class_id: string }>) {
    spkClassOf[sa.id] = sa.class_id;
    spkIds.push(sa.id);
  }
  if (spkIds.length) {
    const { data: spk } = await sb
      .from("speaking_submissions")
      .select("assignment_id")
      .eq("status", "scored")
      .in("assignment_id", spkIds);
    for (const s of (spk ?? []) as Array<{ assignment_id: string }>) {
      const cid = spkClassOf[s.assignment_id];
      if (cid) offen[cid] = (offen[cid] ?? 0) + 1;
    }
  }

  return offen;
}

function termLabel(start: string | null, end: string | null): string | null {
  const f = (d: string) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" }).format(dt);
  };
  if (start && end) return `${f(start)} – ${f(end)}`;
  if (start) return `ab ${f(start)}`;
  if (end) return `bis ${f(end)}`;
  return null;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
