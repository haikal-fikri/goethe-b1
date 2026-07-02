import { resetProgressSchema, apiError } from "@repo/core";
import { requireUser, RateLimitError } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { sql } from "@/lib/db";
import { log, newRequestId } from "@/lib/log";

export const runtime = "nodejs";

// Löscht die Übungs-Fortschrittszeilen des Aufrufers. exam_results bleibt per
// Default erhalten (Notenverlauf); optional {includeExamHistory:true} löscht auch das.
// user_id kommt IMMER aus dem JWT, nie aus dem Body.
export async function POST(request: Request) {
  const requestId = newRequestId();
  let auth: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    auth = await requireUser(request);
  } catch (e) {
    if (e instanceof RateLimitError) return apiError(429, "rate_limited", "Zu viele Anfragen.", { requestId, retryAfter: e.retryAfterSec });
    throw e;
  }
  if (!auth) return apiError(401, "unauthorized", "Nicht autorisiert.", { requestId });

  const g = await enforce("resetProgress", auth.user.id);
  if (!g.ok) return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte später erneut.", { requestId, retryAfter: g.retryAfterSec });

  let includeExamHistory = false;
  try {
    const parsed = resetProgressSchema.safeParse((await request.json()) ?? {});
    if (parsed.success) includeExamHistory = parsed.data.includeExamHistory;
  } catch {
    /* leerer Body ist ok → Default false */
  }

  const uid = auth.user.id;
  await sql.begin(async (tx) => {
    await tx`delete from exercise_attempts where user_id = ${uid}`;
    await tx`delete from exercise_progress where user_id = ${uid}`;
    await tx`delete from daily_activity    where user_id = ${uid}`;
    if (includeExamHistory) await tx`delete from exam_results where user_id = ${uid}`;
  });

  log("profile/reset-progress", { requestId, userId: uid, includeExamHistory });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
