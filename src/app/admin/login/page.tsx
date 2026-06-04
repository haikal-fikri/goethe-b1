import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { checkPassword, setAdminCookie } from "@/lib/adminAuth";

export const metadata = { title: "Admin · Login · B1-Trainer" };
export const dynamic = "force-dynamic";

async function loginAction(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) redirect("/admin/login?error=1");
  await setAdminCookie();
  redirect("/admin");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-sm px-4 pt-12">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            Admin-Login
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Geschützter Bereich zum Anlegen von Prüfungssimulationen.
          </p>
          <form action={loginAction} className="mt-5 flex flex-col gap-3">
            <input
              type="password"
              name="password"
              required
              autoFocus
              placeholder="Passwort"
              className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--border)]"
            />
            {error && (
              <p className="text-sm" style={{ color: "var(--bad)" }}>
                Falsches Passwort.
              </p>
            )}
            <button
              type="submit"
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ color: "var(--bg)", backgroundColor: "var(--fg)" }}
            >
              Anmelden
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
