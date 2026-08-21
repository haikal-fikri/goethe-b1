import { PageShell, PageHeader, NotAvailable } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <PageShell>
      <PageHeader eyebrow="Prüfungs-Korpus" title="Exam-Inhalte" />
      <NotAvailable
        title="Wird gerade gebaut"
        reason="Dieser Bereich der Konsole ist noch nicht verdrahtet."
      />
    </PageShell>
  );
}
