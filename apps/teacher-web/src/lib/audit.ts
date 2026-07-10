import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";

// Append-only audit_log Schreiber (service-role). Metadaten-only — NIE Essay/
// Transkript/Audio/E-Mail/Token; `target` ist ein opakes `table:id`. Best-effort:
// ein Audit-Fehler darf die eigentliche Operation nicht zurückrollen. teacher-lms/03 §5.1.
export async function audit(
  svc: SupabaseClient,
  entry: {
    actor?: string | null;
    action: string; // z.B. 'entitlement.write' | 'role.grant' | 'audio.purge' | 'dpa.accept'
    target?: string | null;
    meta?: Record<string, unknown>;
  }
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
