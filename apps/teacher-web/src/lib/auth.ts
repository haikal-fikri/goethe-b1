import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser, supabaseServer } from "@/lib/supabase/server";

// Phase-4 Auth-Seam (teacher-lms/01 §4, Q4): server-seitige Helfer über die
// @supabase/ssr-Session. Der Browser-Client + Bearer-Fetch liegen in
// lib/supabase/browser.ts + lib/api.ts (client-only).
//
// WICHTIG: Seiten-Gating ist OPTIMISTISCH (Next-16-Proxy ist KEINE Autz-Grenze,
// siehe proxy.ts). Jede /api-B-Route re-verifiziert den Bearer-JWT unabhängig
// (requireUser + hasRole). Diese Guards sind nur fürs Seiten-Routing.

export { getUser, supabaseServer };

export function roleOf(u: User): string {
  return (u.app_metadata?.role as string | undefined) ?? "student";
}
export const isTeacher = (u: User) => roleOf(u) === "teacher";
export const isAdmin = (u: User) => roleOf(u) === "admin";

/** Server-Component-Guard: anonym → /login (mit ?next=). Gibt den Nutzer zurück. */
export async function requireAuth(next?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return user;
}
