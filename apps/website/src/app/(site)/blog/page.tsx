import type { Metadata } from "next";
import Link from "next/link";
import { ImageSlot } from "@/components/ImageSlot";
import { formatGermanDate } from "@/lib/dates";
import { getPosts, splitFeatured } from "@/lib/queries";
import { POST_CATEGORIES } from "@/collections/Posts";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Was wir mit Sprachschulen über KI-Feedback, Bewertungspraxis und Datenschutz lernen — plus Produkt-Updates aus dem Institut.",
  alternates: { canonical: "/blog" },
};

/**
 * Zeitgesteuerte Veröffentlichung: Ohne diese Angabe würde die Seite genau
 * einmal beim Build erzeugt, und ein Beitrag mit Datum in der Zukunft käme nie
 * ans Licht — der Filter `publishedAt <= jetzt` friert auf den Build-Zeitpunkt
 * ein. Eine Stunde ist fein genug für ein Veröffentlichungsdatum und grob
 * genug, um die Datenbank nicht zu belasten. Redaktionelle Änderungen wirken
 * davon unabhängig sofort (afterChange-Hooks in src/lib/revalidate.ts).
 */
export const revalidate = 3600;

const categoryLabel = (value: string) =>
  POST_CATEGORIES.find((entry) => entry.value === value)?.label ?? value;

export default async function BlogPage() {
  const posts = await getPosts();
  const { featured, rest } = splitFeatured(posts);

  return (
    <main>
      <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "76px 24px 34px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".13em",
            textTransform: "uppercase",
            color: "var(--text-2)",
            marginBottom: 14,
          }}
        >
          Blog
        </div>
        <h1
          className="lp-h1s"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 46,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: "0 0 18px",
            letterSpacing: "-.024em",
            lineHeight: 1.08,
            maxWidth: "24ch",
            textWrap: "balance",
          }}
        >
          Aus der Praxis der Prüfungsvorbereitung.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--text-1)", margin: 0, maxWidth: "58ch" }}>
          Was wir mit Sprachschulen über KI-Feedback, Bewertungspraxis und Datenschutz lernen — plus
          Produkt-Updates aus dem Institut.
        </p>
      </section>

      {featured ? (
        <section className="lp-sec-b" style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px 26px" }}>
          <div
            className="lp-feat lp-g2 card-clickable"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 24,
              boxShadow: "var(--shadow-card-now)",
              padding: 0,
              display: "grid",
              gridTemplateColumns: "1.05fr .95fr",
              gap: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "38px 40px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    background: "var(--gruen-tint)",
                    color: "var(--gruen)",
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  Aktuell
                </span>
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  {formatGermanDate(featured.publishedAt)}
                  {featured.readingTime ? ` · ${featured.readingTime}` : ""}
                </span>
              </div>
              <h2
                className="lp-h2s"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 30,
                  fontWeight: 600,
                  color: "var(--text-hi)",
                  margin: "0 0 14px",
                  letterSpacing: "-.018em",
                  lineHeight: 1.18,
                  textWrap: "balance",
                }}
              >
                <Link href={`/blog/${featured.slug}`} className="card-link" style={{ color: "inherit" }}>
                  {featured.title}
                </Link>
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-1)", margin: "0 0 22px", maxWidth: "50ch" }}>
                {featured.excerpt}
              </p>
              <span aria-hidden="true" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--gruen)" }}>
                Artikel lesen ›
              </span>
            </div>
            <div style={{ minHeight: 300, background: "var(--surface-alt)" }}>
              <ImageSlot
                slot="blog-featured"
                placeholder="Titelbild Blog-Aufmacher (ca. 1000 × 760)"
                media={featured.heroImage}
                sizes="(max-width: 1060px) 100vw, 540px"
                priority
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 24px 84px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".13em",
            textTransform: "uppercase",
            color: "var(--text-2)",
            marginBottom: 22,
          }}
        >
          Alle Beiträge
        </div>
        {rest.length === 0 ? (
          <p style={{ fontSize: 14.5, color: "var(--text-2)", margin: 0 }}>
            Hier erscheinen in Kürze weitere Beiträge.
          </p>
        ) : (
          <div className="lp-g3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
            {rest.map((post) => (
              <article
                key={post.id}
                className="hover-border card-clickable"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-1)",
                  borderRadius: 20,
                  padding: "26px 24px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
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
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                    · {formatGermanDate(post.publishedAt)}
                  </span>
                </div>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--text-hi)",
                    margin: "0 0 10px",
                    lineHeight: 1.25,
                    textWrap: "balance",
                  }}
                >
                  <Link href={`/blog/${post.slug}`} className="card-link" style={{ color: "inherit" }}>
                    {post.title}
                  </Link>
                </h2>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-1)", margin: "0 0 18px" }}>
                  {post.excerpt}
                </p>
                <div style={{ flex: 1 }} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-1)",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{post.readingTime}</span>
                  <span aria-hidden="true" style={{ fontSize: 13, fontWeight: 600, color: "var(--gruen)" }}>
                    Lesen ›
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
