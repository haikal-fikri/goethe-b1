import { AppHeader } from "@/components/AppHeader";
import { SchreibenPractice } from "@/components/schreiben/SchreibenPractice";
import { getAllItems } from "@/lib/content";

export const metadata = {
  title: "Schreiben · Redemittel-Trainer",
};

export default function SchreibenPage() {
  const items = getAllItems().filter((i) => i.skill === "schreiben");
  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            Freies Schreiben
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Übe einen kurzen Text und baue die vorgeschlagenen Redemittel ein.
          </p>
        </div>
        <SchreibenPractice items={items} />
      </main>
    </>
  );
}
