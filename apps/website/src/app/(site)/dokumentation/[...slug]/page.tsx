import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/richtext/RichText";
import { formatGermanDate } from "@/lib/dates";
import { jsonLdScript, techArticleJsonLd } from "@/lib/jsonld";
import {
  excerptFromText,
  flattenDocs,
  getDocByPath,
  getDocsNav,
  lexicalToPlainText,
} from "@/lib/queries";

type Params = { params: Promise<{ slug: string[] }> };

export const dynamicParams = true;

export async function generateStaticParams() {
  const nav = await getDocsNav();
  return flattenDocs(nav).map((doc) => ({ slug: [doc.groupSlug, doc.slug] }));
}

/** /dokumentation/<kapitel>/<artikel> — genau zwei Segmente. */
function parseSlug(slug: string[]): { groupSlug: string; docSlug: string } | null {
  if (slug.length !== 2) return null;
  return { groupSlug: slug[0], docSlug: slug[1] };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) return {};
  const doc = await getDocByPath(parsed.groupSlug, parsed.docSlug);
  if (!doc) return {};

  return {
    title: doc.seo?.title || doc.title,
    description: doc.seo?.description || excerptFromText(lexicalToPlainText(doc.body)),
    alternates: { canonical: `/dokumentation/${parsed.groupSlug}/${parsed.docSlug}` },
  };
}

export default async function DocPage({ params }: Params) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  const [doc, nav] = await Promise.all([
    getDocByPath(parsed.groupSlug, parsed.docSlug),
    getDocsNav(),
  ]);
  if (!doc) notFound();

  const href = `/dokumentation/${parsed.groupSlug}/${parsed.docSlug}`;
  const group = nav.find((entry) => entry.slug === parsed.groupSlug);
  // Vor/Zurück laufen über alle Kapitel hinweg, in Sortierreihenfolge.
  const all = flattenDocs(nav);
  const index = all.findIndex((entry) => entry.href === href);
  const previous = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(techArticleJsonLd(doc, href, group?.label ?? "Dokumentation")),
        }}
      />

      <nav
        aria-label="Brotkrumen"
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-2)", marginBottom: 18 }}
      >
        <Link href="/dokumentation" style={{ color: "var(--text-2)" }}>
          Dokumentation
        </Link>
        <span aria-hidden="true">/</span>
        <span>{group?.label ?? ""}</span>
      </nav>

      <div className="lp-legal">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 36,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: "0 0 12px",
            letterSpacing: "-.02em",
            lineHeight: 1.15,
          }}
        >
          {doc.title}
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 28 }}>
          {doc.updatedOn ? `Zuletzt aktualisiert am ${formatGermanDate(doc.updatedOn)}` : null}
          {doc.updatedOn && doc.appliesTo ? " · " : null}
          {doc.appliesTo ? `Gilt für ${doc.appliesTo}` : null}
        </p>

        <RichText data={doc.body} />
      </div>

      <div
        className="lp-g2f"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 36 }}
      >
        <Link
          href={previous?.href ?? "/dokumentation"}
          style={{
            border: "1px solid var(--border-1)",
            borderRadius: 16,
            padding: "18px 20px",
            color: "var(--text-hi)",
          }}
        >
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 6 }}>‹ Zurück</div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>
            {previous?.title ?? "Übersicht Dokumentation"}
          </div>
        </Link>
        {next ? (
          <Link
            href={next.href}
            style={{
              border: "1px solid var(--border-1)",
              borderRadius: 16,
              padding: "18px 20px",
              color: "var(--text-hi)",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 6 }}>Weiter ›</div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{next.title}</div>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </>
  );
}
