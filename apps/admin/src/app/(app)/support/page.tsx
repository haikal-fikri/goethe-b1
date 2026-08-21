import { PageShell, PageHeader, NotAvailable, SectionCard } from "@/components/ui/page";
import { Pill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

// Die Comp zeigt eine Ticket-Warteschlange mit ID, Betreff, Organisation,
// Priorität, Alter, Zuständigkeit, SLA-Quote und Ø-Reaktionszeit.
//
// Es gibt kein Ticketsystem. Keine Tabelle, kein Postfach-Anschluss, keine
// SLA-Erfassung — auch in der Comp waren die Zeilen nicht verdrahtet.
// Support läuft heute per E-Mail außerhalb des Produkts.

export default function SupportPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Support"
        title="Ticket-Warteschlange"
        right={<Pill tone="neutral">kein Ticketsystem</Pill>}
      />

      <SectionCard title="Support läuft außerhalb des Systems">
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-1)" }}>
          Anfragen kommen per E-Mail und werden dort bearbeitet. Im Produkt existiert weder eine
          Ticket-Tabelle noch eine Zuständigkeits- oder Reaktionszeit-Erfassung. Eine Warteschlange
          hier wäre eine leere Hülle — sie würde vortäuschen, dass Anfragen im System nachgehalten
          werden.
        </p>
      </SectionCard>

      <NotAvailable
        title="Tickets, SLA und Reaktionszeiten"
        reason="Bräuchte eine Ticket-Tabelle (Betreff, Melder, Zuständigkeit, Status, Zeitstempel) und eine Anbindung an den Posteingang. Beides ist eine eigene Entscheidung — vorher lässt sich hier nichts Echtes zeigen."
        style={{ marginTop: 18 }}
      />
    </PageShell>
  );
}
