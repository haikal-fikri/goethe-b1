import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Server-seitiger RLS-scoped Client, gebunden an die Session-Cookies der Anfrage
// (@supabase/ssr, Next 16). Nutzung: Server-Components (nur Lesen), Route-Handler
// + Server-Actions (Lesen + Schreiben). Ein NEUER Client pro Render/Request —
// niemals über Requests teilen.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function supabaseServer(): Promise<SupabaseClient> {
  if (!URL || !ANON) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt.");
  }
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Aus einem Server-Component-Render aufgerufen — Cookies sind dort
          // read-only. proxy.ts refresht die Session stattdessen. Ignorierbar.
        }
      },
    },
  });
}

/**
 * Verifizierter Nutzer (kontaktiert GoTrue → validiert Signatur/Revocation) oder
 * null. Für Autorisierungs-Entscheidungen — NICHT getSession() (ungeprüft).
 */
export async function getUser(): Promise<User | null> {
  if (!URL || !ANON) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.aud !== "authenticated") return null;
  return data.user;
}
