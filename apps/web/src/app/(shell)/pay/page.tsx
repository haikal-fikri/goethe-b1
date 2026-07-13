import { PayForm } from "@/components/pay/PayForm";
import { Page, PageHeader } from "@/components/ui/Page";
import { Eyebrow, Num } from "@/components/ui/primitives";

export const metadata = {
  title: "Pay what you want · B1+Trainer",
};

export default async function PayPage({
  searchParams,
}: {
  // In Next.js 16 sind searchParams asynchron.
  searchParams: Promise<{ abgebrochen?: string }>;
}) {
  const { abgebrochen } = await searchParams;

  return (
    <Page>
      <PageHeader
        eyebrow="Digi.S — Digital Sprache Stiftung"
        title="Pay what you want"
        subtitle="B1+Trainer ist frei nutzbar — ohne Werbung. Du zahlst, was es dir wert ist. Dein Beitrag ist eine freiwillige Zahlung für die Nutzung (keine Spende im steuerlichen Sinne) und deckt die laufenden Kosten, die mit der Zahl der Lernenden mitwachsen: Hosting, Datenbank und vor allem die KI-gestützte Prüfungsbewertung."
      />

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {/* Kostenaufstellung (grobe Schätzung bei wachsender Nutzung) */}
        <section>
          <Eyebrow>Wofür du zahlst</Eyebrow>
          <p className="mt-2 text-xs text-faint">
            Kosten pro Monat, mittlerer Tarif, mit Wachstum eingeplant:
          </p>

          <dl className="mt-3 space-y-2 text-sm">
            <CostRow label="Hosting & Server" hint="Vercel Pro" value="$20" />
            <CostRow label="Datenbank" hint="Supabase (Postgres)" value="$25" />
            <CostRow
              label="KI-Bewertung"
              hint="Groq · ~20.000 Korrekturen"
              value="$80"
            />
            <CostRow label="Domain" hint="$30/Jahr" value="$2,50" />
            <div className="flex items-baseline justify-between border-t border-line pt-2 font-semibold text-ink">
              <span>Zusammen</span>
              <span>
                <Num>$127,50</Num> / Monat
              </span>
            </div>
          </dl>

          <p className="mt-3 text-xs leading-relaxed text-faint">
            Zur Einordnung: Eine KI-Korrektur (4-Augen-Bewertung) kostet rund{" "}
            <Num>$0,004</Num> — schon{" "}
            <strong className="text-muted">
              <Num>$5</Num>
            </strong>{" "}
            decken <Num>1.250</Num> bewertete Prüfungstexte. Die KI-Bewertung
            skaliert mit der Nutzung — hier gerechnet mit rund{" "}
            <Num>20.000</Num> Korrekturen im Monat.
          </p>
        </section>

        <PayForm canceled={abgebrochen === "1"} />
      </div>
    </Page>
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
      <dt className="text-muted">
        {label}
        <span className="ml-1.5 text-xs text-faint">· {hint}</span>
      </dt>
      <dd className="shrink-0 text-ink">
        <Num>{value}</Num>
      </dd>
    </div>
  );
}
