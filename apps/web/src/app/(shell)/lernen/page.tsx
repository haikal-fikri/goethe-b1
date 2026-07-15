import { ReferenceBrowser } from "@/components/nachschlagen/ReferenceBrowser";
import { getAllItems } from "@/lib/redemittel";
import { Page, PageHeader } from "@/components/ui/Page";

export const metadata = {
  title: "Nachschlagen · Satzwerk",
};

export const dynamic = "force-dynamic";

export default async function NachschlagenPage() {
  const items = await getAllItems();
  return (
    <Page>
      <PageHeader
        eyebrow="Nachschlagewerk"
        title="Redemittel nachschlagen"
        subtitle="Alle Wendungen mit Übersetzung — nach Prüfungsteil, Funktion und Niveau."
      />
      <ReferenceBrowser items={items} />
    </Page>
  );
}
