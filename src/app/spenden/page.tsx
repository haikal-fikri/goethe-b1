import { AppHeader } from "@/components/AppHeader";
import { SpendenForm } from "@/components/spenden/SpendenForm";

export const metadata = {
  title: "Spenden · B1+Trainer",
};

export default async function SpendenPage({
  searchParams,
}: {
  // In Next.js 16 sind searchParams asynchron.
  searchParams: Promise<{ abgebrochen?: string }>;
}) {
  const { abgebrochen } = await searchParams;

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
            Unterstütze unsere Stiftung
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--fg)]">
            Digi.S — Digital Sprache Stiftung
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--fg-muted)]">
            Die Digi.S – Digital Sprache Stiftung macht digitales
            Sprachenlernen frei zugänglich. B1+Trainer ist eines ihrer
            Projekte: kostenlos und werbefrei — und soll es bleiben. Der Betrieb
            verursacht aber laufende Kosten, die mit der Zahl der Lernenden
            mitwachsen: Hosting, Datenbank und vor allem die KI-gestützte
            Prüfungsbewertung.
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start">
            {/* Kostenaufstellung (grobe Schätzung bei wachsender Nutzung) */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg)]">
                Wohin deine Spende fließt
              </h2>
              <p className="mt-1 text-xs text-[var(--fg-dim)]">
                Kosten pro Monat, mittlerer Tarif, mit Wachstum eingeplant:
              </p>

              <dl className="mt-3 space-y-2 text-sm">
                <CostRow
                  label="Hosting & Server"
                  hint="Vercel Pro"
                  value="$20"
                />
                <CostRow
                  label="Datenbank"
                  hint="Supabase (Postgres)"
                  value="$25"
                />
                <CostRow
                  label="KI-Bewertung"
                  hint="Groq · ~20.000 Korrekturen"
                  value="$80"
                />
                <CostRow
                  label="Domain"
                  hint="$30/Jahr"
                  value="$2,50"
                />
                <div className="flex items-baseline justify-between border-t border-[var(--border-soft)] pt-2 font-semibold text-[var(--fg)]">
                  <span>Zusammen</span>
                  <span>$127,50 / Monat</span>
                </div>
              </dl>

              <p className="mt-3 text-xs leading-relaxed text-[var(--fg-dim)]">
                Zur Einordnung: Eine KI-Korrektur (4-Augen-Bewertung) kostet rund
                $0,004 — schon <strong className="text-[var(--fg-muted)]">$5</strong>{" "}
                decken 1.250 bewertete Prüfungstexte. Die KI-Bewertung skaliert mit
                der Nutzung — hier gerechnet mit rund 20.000 Korrekturen im Monat.
              </p>
            </section>

            <SpendenForm canceled={abgebrochen === "1"} />
          </div>
        </div>
      </main>
    </>
  );
}

function CostRow({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--fg-muted)]">
        {label}
        <span className="ml-1.5 text-xs text-[var(--fg-dim)]">· {hint}</span>
      </dt>
      <dd className="shrink-0 tabular-nums text-[var(--fg)]">{value}</dd>
    </div>
  );
}
