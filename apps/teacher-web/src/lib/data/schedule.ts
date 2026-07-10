import type { SupabaseClient } from "@supabase/supabase-js";

// Client-direkte Stundenplan-/Sitzungs-/Anwesenheits-CRUD unter RLS
// (teacher-lms/03 #10,11,13). Policies "sched teacher all" / "session teacher all"
// / "attend teacher all" — alle is_class_teacher-gated. Sitzungs-ABSAGE läuft
// NICHT hier, sondern über POST /api/class/sessions/:id/cancel (fan-out notify).

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface NewSchedule {
  class_id: string;
  weekday: number; // 0=So … 6=Sa
  start_time: string; // "HH:MM" / "HH:MM:SS"
  duration_min?: number; // default 90
  timezone?: string; // default "Europe/Berlin"
  starts_on: string; // ISO-Datum
  ends_on?: string | null; // null = offen
}

export interface NewAdHocSession {
  class_id: string;
  starts_at: string; // ISO-Timestamp
  ends_at: string; // ISO-Timestamp
  title?: string | null;
}

// ── Stundenplan ────────────────────────────────────────────────────────────

export function listSchedules(sb: SupabaseClient, classId: string) {
  return sb.from("class_schedules").select("*").eq("class_id", classId).order("weekday");
}

export function createSchedule(sb: SupabaseClient, input: NewSchedule) {
  return sb.from("class_schedules").insert(input).select().single();
}

export function updateSchedule(
  sb: SupabaseClient,
  scheduleId: string,
  patch: Partial<Omit<NewSchedule, "class_id">> & { active?: boolean }
) {
  return sb.from("class_schedules").update(patch).eq("id", scheduleId).select().single();
}

export function deleteSchedule(sb: SupabaseClient, scheduleId: string) {
  return sb.from("class_schedules").delete().eq("id", scheduleId);
}

// ── Sitzungen (ad-hoc; wiederkehrende erzeugt der generate-sessions-Cron) ────

export function listSessions(sb: SupabaseClient, classId: string) {
  return sb
    .from("class_sessions")
    .select("*")
    .eq("class_id", classId)
    .order("starts_at", { ascending: false });
}

/** Ad-hoc-Einzelsitzung (schedule_id bleibt null). */
export function createAdHocSession(sb: SupabaseClient, input: NewAdHocSession) {
  return sb
    .from("class_sessions")
    .insert({
      class_id: input.class_id,
      schedule_id: null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      title: input.title ?? null,
    })
    .select()
    .single();
}

// ── Anwesenheit ──────────────────────────────────────────────────────────

export function listAttendance(sb: SupabaseClient, sessionId: string) {
  return sb.from("attendance").select("*").eq("session_id", sessionId);
}

/**
 * Anwesenheit setzen/aktualisieren (upsert auf PK (session_id, student_id)).
 * `markedBy` MUSS = auth.uid() (WITH CHECK: marked_by = auth.uid()).
 */
export function markAttendance(
  sb: SupabaseClient,
  markedBy: string,
  input: { session_id: string; student_id: string; status: AttendanceStatus; note?: string | null }
) {
  return sb
    .from("attendance")
    .upsert(
      {
        session_id: input.session_id,
        student_id: input.student_id,
        status: input.status,
        note: input.note ?? null,
        marked_by: markedBy,
      },
      { onConflict: "session_id,student_id" }
    )
    .select()
    .single();
}
