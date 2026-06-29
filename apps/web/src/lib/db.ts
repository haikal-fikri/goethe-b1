import "server-only";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ist nicht gesetzt.");
}

// Singleton über Hot-Reloads hinweg, damit im Dev nicht zu viele
// Verbindungen geöffnet werden. `prepare: false` ist sicher mit Supabase-Poolern.
const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}
