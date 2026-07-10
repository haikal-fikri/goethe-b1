import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classesData } from "@/lib/data";
import type { AttendanceStatus } from "@/lib/data/schedule";

// Server-seitiger View-Model-Aufbau für Stundenplan & Anwesenheit. Alle Reads
// laufen über den RLS-scoped SSR-Client (teacher select policies gaten sie auf
// die eigenen Klassen). Bewusst mehrere kleine Queries + JS-Assembly (kein
// verschachtelter Embed) — robuster gegenüber RLS auf Relationen. Mutationen
// laufen NICHT hier, sondern client-direkt (lib/data/schedule) bzw. über die
// Absage-Route (/api/class/sessions/:id/cancel).

const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WD_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export type SessionStatus = "scheduled" | "canceled" | "held";

export interface ScheduleRule {
  id: string;
  weekday: number;
  weekdayShort: string;
  weekdayLong: string;
  time: string; // "18:30"
  durationMin: number;
}
export interface ClassScheduleGroup {
  classId: string;
  className: string;
  timezone: string;
  rules: ScheduleRule[];
}
export interface SessionVM {
  id: string;
  classId: string;
  className: string;
  startsAt: string;
  endsAt: string;
  title: string | null;
  status: SessionStatus;
  isPast: boolean;
}
export interface ScheduleOverview {
  classes: Array<{ id: string; name: string }>;
  schedules: ClassScheduleGroup[];
  upcoming: SessionVM[];
  recent: SessionVM[];
}

export interface RosterEntry {
  studentId: string;
  name: string;
  status: AttendanceStatus | null;
  note: string | null;
}
export interface AttendanceContext {
  session: {
    id: string;
    classId: string;
    className: string;
    startsAt: string;
    endsAt: string;
    title: string | null;
    status: SessionStatus;
  };
  roster: RosterEntry[];
}

type Row = Record<string, unknown>;

/** "18:30:00" / "18:30" → "18:30". */
function hhmm(t: string | null | undefined): string {
  if (!t) return "—";
  return String(t).slice(0, 5);
}

export async function getScheduleOverview(sb: SupabaseClient): Promise<ScheduleOverview> {
  const { data: classRows } = await classesData.listClasses(sb);
  const classes = ((classRows ?? []) as Array<{ id: string; name: string }>).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const ids = classes.map((c) => c.id);
  if (ids.length === 0) {
    return { classes: [], schedules: [], upcoming: [], recent: [] };
  }
  const nameOf = (id: string) => classes.find((c) => c.id === id)?.name ?? "—";

  // ── Wiederkehrende Regeln (aktive Wochenpläne je Klasse) ──
  const { data: schedRows } = await sb
    .from("class_schedules")
    .select("*")
    .in("class_id", ids)
    .eq("active", true)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });
  const scheds = (schedRows ?? []) as Array<{
    id: string;
    class_id: string;
    weekday: number;
    start_time: string;
    duration_min: number;
    timezone: string;
  }>;
  const schedules: ClassScheduleGroup[] = classes
    .map((c) => {
      const rules = scheds.filter((s) => s.class_id === c.id);
      return {
        classId: c.id,
        className: c.name,
        timezone: rules[0]?.timezone ?? "Europe/Berlin",
        rules: rules.map((s) => ({
          id: s.id,
          weekday: s.weekday,
          weekdayShort: WD_SHORT[s.weekday] ?? "—",
          weekdayLong: WD_LONG[s.weekday] ?? "—",
          time: hhmm(s.start_time),
          durationMin: s.duration_min,
        })),
      };
    })
    .filter((g) => g.rules.length > 0);

  // ── Termine: jüngste Vergangenheit + alle kommenden ──
  const now = Date.now();
  const since = new Date(now - 30 * 86400000).toISOString();
  const { data: sessRows } = await sb
    .from("class_sessions")
    .select("*")
    .in("class_id", ids)
    .gte("starts_at", since)
    .order("starts_at", { ascending: true });
  const sess = (sessRows ?? []) as Array<{
    id: string;
    class_id: string;
    starts_at: string;
    ends_at: string;
    title: string | null;
    status: SessionStatus;
  }>;

  const upcoming: SessionVM[] = [];
  const recent: SessionVM[] = [];
  for (const s of sess) {
    const isPast = new Date(s.ends_at).getTime() < now;
    const vm: SessionVM = {
      id: s.id,
      classId: s.class_id,
      className: nameOf(s.class_id),
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      title: s.title,
      status: s.status,
      isPast,
    };
    (isPast ? recent : upcoming).push(vm);
  }
  recent.reverse(); // jüngste zuerst

  return { classes, schedules, upcoming, recent: recent.slice(0, 10) };
}

export async function getAttendanceContext(
  sb: SupabaseClient,
  sessionId: string
): Promise<AttendanceContext | null> {
  // RLS ("session teacher all") gibt fremde Sitzungen als null zurück → notFound.
  const { data: sessRow } = await sb
    .from("class_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sessRow) return null;
  const s = sessRow as {
    id: string;
    class_id: string;
    starts_at: string;
    ends_at: string;
    title: string | null;
    status: SessionStatus;
  };

  const { data: classRow } = await sb
    .from("classes")
    .select("id, name")
    .eq("id", s.class_id)
    .maybeSingle();
  const className = (classRow as { name?: string } | null)?.name ?? "—";

  // Roster: aktive Einschreibungen der Klasse.
  const { data: enrRows } = await classesData.listEnrollments(sb, s.class_id);
  const enr = ((enrRows ?? []) as Array<{ student_id: string; status: string }>).filter(
    (e) => e.status === "active"
  );
  const studentIds = enr.map((e) => e.student_id);

  const nameById: Record<string, string> = {};
  if (studentIds.length) {
    const { data: profRows } = await sb
      .from("profiles")
      .select("id, display_name")
      .in("id", studentIds);
    for (const p of (profRows ?? []) as Row[]) {
      nameById[p.id as string] = ((p.display_name as string | null) ?? "").trim();
    }
  }

  // Bereits erfasste Anwesenheit dieser Sitzung.
  const attById: Record<string, { status: AttendanceStatus; note: string | null }> = {};
  const { data: attRows } = await sb
    .from("attendance")
    .select("student_id, status, note")
    .eq("session_id", sessionId);
  for (const a of (attRows ?? []) as Array<{
    student_id: string;
    status: AttendanceStatus;
    note: string | null;
  }>) {
    attById[a.student_id] = { status: a.status, note: a.note };
  }

  const roster: RosterEntry[] = studentIds
    .map((id) => ({
      studentId: id,
      name: nameById[id] || "Teilnehmende:r",
      status: attById[id]?.status ?? null,
      note: attById[id]?.note ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return {
    session: {
      id: s.id,
      classId: s.class_id,
      className,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      title: s.title,
      status: s.status,
    },
    roster,
  };
}
