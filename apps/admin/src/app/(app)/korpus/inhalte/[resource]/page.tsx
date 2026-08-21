import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { resourceBySlug, listResourceRows } from "@/lib/korpus";
import { PageShell } from "@/components/ui/page";
import { IconChevronLeft } from "@/components/icons";
import { ResourceBrowser } from "@/components/korpus/ResourceBrowser";

export const dynamic = "force-dynamic";

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const cfg = resourceBySlug(resource);
  if (!cfg) notFound();

  const sb = await supabaseServer();
  const { rows, total } = await listResourceRows(sb, cfg);

  return (
    <PageShell style={{ paddingTop: 26 }}>
      <Link
        href="/korpus"
        className="hover-strong"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          color: "var(--text-2)",
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <IconChevronLeft size={15} strokeWidth={1.9} />
        Zurück zum Korpus
      </Link>

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 28,
          fontWeight: 600,
          color: "var(--text-hi)",
          margin: "0 0 6px",
        }}
      >
        {cfg.titel}
      </h1>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)", maxWidth: 720 }}>
        {cfg.beschreibung}
      </p>

      <ResourceBrowser cfg={cfg} rows={rows} total={total} />
    </PageShell>
  );
}
