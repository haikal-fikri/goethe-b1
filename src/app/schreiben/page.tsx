import { AppHeader } from "@/components/AppHeader";
import { ExamRunner } from "@/components/schreiben/ExamRunner";
import { getSimulations } from "@/lib/exam";

export const metadata = {
  title: "Schreiben · KI-Prüfer · Redemittel-Trainer",
};

// Aufgaben werden zur Laufzeit aus der Datenbank gelesen.
export const dynamic = "force-dynamic";

export default async function SchreibenPage() {
  const simulations = await getSimulations();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            Schreiben · KI-Prüfer
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Wähle eine Simulation und Aufgabe, schreibe deinen Text und lass ihn
            nach den offiziellen Goethe-B1-Kriterien bewerten.
          </p>
        </div>
        {simulations.length > 0 ? (
          <ExamRunner simulations={simulations} />
        ) : (
          <div className="mx-auto max-w-3xl px-4 pt-6 text-sm text-[var(--fg-muted)]">
            Es sind noch keine Prüfungsaufgaben verfügbar.
          </div>
        )}
      </main>
    </>
  );
}
