import { apiError, orgInviteSchema } from "@repo/core";
import { requireTeacher, parseJson, ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { sql } from "@/lib/db";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import { getResend, RESEND_FROM_HEADER } from "@/lib/resend";
import { audit } from "@/lib/audit";

// POST /api/org/invite — Pro-Owner stellt Lehrer-Sitze bereit (die EINZIGE
// service-role-Aktion der Org-Fläche): org_invites einfügen + der Account die
// Rolle 'teacher' geben. Harter Sitz-Cap ≤20 (starter=0). teacher-lms/03 §2.11.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ctx = await requireTeacher(req, requestId);
  if (ctx instanceof Response) return ctx;

  const parsed = await parseJson(req, orgInviteSchema, requestId);
  if (parsed instanceof Response) return parsed;
  const { orgId, emails } = parsed;

  // 1) MUSS der Org-Owner sein.
  const { data: isOwner } = await ctx.supabase.rpc("is_org_owner", { _org: orgId });
  if (!isOwner) return apiError(403, "forbidden", "Nur der Organisations-Inhaber.", { requestId });

  const rl = await enforce("orgInvite", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Einladungen. Bitte später erneut.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }

  const svc = supabaseService();
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()))];

  // 2) Sitz-Cap (hart, FAIL-CLOSED): aktive Sitze + pending Org-Invites + neu ≤
  //    max_seats. JEDER RPC/Count-Fehler → 500 (nie fail-open): teacher_plan_of
  //    coalesct auf Erfolg immer zu 'starter', also ist plan==null NUR ein
  //    Transport-Fehler; plan_limits(NULL) fiele sonst durch den else-Zweig auf
  //    max_seats=20 → würde einen Starter-Owner fälschlich 20 Sitze gewähren lassen.
  const { data: plan, error: planErr } = await svc.rpc("teacher_plan_of", { p_teacher: ctx.user.id });
  if (planErr || !plan) {
    return apiError(500, "internal_error", "Plan konnte nicht bestimmt werden.", { requestId });
  }
  const { data: limitRows, error: limErr } = await svc.rpc("plan_limits", { p_plan: plan });
  const maxSeats = (limitRows?.[0] as { max_seats: number | null } | undefined)?.max_seats;
  if (limErr || maxSeats == null) {
    return apiError(500, "internal_error", "Sitz-Limit konnte nicht bestimmt werden.", { requestId });
  }
  const { count: activeSeats, error: acErr } = await svc
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "teacher")
    .eq("status", "active");
  const { count: pendingInvites, error: pendErr } = await svc
    .from("org_invites")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "pending");
  if (acErr || pendErr || activeSeats == null || pendingInvites == null) {
    return apiError(500, "internal_error", "Sitz-Zählung fehlgeschlagen.", { requestId });
  }
  if (activeSeats + pendingInvites + normalized.length > maxSeats) {
    return apiError(409, "conflict", `Sitz-Limit erreicht: max. ${maxSeats} Lehrer-Sitze.`, { requestId });
  }

  // 3) Invites einfügen (idempotent). org name für die Mail.
  const { data: org } = await svc
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle<{ name: string }>();
  const orgName = org?.name ?? "Organisation";

  const { data: inserted, error: insErr } = await svc
    .from("org_invites")
    .upsert(
      normalized.map((email) => ({
        org_id: orgId,
        email,
        invited_by: ctx.user.id,
        status: "pending",
      })),
      { onConflict: "org_id,email", ignoreDuplicates: true }
    )
    .select("email, token");
  if (insErr) {
    log("org/invite.persist", { requestId, orgId, ok: false, err: insErr.message });
    return apiError(500, "internal_error", "Einladungen konnten nicht gespeichert werden.", { requestId });
  }
  const newInvites = (inserted ?? []) as { email: string; token: string }[];

  // 4) Rolle 'teacher' gewähren, wenn der Account bereits existiert (nur student→teacher;
  //    admin/teacher nie überschreiben). Der Sitz-Account hat kein Polar-Abo → der
  //    Webhook feuert für ihn NIE; DIESE Route ist der einzige Rollen-Grant.
  //    Nicht-existierende Adressen: der Grant wird beim Signup nachgezogen (Phase-4-Auth-Hook).
  for (const inv of newInvites) {
    try {
      const rows = await sql<{ id: string }[]>`
        select id from auth.users where lower(email) = ${inv.email} limit 1
      `;
      const uid = rows[0]?.id;
      if (uid) {
        const { data: got } = await svc.auth.admin.getUserById(uid);
        const current = (got?.user?.app_metadata?.role as string | undefined) ?? "student";
        if (current === "student") {
          await svc.auth.admin.updateUserById(uid, { app_metadata: { role: "teacher" } });
          await audit(svc, {
            actor: ctx.user.id,
            action: "role.grant",
            target: `user:${uid}`,
            meta: { role: "teacher", via: "org_seat" },
          });
        }
      }
    } catch (e) {
      log("org/invite.role", { requestId, ok: false, err: String(e) }); // nie die Adresse loggen
    }
  }

  // 5) Resend — best-effort. ⚠️ OWNER-CONFIRM: Betreff/Text/Deep-Link final.
  let sent = 0;
  for (const inv of newInvites) {
    try {
      const acceptLink = `goetheb1://org-invite?token=${encodeURIComponent(inv.token)}`;
      await getResend().emails.send({
        from: RESEND_FROM_HEADER,
        to: inv.email,
        subject: `Lehrer-Sitz bei „${orgName}" – B1+Trainer`,
        html:
          `<p>Hallo,</p><p>du wurdest als Lehrkraft zur Organisation ` +
          `<strong>${escapeHtml(orgName)}</strong> im B1+Trainer eingeladen.</p>` +
          `<p>In der App annehmen: <a href="${acceptLink}">Einladung öffnen</a></p>`,
      });
      sent++;
    } catch (e) {
      log("org/invite.email", { requestId, ok: false, err: String(e) });
    }
  }

  log("org/invite", { requestId, orgId, invited: newInvites.length, sent });
  return ok({ invited: newInvites.length, sent }, requestId);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
