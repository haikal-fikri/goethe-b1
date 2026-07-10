import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-Supabase-Client (anon key + Cookie-persistierte Session, RLS) für die
// Superadmin-Client-Components. Für client-direkte is_admin()-Oversight-Reads
// (lib/data/oversight) — NICHT für die /api/admin-Routen (die lesen den Bearer).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!URL || !ANON) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt.");
  }
  if (client) return client;
  client = createBrowserClient(URL, ANON);
  return client;
}
