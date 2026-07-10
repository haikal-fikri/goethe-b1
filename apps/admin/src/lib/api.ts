"use client";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Client-Helfer: ruft eine Vercel-C-/api/admin-Route mit dem aktuellen
// Access-Token als `Authorization: Bearer …` auf (die Routen verifizieren den
// Bearer-JWT via requireUser + hasRole('admin')). Bei 401 einmal refreshen.

export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = supabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(input, { ...init, headers });
  if (res.status === 401 && token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const fresh = refreshed.session?.access_token;
    if (fresh && fresh !== token) {
      headers.set("Authorization", `Bearer ${fresh}`);
      res = await fetch(input, { ...init, headers });
    }
  }
  return res;
}
