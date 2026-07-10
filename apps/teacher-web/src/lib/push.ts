import "server-only";
import { supabaseService } from "@/lib/supabaseServer";
import { sendPush, type PushMessage } from "@/lib/expoPush";
import { log } from "@/lib/log";

// Best-effort Expo-Push an alle Tokens eines Users. Die notifications-Zeile (via
// notify()) ist die QUELLE DER WAHRHEIT — ein Push-Fehler (inkl. des Phase-6-Seams,
// der bis zur Verdrahtung wirft) darf die Route nie fehlschlagen lassen. 03 §2.2.
// Rückgabe: true, wenn versendet (oder nichts zu senden). false NUR bei einem
// echten Sende-Fehler (inkl. Phase-6-Seam, der noch wirft) → der push-flush-Cron
// stampt pushed_at dann NICHT und versucht es erneut.
export async function pushToUser(
  userId: string,
  msg: Omit<PushMessage, "to">
): Promise<boolean> {
  try {
    const svc = supabaseService();
    const { data, error } = await svc.from("push_tokens").select("token").eq("user_id", userId);
    // Ein SELECT-Fehler ist NICHT „keine Tokens": false zurückgeben, damit der
    // push-flush-Cron pushed_at NICHT stampt und es erneut versucht.
    if (error) {
      log("push.best-effort", { userId, ok: false, err: error.message });
      return false;
    }
    const tokens = (data ?? []).map((r) => (r as { token: string }).token);
    if (!tokens.length) return true; // wirklich keine Tokens → als erledigt behandeln
    await sendPush(tokens.map((t) => ({ to: t, ...msg })));
    return true;
  } catch (e) {
    log("push.best-effort", { userId, ok: false, err: String(e) });
    return false;
  }
}
