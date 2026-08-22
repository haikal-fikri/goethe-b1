import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POST_CATEGORIES } from "@/collections/Posts";
import { ImageSlot } from "@/components/ImageSlot";
import { RichText } from "@/components/richtext/RichText";
import { formatGermanDate, isoDate } from "@/lib/dates";
import { articleJsonLd, jsonLdScript } from "@/lib/jsonld";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getPostBySlug, getPosts } from "@/lib/queries";

type Params = { params: Promise<{ slug: string }> };

/**
 * Zeitgesteuerte Veröffentlichung: Ohne diese Angabe würde die Seite genau
 * einmal beim Build erzeugt, und ein Beitrag mit Datum in der Zukunft käme nie
 * ans Licht — der Filter `publishedAt <= jetzt` friert auf den Build-Zeitpunkt
 * ein. Eine Stunde ist fein genug für ein Veröffentlichungsdatum und grob
 * genug, um die Datenbank nicht zu belasten. Redaktionelle Änderungen wirken
 * davon unabhängig sofort (afterChange-Hooks in src/lib/revalidate.ts).
 */
export const revalidate = 3600;

/** Neu veröffentlichte Beiträge sollen ohne Deploy erreichbar sein. */
export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.filter((post) => post.slug).map((post) => ({ slug: post.slug as string }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const image = typeof post.seo?.ogImage === "object" ? post.seo.ogImage : null;
  const hero = typeof post.heroImage === "object" ? post.heroImage : null;
  const ogUrl = image?.url ?? hero?.url ?? undefined;

  return {
    title: post.seo?.title || post.title,
    description: post.seo?.description || post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url: absoluteUrl(`/blog/${post.slug}`),
      siteName: SITE_NAME,
      locale: "de_DE",
      title: post.seo?.title || post.title,
      description: post.seo?.description || post.excerpt,
      publishedTime: isoDate(post.publishedAt),
      authors: [post.author.name],
      // Ohne eigenes Titelbild greift die Karte aus opengraph-image.tsx in
      // diesem Verzeichnis; deshalb hier kein Fallback setzen.
      ...(ogUrl ? { images: [{ url: ogUrl }] } : {}),
    },
  };
}

const categoryLabel = (value: string) =>
  POST_CATEGORIES.find((entry) => entry.value === value)?.label ?? value;

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const hero = typeof post.heroImage === "object" ? post.heroImage : null;

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd(post, hero?.url)) }}
      />
      <article className="lp-legal lp-sec" style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 84px" }}>
        <Link
          href="/blog"
          style={{
            display: "inline-block",
            marginBottom: 26,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-2)",
          }}
        >
          ‹ Zurück zum Blog
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--gruen)",
            }}
          >
            {categoryLabel(post.category)}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
            · <time dateTime={isoDate(post.publishedAt)}>{formatGermanDate(post.publishedAt)}</time>
            {post.readingTime ? ` · ${post.readingTime}` : ""}
          </span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 40,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: "0 0 22px",
            letterSpacing: "-.022em",
            lineHeight: 1.12,
            textWrap: "balance",
          }}
        >
          {post.title}
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 26,
            borderBottom: "1px solid var(--border-1)",
            marginBottom: 30,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 38,
              height: 38,
              flex: "0 0 38px",
              borderRadius: 999,
              background: "var(--gruen-tint)",
              color: "var(--gruen)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {post.author.initials}
          </span>
          <div style={{ lineHeight: 1.35 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>
              {post.author.name}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{post.author.role}</div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid var(--border-1)",
            height: 360,
            marginBottom: 32,
          }}
        >
          <ImageSlot
            slot="article-hero"
            placeholder="Artikelbild (ca. 1520 × 760)"
            media={post.heroImage}
            sizes="(max-width: 900px) 100vw, 800px"
            priority
          />
        </div>

        <p style={{ fontSize: 17, color: "var(--text-hi)", lineHeight: 1.75, margin: "0 0 14px", maxWidth: "70ch" }}>
          {post.lead}
        </p>

        <RichText data={post.body} />

        <div
          className="lp-g2f"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 44,
            paddingTop: 32,
            borderTop: "1px solid var(--border-1)",
          }}
        >
          <Link
            href="/dokumentation"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 18,
              padding: "22px 24px",
              color: "var(--text-hi)",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--text-2)",
                marginBottom: 8,
              }}
            >
              Weiterlesen
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--text-hi)" }}>
              So funktioniert die KI-Vorbewertung in der Dokumentation
            </div>
          </Link>
          <Link
            href="/kontakt"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 18,
              padding: "22px 24px",
              color: "var(--text-hi)",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--text-2)",
                marginBottom: 8,
              }}
            >
              Nächster Schritt
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "var(--text-hi)" }}>
              Demo mit Ihren eigenen Kursdaten buchen
            </div>
          </Link>
        </div>
      </article>
    </main>
  );
}
