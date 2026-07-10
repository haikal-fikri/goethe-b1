import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser, supabaseServer } from "@/lib/supabase/server";

// Phase-4 Auth-Seam (Superadmin, role='admin'). Server-seitige Helfer über die
// @supabase/ssr-Session. Seiten-Gating ist OPTIMISTISCH — jede /api/admin-Route
// re-verifiziert den Bearer-JWT + hasRole('admin') unabhängig (proxy.ts ist
// KEINE Autz-Grenze). Die admin-Rolle vergibt /api/admin/grant-role bzw. ein
// Bootstrap-SQL-Update — nie der Login.

export { getUser, supabaseServer };

export function roleOf(u: User): string {
  return (u.app_metadata?.role as string | undefined) ?? "student";
}
export const isAdmin = (u: User) => roleOf(u) === "admin";

/** Server-Component-Guard: anonym → /login (mit ?next=). */
export async function requireAuth(next?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  return user;
}

/** Server-Component-Guard: admin-Rolle. Nicht-Admin → /login?error=forbidden. */
export async function requireAdmin(next?: string): Promise<User> {
  const user = await requireAuth(next);
  if (!isAdmin(user)) redirect("/login?error=forbidden");
  return user;
}
