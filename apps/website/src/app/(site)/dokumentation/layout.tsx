import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { getDocsNav } from "@/lib/queries";

/**
 * Rahmen der Dokumentation: dauerhafte Seitenleiste links, Inhalt rechts.
 * Ab 1060px abwärts wird daraus eine Spalte (siehe `.docs-shell` in globals.css).
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = await getDocsNav();

  return (
    <main>
      <div
        className="docs-shell lp-padx"
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "44px 24px 84px",
          display: "grid",
          gridTemplateColumns: "250px 1fr",
          gap: 44,
          alignItems: "start",
        }}
      >
        <DocsSidebar groups={groups} />
        <div className="docs-main" style={{ minWidth: 0 }}>
          {children}
        </div>
      </div>
    </main>
  );
}
