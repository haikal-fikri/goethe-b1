import { PageShell, PageHeader, NotAvailable, SectionCard } from "@/components/ui/page";
import { Pill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

// Die Comp entwirft hier eine Modell-Aufsicht: Ø-Abweichung KI zu Lehrkraft,
// Override-Rate, Confidence je Stichprobe, markierte Fälle, "KI-Note
// bestätigen" und "Als Trainingsfall markieren".
//
// Nichts davon ist gestützt. Was die DB hat: die KI-Entwürfe stehen in
// assignment_ai_recommendations / speaking_ai_recommendations — und diese
// beiden Tabellen haben BEWUSST KEINE Admin-Lesepolicy (0022), weil die
// Entwürfe lehrkraftgebunden sind. Eine Confidence wird nirgends gespeichert,
// eine Abweichung nirgends berechnet, ein Trainings-Flag existiert nicht.
//
// Deshalb: kein Screen mit erfundenen Prozentzahlen, sondern die Aussage,
// was fehlen würde. Die Aktionsknöpfe der Comp entfallen — sie waren auch
// dort nie verdrahtet.

export default function KiBewertungPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="KI-Bewertung"
        title="Modell-Aufsicht"
        right={<Pill tone="neutral">nicht erfasst</Pill>}
      />

      <SectionCard title="Warum hier nichts steht">
        <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.65, color: "var(--text-1)" }}>
          Eine Modell-Aufsicht bräuchte drei Dinge, die das System heute nicht speichert: die
          KI-Note <em>neben</em> der Lehrkraft-Note derselben Einreichung, ein Confidence-Maß je
          Bewertung und eine Markierung für Trainingsfälle.
        </p>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-1)" }}>
          Die KI-Entwürfe liegen in <code style={{ fontFamily: "var(--font-mono)" }}>assignment_ai_recommendations</code>{" "}
          und <code style={{ fontFamily: "var(--font-mono)" }}>speaking_ai_recommendations</code>. Beide haben
          absichtlich <strong>keine</strong> Admin-Lesepolicy: die Entwürfe gehören der bewertenden
          Lehrkraft, nicht der Plattform. Ein Aufsichts-Dashboard darüber wäre also zuerst eine
          Datenschutz-Entscheidung — und erst danach eine Frage der Oberfläche.
        </p>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <NotAvailable
          title="Abweichung KI ↔ Lehrkraft"
          reason="Die finale Note (assignment_grades.final) überschreibt den KI-Entwurf; beide werden nicht paarweise vorgehalten. Eine Abweichung ließe sich erst berechnen, wenn der Entwurf mitgespeichert und für die Aufsicht lesbar wäre."
        />
        <NotAvailable
          title="Confidence und markierte Fälle"
          reason="Das Bewertungsmodell liefert kein Confidence-Maß, und es gibt weder ein Markierungs- noch ein Trainingsfall-Feld. Die Werte der Comp (74 %, 14 % Override) sind Entwurfszahlen ohne Quelle."
        />
      </div>
    </PageShell>
  );
}
