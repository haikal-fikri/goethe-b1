import { AppHeader } from "@/components/AppHeader";
import { HomeBrowser } from "@/components/home/HomeBrowser";
import { getSkillGroups, getStats } from "@/lib/content";
import { getAllItems } from "@/lib/redemittel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const items = await getAllItems();
  const groups = getSkillGroups(items);
  const stats = getStats(items);

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 pt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            Redemittel üben
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Wähle einen Bereich und baue aus der Wortbank den richtigen deutschen
            Satz zur englischen Übersetzung. {stats.total} Wendungen von B1 bis
            C2.
          </p>
        </div>
        <HomeBrowser groups={groups} />
      </main>
    </>
  );
}
