export const runtime = "nodejs";

// STUB — teacher-lms/05 §4.2 — audited corpus CRUD (zod + audit_log + advisory-lock id). Implementiert in Phase 3 (service-role route, teacher-lms/05).
export async function POST() {
  return Response.json(
    { error: { code: "not_implemented", message: "Noch nicht implementiert.", requestId: "" } },
    { status: 501, headers: { "cache-control": "no-store" } }
  );
}
