import { apiError } from "@repo/core";
import { ok } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { newRequestId, log } from "@/lib/log";
import { audit } from "@/lib/audit";
import { verifyPolarWebhook, mapPolarEvent } from "@/lib/polar";
import type { SupabaseClient } from "@supabase/supabase-js";

// POST /api/billing/webhook — Polar. Signatur auf dem ROHBODY prüfen → idempotent
// gegen billing_events(event_id) → Teacher NUR aus dem server-gestempelten
// supabase_user_id auflösen (NIE per E-Mail) → entitlements + Rolle. Kein Upstash
// (Signatur + Event-ID-Dedupe ist die Kontrolle). teacher-lms/05 §1.3.
//
// IDEMPOTENZ-ORDNUNG (fix nach Adversarial-Review): billing_events wird ERST NACH
// erfolgreicher Verarbeitung geschrieben. Scheitert die Verarbeitung (unbekannte
// product_id → mapPolarEvent wirft; transienter DB-Fehler), geben wir 500 OHNE
// Dedupe-Zeile zurück → Polars Retry desselben Events verarbeitet erneut, statt
// dauerhaft als „deduped" verschluckt zu werden. Die Verarbeitung ist idempotent
// (upsert entitlements; Rolle nur student→teacher), also ist at-least-once sicher.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = newRequestId();

  // 1) Rohbody + Signatur (Phase-6-Seam). Ungültig ⇒ 400, KEINE Aufzeichnung.
  const raw = await req.text();
  let ev;
  try {
    ev = verifyPolarWebhook(raw, req.headers);
  } catch (e) {
    log("billing/webhook.verify", { requestId, ok: false, err: String(e) });
    return apiError(400, "bad_request", "Ungültige Signatur.", { requestId });
  }

  const svc = supabaseService();

  // 2) Schneller Dedupe-Pfad: schon verarbeitet ⇒ 200 (idempotente Wiederholung).
  const { data: seen } = await svc
    .from("billing_events")
    .select("event_id")
    .eq("event_id", ev.id)
    .maybeSingle();
  if (seen) return ok({ deduped: true }, requestId);

  // 3) Abbildung — planForProduct wirft bei unbekannter product_id. NICHT
  //    aufzeichnen → Retry nach Env-Fix verarbeitet erneut.
  let patch;
  try {
    patch = mapPolarEvent(ev);
  } catch (e) {
    log("billing/webhook.map", { requestId, type: ev.type, ok: false, err: String(e) });
    return apiError(500, "internal_error", "Event konnte nicht abgebildet werden.", { requestId });
  }

  // 4) Uninteressanter Typ ⇒ terminal aufzeichnen + 200 (kein Retry-Sturm).
  if (!patch) {
    await recordEvent(svc, ev.id, ev.type, requestId);
    return ok({ ignored: true }, requestId);
  }

  // 5) Teacher NUR aus server-gestempeltem supabase_user_id (nie E-Mail-Map).
  const userId = ev.data.metadata?.supabase_user_id;
  if (typeof userId !== "string" || !userId) {
    await audit(svc, { action: "billing.orphan", meta: { event: ev.type } });
    await recordEvent(svc, ev.id, ev.type, requestId); // terminal: bestätigen, nichts gewähren
    return ok({ orphan: true }, requestId);
  }
  const { data: prof } = await svc.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!prof) {
    await audit(svc, { action: "billing.orphan", target: `user:${userId}`, meta: { event: ev.type } });
    await recordEvent(svc, ev.id, ev.type, requestId);
    return ok({ orphan: true }, requestId);
  }

  // 6) entitlements schreiben. active ⇒ upsert; sonst update-only. Fehler ⇒ 500
  //    OHNE Aufzeichnung → Polar-Retry verarbeitet erneut (idempotent).
  const nowIso = new Date().toISOString();
  if (patch.upsert) {
    const row: Record<string, unknown> = {
      user_id: userId,
      kind: "teacher_subscription",
      status: patch.status ?? "active",
      updated_at: nowIso,
    };
    if (patch.plan !== undefined) row.plan = patch.plan;
    if (patch.currentPeriodEnd !== undefined) row.current_period_end = patch.currentPeriodEnd;
    if (patch.polarSubscriptionId !== undefined) row.polar_subscription_id = patch.polarSubscriptionId;
    if (patch.polarCustomerId !== undefined) row.polar_customer_id = patch.polarCustomerId;
    if (patch.productId !== undefined) row.product_id = patch.productId;
    const { error } = await svc.from("entitlements").upsert(row, { onConflict: "user_id,kind" });
    if (error) {
      log("billing/webhook.entitlement", { requestId, ok: false, err: error.message });
      return apiError(500, "internal_error", "Entitlement-Write fehlgeschlagen.", { requestId });
    }
  } else {
    const upd: Record<string, unknown> = { updated_at: nowIso };
    if (patch.status !== undefined) upd.status = patch.status;
    if (patch.plan !== undefined) upd.plan = patch.plan;
    if (patch.currentPeriodEnd !== undefined) upd.current_period_end = patch.currentPeriodEnd;
    if (patch.polarSubscriptionId !== undefined) upd.polar_subscription_id = patch.polarSubscriptionId;
    const { error } = await svc
      .from("entitlements")
      .update(upd)
      .eq("user_id", userId)
      .eq("kind", "teacher_subscription");
    if (error) {
      log("billing/webhook.entitlement", { requestId, ok: false, err: error.message });
      return apiError(500, "internal_error", "Entitlement-Write fehlgeschlagen.", { requestId });
    }
  }
  await audit(svc, {
    actor: userId,
    action: "entitlement.write",
    target: `user:${userId}`,
    meta: { event: ev.type, plan: patch.plan },
  });

  // 7) Rolle 'teacher' NUR beim ersten 'active' und nur, wenn noch student
  //    (admin/teacher wird NIE überschrieben). Best-effort — der Grant zieht beim
  //    nächsten 'active' nach, falls die Auth-Admin-API kurz ausfällt.
  if (patch.grantTeacherRole) {
    try {
      const { data: got } = await svc.auth.admin.getUserById(userId);
      const current = (got?.user?.app_metadata?.role as string | undefined) ?? "student";
      if (current === "student") {
        await svc.auth.admin.updateUserById(userId, { app_metadata: { role: "teacher" } });
        await audit(svc, {
          actor: userId,
          action: "role.grant",
          target: `user:${userId}`,
          meta: { role: "teacher", via: "polar" },
        });
      }
    } catch (e) {
      log("billing/webhook.role", { requestId, ok: false, err: String(e) });
    }
  }

  // 8) ERST JETZT aufzeichnen (nach erfolgreicher Verarbeitung).
  await recordEvent(svc, ev.id, ev.type, requestId);
  log("billing/webhook", { requestId, type: ev.type, ok: true });
  return ok({ received: true }, requestId);
}

// on-conflict-do-nothing: gleichzeitige Zustellungen desselben Events kollidieren
// nicht. Ein Aufzeichnungsfehler NACH erfolgreicher Verarbeitung ist nicht fatal
// (eine spätere Doppel-Zustellung verarbeitet idempotent neu).
async function recordEvent(
  svc: SupabaseClient,
  eventId: string,
  eventType: string,
  requestId: string
): Promise<void> {
  const { error } = await svc
    .from("billing_events")
    .upsert({ event_id: eventId, event_type: eventType }, { onConflict: "event_id", ignoreDuplicates: true });
  if (error) log("billing/webhook.record", { requestId, ok: false, err: error.message });
}
