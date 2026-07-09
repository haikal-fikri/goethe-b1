// Shim → @repo/server (extracted 2026-07; siehe teacher-lms Plan Phase 0a).
// WICHTIG: `import "@/lib/ratelimit"` als Seiteneffekt zuerst — es registriert
// die web-Limiter-Registry (inkl. "preAuthIp"), die requireUser() erwartet,
// BEVOR eine Route requireUser aufruft. Danach re-exportiert dieser Shim die
// kanonischen Auth-Primitiven aus @repo/server.
import "@/lib/ratelimit";
export * from "@repo/server/supabaseServer";
