import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminShell, type ShellEnv } from "@/components/shell/AdminShell";

// Seiten-Gate der Konsole. OPTIMISTISCH (Cookie-Session) — jede /api/admin-Route
// re-verifiziert den Bearer-JWT unabhängig. Nicht-Admins landen auf
// /login?error=forbidden, Anonyme auf /login.

/** Zielumgebung fürs Topbar-Badge. Auf Vercel exakt (VERCEL_ENV), lokal
 *  bestenfalls geraten — DATABASE_URL kann trotzdem auf die Live-DB zeigen. */
function currentEnv(): ShellEnv {
  const v = process.env.VERCEL_ENV;
  if (v === "production" || v === "preview" || v === "development") return v;
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const email = user.email ?? "";
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const name = meta?.full_name ?? meta?.name ?? (email ? email.split("@")[0] : "Superadmin");

  return (
    <AdminShell user={{ name, email }} env={currentEnv()}>
      {children}
    </AdminShell>
  );
}
