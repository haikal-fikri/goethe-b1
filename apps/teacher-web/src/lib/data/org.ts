import type { SupabaseClient } from "@supabase/supabase-js";

// Client-direkte Pro-Org-/Seat-/Staffing-CRUD unter RLS (teacher-lms/03 #38-41,
// 02 §16.5/16.6). Der Owner CRUD't Org ("org owner all"), Seats
// ("orgmem owner all", Cap-Trigger ≤20), Staffing ("staff manage",
// is_class_teacher + class_staff_assignee_ok). Nur das Seat-INVITE (E-Mail +
// role='teacher'-Grant) ist eine service-role-Route (POST /api/org/invite).

export type ClassStaffRole = "lead" | "assistant";

// ── Organisation (1 pro Owner, MVP) ─────────────────────────────────────────

/** Eigene Org(s) ("org owner all" / "org member read"). */
export function listOrganizations(sb: SupabaseClient) {
  return sb.from("organizations").select("*");
}

/** Org anlegen. `ownerId` MUSS = auth.uid() (WITH CHECK). */
export function createOrganization(sb: SupabaseClient, ownerId: string, name: string) {
  return sb.from("organizations").insert({ owner_id: ownerId, name }).select().single();
}

export function renameOrganization(sb: SupabaseClient, orgId: string, name: string) {
  return sb.from("organizations").update({ name }).eq("id", orgId).select().single();
}

// ── Seats (org_members) ─────────────────────────────────────────────────────

/** Seats einer Org lesen ("orgmem owner all"; Owner). */
export function listSeats(sb: SupabaseClient, orgId: string) {
  return sb.from("org_members").select("*").eq("org_id", orgId);
}

/** Seat sperren (gibt Kontingent NICHT frei — Cap zählt nur active). */
export function suspendSeat(sb: SupabaseClient, orgId: string, userId: string) {
  return sb
    .from("org_members")
    .update({ status: "suspended" })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .select()
    .single();
}

export function reactivateSeat(sb: SupabaseClient, orgId: string, userId: string) {
  return sb
    .from("org_members")
    .update({ status: "active" })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .select()
    .single();
}

/** Seat entfernen (gibt Kontingent frei). */
export function removeSeat(sb: SupabaseClient, orgId: string, userId: string) {
  return sb.from("org_members").delete().eq("org_id", orgId).eq("user_id", userId);
}

/** Sitz-Einladung per Token einlösen (SECURITY DEFINER rpc, JWT-E-Mail-gebunden). */
export function claimOrgInvite(sb: SupabaseClient, token: string) {
  return sb.rpc("claim_org_invite", { p_token: token });
}

// ── Class-Staffing (Lead / TA) ───────────────────────────────────────────────

/** Staff-Roster einer Klasse ("staff peer read"; jeder Grader). */
export function listClassStaff(sb: SupabaseClient, classId: string) {
  return sb.from("class_staff").select("*").eq("class_id", classId);
}

/**
 * Lead/TA einer Klasse zuweisen. `assignedBy` = auth.uid(). Der zugewiesene
 * `teacherId` muss ein AKTIVER org_members-Seat der Org der Klasse sein — hart
 * erzwungen durch class_staff_assignee_ok() im WITH CHECK; ein TA kann sich
 * nicht selbst staffen (staff manage verlangt is_class_teacher).
 */
export function assignStaff(
  sb: SupabaseClient,
  assignedBy: string,
  input: { class_id: string; teacher_id: string; role: ClassStaffRole }
) {
  return sb
    .from("class_staff")
    .insert({
      class_id: input.class_id,
      teacher_id: input.teacher_id,
      role: input.role,
      assigned_by: assignedBy,
    })
    .select()
    .single();
}

/** Staff-Rolle ändern (Lead ⇄ TA). */
export function updateStaffRole(
  sb: SupabaseClient,
  classId: string,
  teacherId: string,
  role: ClassStaffRole
) {
  return sb
    .from("class_staff")
    .update({ role })
    .eq("class_id", classId)
    .eq("teacher_id", teacherId)
    .select()
    .single();
}

export function removeStaff(sb: SupabaseClient, classId: string, teacherId: string) {
  return sb.from("class_staff").delete().eq("class_id", classId).eq("teacher_id", teacherId);
}
