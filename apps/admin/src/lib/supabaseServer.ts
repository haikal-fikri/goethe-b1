// WICHTIG: `import "@/lib/ratelimit"` als Seiteneffekt zuerst — registriert die
// tc:*-Limiter (inkl. "preAuthIp"), die requireUser() erwartet, BEVOR eine Route
// requireUser aufruft. Danach re-export der kanonischen Auth-Primitiven.
import "@/lib/ratelimit";
export * from "@repo/server/supabaseServer";
