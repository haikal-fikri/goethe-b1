import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";

// Append-only audit_log (service-role). Nur Metadaten. teacher-lms/05 §4.2.
//
// ⚠️ Ein PostgREST-Aufruf LÖST AUF mit `{ data, error }` — er wirft nicht.
// Ein try/catch allein fängt daher nur Netzwerkfehler; jeder serverseitige
// Fehlschlag (veralteter Schema-Cache nach einer Migration, Spaltendrift, 4xx)
// liefe stumm durch. Deshalb wird `error` hier ausgewertet und das Ergebnis
// zurückgegeben — die Aufrufstelle entscheidet, ob sie damit weitermachen darf.
export async function audit(
  svc: SupabaseClient,
  entry: { actor?: string | null; action: string; target?: string | null; meta?: Record<string, unknown> }
): Promise<boolean> {
  try {
    const { error } = await svc.from("audit_log").insert({
      actor: entry.actor ?? null,
      action: entry.action,
      target: entry.target ?? null,
      meta: entry.meta ?? {},
    });
    if (error) {
      log("audit.write", { action: entry.action, ok: false, err: error.message });
      return false;
    }
    return true;
  } catch (e) {
    log("audit.write", { action: entry.action, ok: false, err: String(e) });
    return false;
  }
}
