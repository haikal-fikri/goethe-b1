import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export const metadata = {
  title: "Danke · B1+Trainer",
};

export default function DankePage() {
  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 pt-10">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            Vielen Dank für deinen Beitrag!
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--fg-muted)]">
            Dein Beitrag hilft, B1+Trainer frei nutzbar und werbefrei zu halten.
            Eine Zahlungsbestätigung erhältst du per E-Mail von Stripe.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl border border-[var(--border-soft)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--bg-elev)]"
          >
            Zurück zum Üben
          </Link>
        </div>
      </main>
    </>
  );
}
