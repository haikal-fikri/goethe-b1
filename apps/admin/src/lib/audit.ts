import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";

// Append-only audit_log (service-role). Metadaten-only. Best-effort. teacher-lms/05 §4.2.
export async function audit(
  svc: SupabaseClient,
  entry: { actor?: string | null; action: string; target?: string | null; meta?: Record<string, unknown> }
): Promise<void> {
  try {
    await svc.from("audit_log").insert({
      actor: entry.actor ?? null,
      action: entry.action,
      target: entry.target ?? null,
      meta: entry.meta ?? {},
    });
  } catch (e) {
    log("audit.write", { action: entry.action, ok: false, err: String(e) });
  }
}
