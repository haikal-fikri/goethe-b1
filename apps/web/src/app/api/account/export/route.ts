import { apiError } from "@repo/core";
import { requireUser, RateLimitError } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { log, newRequestId } from "@/lib/log";

export const runtime = "nodejs";

// DSAR-Export: aggregiert die eigenen Zeilen (RLS-own) inkl. answer_text UND der
// result-jsonb (kann den Aufsatz zitieren → als personenbezogen behandelt).
// Reauth ist client-seitig zu erzwingen; serverseitig genügt ein gültiger JWT
// + enge Ratenbegrenzung (2/Tag).
export async function GET(request: Request) {
  const requestId = newRequestId();
  let auth: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    auth = await requireUser(request);
  } catch (e) {
    if (e instanceof RateLimitError) return apiError(429, "rate_limited", "Zu viele Anfragen.", { requestId, retryAfter: e.retryAfterSec });
    throw e;
  }
  if (!auth) return apiError(401, "unauthorized", "Nicht autorisiert.", { requestId });

  const g = await enforce("acctExport", auth.user.id);
  if (!g.ok) return apiError(429, "rate_limited", "Zu viele Exporte. Bitte später erneut.", { requestId, retryAfter: g.retryAfterSec });

  const uid = auth.user.id;
  const [profile, attempts, progress, daily, results, drafts] = await Promise.all([
    auth.supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    auth.supabase.from("exercise_attempts").select("*").eq("user_id", uid),
    auth.supabase.from("exercise_progress").select("*").eq("user_id", uid),
    auth.supabase.from("daily_activity").select("*").eq("user_id", uid),
    auth.supabase.from("exam_results").select("*").eq("user_id", uid),
    auth.supabase.from("exam_drafts").select("*").eq("user_id", uid),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { id: uid, email: auth.user.email },
    profile: profile.data ?? null,
    exercise_attempts: attempts.data ?? [],
    exercise_progress: progress.data ?? [],
    daily_activity: daily.data ?? [],
    exam_results: results.data ?? [],
    exam_drafts: drafts.data ?? [],
  };

  log("account/export", { requestId, userId: uid, ok: true });
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="b1trainer-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
