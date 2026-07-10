import "server-only";
import postgres from "postgres";

// Singleton über Hot-Reloads hinweg, damit im Dev nicht zu viele Verbindungen
// geöffnet werden. `prepare: false` ist sicher mit Supabase-Poolern.
const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

function init(): ReturnType<typeof postgres> {
  if (globalForDb.sql) return globalForDb.sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt.");
  const client = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
  // Immer cachen (auch in prod), damit derselbe Pool wiederverwendet wird.
  globalForDb.sql = client;
  return client;
}

// LAZY: Der Import darf NICHT werfen. `next build` lädt Route-Module beim
// „Collecting page data", ohne DATABASE_URL zu brauchen — die Verbindung (und ein
// evtl. Fehler bei fehlender URL) entsteht erst beim ERSTEN Query zur Laufzeit.
// Der Proxy erhält sowohl den Tagged-Template-Aufruf `sql\`…\`` (apply) als auch
// die Methoden `sql.begin`/`sql.unsafe`/… (get).
export const sql: ReturnType<typeof postgres> = new Proxy(
  function () {} as unknown as ReturnType<typeof postgres>,
  {
    apply(_target, _thisArg, args) {
      return (init() as unknown as (...a: unknown[]) => unknown)(...args);
    },
    get(_target, prop) {
      const client = init() as unknown as Record<string | symbol, unknown>;
      const value = client[prop];
      return typeof value === "function"
        ? (value as (...a: unknown[]) => unknown).bind(client)
        : value;
    },
  }
);
