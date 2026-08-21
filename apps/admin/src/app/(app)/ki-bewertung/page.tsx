import { PageShell, PageHeader, NotAvailable } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <PageShell>
      <PageHeader eyebrow="KI-Bewertung" title="Modell-Aufsicht" />
      <NotAvailable
        title="Wird gerade gebaut"
        reason="Dieser Bereich der Konsole ist noch nicht verdrahtet."
      />
    </PageShell>
  );
}
