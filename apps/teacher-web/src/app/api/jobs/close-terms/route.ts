export const runtime = "nodejs";

// STUB — teacher-lms/03 §2.9 — nightly term-close (D13). Implementiert in Phase 3 (service-role route, teacher-lms/03/04/05).
export async function POST() {
  return Response.json(
    { error: { code: "not_implemented", message: "Noch nicht implementiert.", requestId: "" } },
    { status: 501, headers: { "cache-control": "no-store" } }
  );
}
