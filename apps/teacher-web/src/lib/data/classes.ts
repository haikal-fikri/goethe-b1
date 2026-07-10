import type { SupabaseClient } from "@supabase/supabase-js";

// Client-direkte Klassen-CRUD unter RLS (teacher-lms/03 #1,2,3,5). Alle Writes
// sind durch die "classes teacher …"-Policies (teacher_id = auth.uid()) + den
// enforce_class_cap-Trigger (Starter-Cap 3 aktive Klassen) gedeckt. KEINE Route.
//
// DI: jede Funktion nimmt den (RLS-scoped) SupabaseClient — Browser-Client
// (client-direkt) ODER Server-Client (SSR-Read). Der Aufrufer liefert die
// eigene uid, wo eine WITH-CHECK-Policy sie = auth.uid() erwartet.

export interface NewClass {
  name: string;
  term_start: string; // ISO-Datum YYYY-MM-DD
  term_end: string; // ISO-Datum
}

/** Eigene Klassen ("classes teacher select": teacher_id = auth.uid()). */
export function listClasses(sb: SupabaseClient) {
  return sb.from("classes").select("*").order("created_at", { ascending: false });
}

/** Neue Klasse. `teacherId` MUSS = auth.uid() (WITH CHECK + cap-Trigger). */
export function createClass(sb: SupabaseClient, teacherId: string, input: NewClass) {
  return sb
    .from("classes")
    .insert({
      teacher_id: teacherId,
      name: input.name,
      term_start: input.term_start,
      term_end: input.term_end,
    })
    .select()
    .single();
}

export function renameClass(sb: SupabaseClient, classId: string, name: string) {
  return sb.from("classes").update({ name }).eq("id", classId).select().single();
}

export function setClassTerm(
  sb: SupabaseClient,
  classId: string,
  termStart: string,
  termEnd: string
) {
  return sb
    .from("classes")
    .update({ term_start: termStart, term_end: termEnd })
    .eq("id", classId)
    .select()
    .single();
}

/** Archivieren (sperrt neue Arbeit via is_class_locked; Noten bleiben offen). */
export function archiveClass(sb: SupabaseClient, classId: string) {
  return sb
    .from("classes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", classId)
    .select()
    .single();
}

export function unarchiveClass(sb: SupabaseClient, classId: string) {
  return sb.from("classes").update({ archived_at: null }).eq("id", classId).select().single();
}

export function deleteClass(sb: SupabaseClient, classId: string) {
  return sb.from("classes").delete().eq("id", classId);
}

/** Join-Code rotieren (SECURITY DEFINER rpc, is_class_teacher-Gate). Gibt neuen Code. */
export function rotateJoinCode(sb: SupabaseClient, classId: string) {
  return sb.rpc("rotate_join_code", { p_class: classId });
}

// ── Roster + Einladungen ──────────────────────────────────────────────────

/** Aktive Einschreibungen einer eigenen Klasse ("enroll teacher select"). */
export function listEnrollments(sb: SupabaseClient, classId: string) {
  return sb.from("class_enrollments").select("*").eq("class_id", classId);
}

/** Offene/vergangene Einladungen einer eigenen Klasse ("invites teacher select"). */
export function listClassInvites(sb: SupabaseClient, classId: string) {
  return sb
    .from("class_invites")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
}

/**
 * Einladung zurückziehen: der EINZIGE erlaubte Client-Write auf class_invites
 * ("invites teacher revoke", WITH CHECK status='revoked'). Erstellt werden
 * Einladungen nur über die service-role-Route POST /api/class/invite.
 */
export function revokeInvite(sb: SupabaseClient, inviteId: string) {
  return sb
    .from("class_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .select()
    .single();
}
