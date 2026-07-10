import "server-only";

// Geteilte postgres.js-Instanz (@repo/server, Singleton über Hot-Reloads).
// Nur für CORPUS-READS (getExamTask, ./exam.ts) — dieselben exam_tasks wie
// apps/web. Autoritative Writes (Noten/Entitlements/Invites/notify) laufen NIE
// über sql, sondern über supabaseService() (supabase-js, RLS-Bypass) je Route.
export { sql } from "@repo/server/db";
