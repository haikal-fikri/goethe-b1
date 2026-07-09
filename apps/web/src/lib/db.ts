// Shim → @repo/server (extracted 2026-07; siehe teacher-lms Plan Phase 0a).
// Der Postgres-Singleton lebt jetzt kanonisch in @repo/server/db; dieser
// Re-Export hält `import { sql } from "@/lib/db"` unverändert lauffähig.
export * from "@repo/server/db";
