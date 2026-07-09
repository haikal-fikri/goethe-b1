export const runtime = "nodejs";

// STUB — teacher-lms/04 §3.1 — Whisper transcribe + AI recommend. Implementiert in Phase 3 (service-role route, teacher-lms/03/04/05).
export async function POST() {
  return Response.json(
    { error: { code: "not_implemented", message: "Noch nicht implementiert.", requestId: "" } },
    { status: 501, headers: { "cache-control": "no-store" } }
  );
}
