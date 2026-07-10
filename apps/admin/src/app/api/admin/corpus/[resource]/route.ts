import { apiError } from "@repo/core";
import { requireAdmin, ok } from "@/lib/guard";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";

// POST/PATCH/DELETE /api/admin/corpus/:resource — auditierte Corpus-CRUD
// (service-role, zod je Ressource, advisory-lock-id für exam_simulations).
// teacher-lms/05 §4.2.
//
// STATUS Phase 3: Auth + Limiter sind verdrahtet; die eigentliche Content-CRUD ist
// bewusst DEFERRED — sie ist gekoppelt an (a) die admin-Redaktions-UI (Phase 5),
// (b) die noch offenen redemittel*-Schemas und (c) die Ablösung des Legacy-
// Passwort-`/admin` (05 §5.1, „im selben Release wie die Konsole"). Der Legacy-
// Pfad apps/web `/api/admin/simulations` bleibt bis dahin die Schreibfläche.
export const runtime = "nodejs";

async function guard(req: Request, requestId: string) {
  const ctx = await requireAdmin(req, requestId);
  if (ctx instanceof Response) return ctx;
  const rl = await enforce("corpusWrite", ctx.user.id);
  if (!rl.ok) {
    return apiError(429, "rate_limited", "Zu viele Änderungen. Bitte kurz warten.", {
      requestId,
      retryAfter: rl.retryAfterSec,
    });
  }
  return ctx;
}

async function handle(req: Request, params: Promise<{ resource: string }>) {
  const requestId = newRequestId();
  const ctx = await guard(req, requestId);
  if (ctx instanceof Response) return ctx;
  const { resource } = await params;
  log("admin/corpus", { requestId, resource, deferred: true });
  return apiError(501, "internal_error", "Corpus-Bearbeitung folgt mit der Admin-Konsole.", {
    requestId,
    details: { resource, phase: "5" },
  });
}

export function POST(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  return handle(req, params);
}
export function PATCH(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  return handle(req, params);
}
export function DELETE(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  return handle(req, params);
}
