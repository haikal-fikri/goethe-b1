import { ExamRunner } from "@/components/schreiben/ExamRunner";
import { getPublicSimulations } from "@/lib/exam";
import { Page, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/primitives";

export const metadata = {
  title: "Schreiben · KI-Prüfer · Satzwerk",
};

// Aufgaben werden zur Laufzeit aus der Datenbank gelesen.
export const dynamic = "force-dynamic";

export default async function SchreibenPage() {
  // Nur die öffentlichen Simulationen (Kostprobe) — weitere gibt es in der App.
  const simulations = await getPublicSimulations();

  return (
    <Page>
      <PageHeader
        eyebrow="Prüfungssimulation"
        title="Schreiben · KI-Prüfer"
        subtitle="Wähle eine Simulation und Aufgabe, schreibe deinen Text und lass ihn nach den offiziellen Goethe-B1-Kriterien bewerten."
      />
      {simulations.length > 0 ? (
        <ExamRunner simulations={simulations} />
      ) : (
        <Card
          radius={20}
          style={{ padding: "48px 32px", textAlign: "center", color: "var(--text-2)", fontSize: 14 }}
        >
          Es sind noch keine Prüfungsaufgaben verfügbar.
        </Card>
      )}
    </Page>
  );
}
