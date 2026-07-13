import { HomeBrowser } from "@/components/home/HomeBrowser";
import { getSkillGroups, getStats } from "@repo/core";
import { getAllItems } from "@/lib/redemittel";
import { Page, PageHeader } from "@/components/ui/Page";
import { Num } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const items = await getAllItems();
  const groups = getSkillGroups(items);
  const stats = getStats(items);

  return (
    <Page>
      <PageHeader
        eyebrow="Wortbank & Lückentext"
        title="Redemittel üben"
        subtitle={
          <>
            Wähle einen Bereich und baue aus der Wortbank den richtigen deutschen
            Satz zur englischen Übersetzung. <Num>{stats.total}</Num> Wendungen
            von B1 bis C2.
          </>
        }
      />
      <HomeBrowser groups={groups} />
    </Page>
  );
}
