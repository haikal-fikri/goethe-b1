import { ZodError } from "zod";
import { apiError } from "@repo/core";
import { requireAdmin, ok } from "@/lib/guard";
import { enforce } from "@/lib/ratelimit";
import { newRequestId, log } from "@/lib/log";
import {
  createCorpus,
  updateCorpus,
  deleteCorpus,
  isCorpusResource,
  CorpusError,
  type CorpusResource,
} from "@/lib/corpus";

// POST/PATCH/DELETE /api/admin/corpus/:resource — auditierte Corpus-CRUD
// (service-role via DATABASE_URL, zod je Ressource, advisory-lock-ID für
// exam_simulations). teacher-lms/05 §4.2 / §4.3.
//
// Die Inhaltstabellen behalten dauerhaft „public read + kein Client-Write" —
// jede Mutation läuft durch diese Route, damit sie validiert UND im audit_log
// nachvollziehbar ist. Die Audit-Zeile entsteht in derselben Transaktion wie
// die Mutation (siehe lib/corpus.ts).
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

type Verb = "create" | "update" | "delete";

async function handle(req: Request, params: Promise<{ resource: string }>, verb: Verb) {
  const requestId = newRequestId();
  const ctx = await guard(req, requestId);
  if (ctx instanceof Response) return ctx;

  const { resource } = await params;
  if (!isCorpusResource(resource)) {
    return apiError(404, "not_found", "Unbekannte Ressource.", { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "bad_request", "Ungültige Anfrage.", { requestId });
  }

  try {
    const result = await run(verb, resource, body, ctx.user.id);
    log("admin/corpus", { requestId, resource, verb, id: result.id, ok: true });
    return ok(result, requestId, verb === "create" ? 201 : 200);
  } catch (e) {
    if (e instanceof ZodError) {
      log("admin/corpus", { requestId, resource, verb, ok: false, err: "validation" });
      // Feldnamen/Validierungsstruktur nur außerhalb der Produktion preisgeben.
      return apiError(422, "validation_failed", "Ungültige Eingabe.", {
        requestId,
        ...(process.env.NODE_ENV !== "production" ? { details: e.flatten() } : {}),
      });
    }
    if (e instanceof CorpusError) {
      log("admin/corpus", { requestId, resource, verb, ok: false, err: e.code });
      return apiError(e.status, e.code, e.message, { requestId });
    }
    // Constraint-Verletzungen (Fremdschlüssel, doppelter PK) landen hier —
    // als Konflikt melden statt als Serverfehler, sonst sieht die Redaktion
    // nur ein generisches Scheitern.
    const pgCode = (e as { code?: string } | null)?.code;
    if (pgCode === "23505" || pgCode === "23503" || pgCode === "23514") {
      log("admin/corpus", { requestId, resource, verb, ok: false, err: pgCode });
      return apiError(
        409,
        "conflict",
        pgCode === "23505"
          ? "Ein Eintrag mit diesem Schlüssel existiert bereits."
          : pgCode === "23503"
            ? "Verwiesener Eintrag existiert nicht (Fremdschlüssel)."
            : "Eingabe verletzt eine Datenbank-Bedingung.",
        { requestId }
      );
    }
    log("admin/corpus", {
      requestId,
      resource,
      verb,
      ok: false,
      err: e instanceof Error ? e.message : "unknown",
    });
    return apiError(500, "internal_error", "Speichern fehlgeschlagen.", { requestId });
  }
}

function run(verb: Verb, resource: CorpusResource, body: unknown, actor: string) {
  if (verb === "create") return createCorpus(resource, body, actor);
  if (verb === "update") return updateCorpus(resource, body, actor);
  return deleteCorpus(resource, body, actor);
}

export function POST(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  return handle(req, params, "create");
}
export function PATCH(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  return handle(req, params, "update");
}
export function DELETE(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  return handle(req, params, "delete");
}
