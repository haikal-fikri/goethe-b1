import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SimulationForm } from "@/components/admin/SimulationForm";
import { clearAdminCookie, requireAdmin } from "@/lib/adminAuth";

export const metadata = { title: "Admin · Simulationen · B1-Trainer" };
export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await clearAdminCookie();
  redirect("/admin/login");
}

export default async function AdminPage() {
  await requireAdmin();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
                Neue Simulation
              </h1>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                Schreiben · eine Simulation mit drei Aufgaben anlegen.
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="shrink-0 rounded-full border border-[var(--border-soft)] px-3 py-1.5 text-xs text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
        <SimulationForm />
      </main>
    </>
  );
}
