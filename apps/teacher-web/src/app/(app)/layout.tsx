import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAuth, isTeacher, isAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { classesData, notificationsData } from "@/lib/data";
import { AppShell, type ShellClass } from "@/components/shell/AppShell";

// Authentifizierte Portal-Hülle. Server-Component: lädt die Klassen der Lehrkraft
// (+ Mitgliederzahlen), den Abo-Plan und die Zahl ungelesener Benachrichtigungen
// über den RLS-scoped SSR-Client und übergibt sie an die (Client-)Shell.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth("/dashboard");
  // Rollen-Gate: nur Lehrkräfte/Admins erreichen die Portal-Hülle. Angemeldete
  // Konten ohne Rolle (frisch registriert, kein Abo) → Onboarding-Schleuse.
  // (Reine Routing-Absicherung; jede /api-Route re-verifiziert die Rolle selbst,
  // und RLS scoped alle Reads ohnehin auf die eigene uid.)
  if (!isTeacher(user) && !isAdmin(user)) redirect("/willkommen");
  const sb = await supabaseServer();

  const { data: classRows } = await classesData.listClasses(sb);
  const classes = (classRows ?? []) as Array<{ id: string; name: string; org_id: string | null }>;
  const ids = classes.map((c) => c.id);

  // Mitgliederzahlen (aktive Einschreibungen) in EINER Query, dann tallyen.
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: enr } = await sb
      .from("class_enrollments")
      .select("class_id")
      .in("class_id", ids)
      .eq("status", "active");
    for (const e of (enr ?? []) as Array<{ class_id: string }>) {
      counts[e.class_id] = (counts[e.class_id] ?? 0) + 1;
    }
  }

  // Abo-Plan (Starter als Default, wenn kein aktives Entitlement existiert).
  const { data: ent } = await sb
    .from("entitlements")
    .select("plan")
    .eq("kind", "teacher_subscription")
    .eq("status", "active")
    .maybeSingle();
  const plan: "starter" | "pro" = (ent?.plan as "starter" | "pro" | undefined) ?? "starter";

  const { count: unread } = await notificationsData.countUnread(sb);

  const shellClasses: ShellClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    members: counts[c.id] ?? 0,
  }));
  const studentsUsed = shellClasses.reduce((s, c) => s + c.members, 0);

  const meta = user.user_metadata ?? {};
  const name =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Lehrkraft";

  return (
    <AppShell
      user={{ name, email: user.email ?? "" }}
      classes={shellClasses}
      plan={plan}
      classesUsed={shellClasses.length}
      studentsUsed={studentsUsed}
      unread={unread ?? 0}
    >
      {children}
    </AppShell>
  );
}
