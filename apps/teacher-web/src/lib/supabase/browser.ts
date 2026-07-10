import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-Supabase-Client (anon key + Cookie-persistierte Session, RLS) für
// Client-Components. @supabase/ssr synchronisiert die Session über Cookies mit
// dem Server-Client (proxy.ts refresht sie). Für client-direkte RLS-Reads/Writes
// (lib/data/*) — NICHT für die /api-B-Routen (die lesen den Bearer, siehe api.ts).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Singleton-Browser-Client. Wirft, wenn Supabase (noch) nicht konfiguriert ist. */
export function supabaseBrowser(): SupabaseClient {
  if (!URL || !ANON) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt.");
  }
  if (client) return client;
  client = createBrowserClient(URL, ANON);
  return client;
}
