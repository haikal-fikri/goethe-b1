import { AppHeader } from "@/components/AppHeader";
import { ReferenceBrowser } from "@/components/nachschlagen/ReferenceBrowser";
import { getAllItems } from "@/lib/content";

export const metadata = {
  title: "Nachschlagen · B1-Trainer",
};

export default function NachschlagenPage() {
  const items = getAllItems();
  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            Redemittel nachschlagen
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Alle Wendungen mit Übersetzung — nach Prüfungsteil, Funktion und
            Niveau.
          </p>
        </div>
        <ReferenceBrowser items={items} />
      </main>
    </>
  );
}
