import { apiError, inviteSchema } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { enforce, enforceAll } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { getResend, RESEND_FROM_HEADER } from "@/lib/resend";
import { CURRENT_DPA_VERSION } from "@/lib/compliance";

// POST /api/class/invite — E-Mail-Einladungen (service-role + Resend). Der Cross-
// Table-Teilnehmer-Cap (aktiv + pending + neu ≤ max_students) lebt HIER, weil er
// tabellenübergreifend ist. E-Mails werden NIE geloggt. teacher-lms/03 §2.1.
export const runtime = "nodejs";

interface ClassRow {
  teacher_id: string;
  org_id: string | null;
  name: string;
  join_code: string;
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, inviteSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { classId, emails } = parsed;

  // 1) Klassen-Lehrkraft (Lead/Owner) + aktives Klassen-Abo + DPA akzeptiert.
  const { data: isTeacher } = await ctx.supabase.rpc("is_class_teacher", { _class: classId });
  if (!isTeacher) return apiError(403, "forbidden", "Keine Berechtigung für diese Klasse.", { requestId });
  const { data: subActive } = await ctx.supabase.rpc("class_sub_active", { _class: classId });
  if (!subActive) return apiError(403, "forbidden", "Das Klassen-Abo ist nicht aktiv.", { requestId });

  const svc = supabaseService();
  const { data: dpaOk } = await svc.rpc("teacher_dpa_ok", {
    p_teacher: ctx.user.id,
    p_version: CURRENT_DPA_VERSION,
  });
  if (!dpaOk) {
    return apiError(403, "forbidden", "Bitte akzeptiere zuerst den Auftragsverarbeitungsvertrag (DPA).", {
      requestId,
      details: { reason: "dpa_required" },
    });
  }

  // 2) Limiter (fail-open; Cap + Resend-Caps sind die harten Grenzen).
  const rl = await enforceAll([
    () => enforce("inviteBurst", ctx.user.id),
    () => enforce("inviteDay", ctx.user.id),
  ]);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Einladungen. Bitte später erneut.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const { data: cls } = await svc
    .from("classes")
    .select("teacher_id, org_id, name, join_code")
    .eq("id", classId)
    .maybeSingle<ClassRow>();
  if (!cls) return apiError(404, "not_found", "Klasse nicht gefunden.", { requestId });

  // 3) Normalisieren + de-duplizieren.
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()))];

  // 4) Teilnehmer-Cap (nur wenn plan_limits.max_students != null → Starter/Solo).
  //    Plan aus dem VERANTWORTLICHEN Abo (Org-Owner bei Org-Klasse, sonst Lehrkraft).
  let subscriberId = cls.teacher_id;
  if (cls.org_id) {
    const { data: org } = await svc
      .from("organizations")
      .select("owner_id")
      .eq("id", cls.org_id)
      .maybeSingle<{ owner_id: string }>();
    if (org?.owner_id) subscriberId = org.owner_id;
  }
  // FAIL-CLOSED: jeder RPC-Fehler → 500 (nie fail-open). teacher_plan_of coalesct
  // auf Erfolg immer zu 'starter', also ist plan==null NUR ein Transport-Fehler;
  // plan_limits(NULL) gäbe sonst max_students=null → Cap übersprungen. max_students
  // == null NACH fehlerfreiem plan_limits bedeutet echt Pro (unbegrenzt).
  const { data: plan, error: planErr } = await svc.rpc("teacher_plan_of", { p_teacher: subscriberId });
  if (planErr || !plan) {
    return apiError(500, "internal_error", "Plan konnte nicht bestimmt werden.", { requestId });
  }
  const { data: limitRows, error: limErr } = await svc.rpc("plan_limits", { p_plan: plan });
  if (limErr) {
    return apiError(500, "internal_error", "Plan-Limit konnte nicht bestimmt werden.", { requestId });
  }
  const maxStudents = (limitRows?.[0] as { max_students: number | null } | undefined)?.max_students ?? null;
  if (maxStudents != null) {
    const { data: active, error: acErr } = await svc.rpc("teacher_active_student_count", { p_teacher: cls.teacher_id });
    const { data: pending, error: pendErr } = await svc.rpc("teacher_pending_invite_count", { p_teacher: cls.teacher_id });
    if (acErr || pendErr || active == null || pending == null) {
      return apiError(500, "internal_error", "Teilnehmer-Zählung fehlgeschlagen.", { requestId });
    }
    if (Number(active) + Number(pending) + normalized.length > maxStudents) {
      return apiError(409, "conflict", `Plan-Limit erreicht: max. ${maxStudents} aktive Teilnehmende. Bitte upgraden.`, {
        requestId,
      });
    }
  }

  // 5) Invites einfügen (idempotent, on conflict (class_id,email) do nothing).
  //    Nur NEU eingefügte Zeilen werden angemailt (Bestand behält seinen Token).
  const { data: inserted, error: insErr } = await svc
    .from("class_invites")
    .upsert(
      normalized.map((email) => ({
        class_id: classId,
        email,
        invited_by: ctx.user.id,
        status: "pending",
      })),
      { onConflict: "class_id,email", ignoreDuplicates: true }
    )
    .select("email, token");
  if (insErr) {
    log("class/invite.persist", { requestId, classId, ok: false, err: insErr.message });
    return apiError(500, "internal_error", "Einladungen konnten nicht gespeichert werden.", { requestId });
  }
  const newInvites = (inserted ?? []) as { email: string; token: string }[];

  // 6) Resend — best-effort je Adresse (ein Ausfall rollt den Invite nicht zurück;
  //    der Join-Code funktioniert unabhängig davon). Deutsche Vorlage, kein Freitext.
  //    ⚠️ OWNER-CONFIRM: Betreff/Text/Deep-Link-Schema final abstimmen.
  let sent = 0;
  for (const inv of newInvites) {
    try {
      const joinLink = `goetheb1://join?code=${encodeURIComponent(cls.join_code)}`;
      await getResend().emails.send({
        from: RESEND_FROM_HEADER,
        to: inv.email,
        subject: `Einladung zur Klasse „${cls.name}" – B1+Trainer`,
        html:
          `<p>Hallo,</p><p>du wurdest zur Klasse <strong>${escapeHtml(cls.name)}</strong> ` +
          `im B1+Trainer eingeladen.</p>` +
          `<p>Beitritts-Code: <strong>${escapeHtml(cls.join_code)}</strong></p>` +
          `<p>In der App öffnen: <a href="${joinLink}">${joinLink}</a></p>` +
          `<p>Alternativ den Code manuell unter „Klasse beitreten" eingeben.</p>`,
      });
      sent++;
    } catch (e) {
      log("class/invite.email", { requestId, ok: false, err: String(e) }); // NIE die Adresse loggen
    }
  }

  log("class/invite", { requestId, classId, invited: newInvites.length, sent });
  return ok({ invited: newInvites.length, sent }, requestId);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
