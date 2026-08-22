import type { Doc, SiteSetting } from "@/payload-types";
import type { PostWithAuthor } from "./queries";
import { absoluteUrl, SITE_NAME, siteUrl } from "./site";

export function organizationJsonLd(settings: Pick<SiteSetting, "contactEmail">) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    description: "Prüfungstraining Deutsch für Lernende und Lehrkräfte.",
    email: settings.contactEmail,
    address: { "@type": "PostalAddress", addressCountry: "DE" },
  };
}

export function articleJsonLd(post: PostWithAuthor, imageUrl?: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    inLanguage: "de-DE",
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Person", name: post.author.name, jobTitle: post.author.role ?? undefined },
    publisher: { "@type": "Organization", name: SITE_NAME, url: siteUrl },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    ...(imageUrl ? { image: imageUrl } : {}),
  };
}

export function techArticleJsonLd(doc: Doc, href: string, groupLabel: string) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.title,
    inLanguage: "de-DE",
    articleSection: groupLabel,
    dateModified: doc.updatedOn ?? doc.updatedAt,
    publisher: { "@type": "Organization", name: SITE_NAME, url: siteUrl },
    mainEntityOfPage: absoluteUrl(href),
    ...(doc.appliesTo ? { about: doc.appliesTo } : {}),
  };
}

/**
 * JSON für ein <script type="application/ld+json">-Element sicher machen.
 *
 * `JSON.stringify` maskiert `<` und `>` NICHT. Steht in einem Feld (Titel,
 * Teaser, Autorenname …) die Zeichenfolge `</script>`, beendet sie das Element
 * und alles Weitere wird als HTML geparst — eine Person mit Redaktionszugang
 * könnte so beliebiges JavaScript auf der öffentlichen Seite ausführen, im
 * selben Origin wie /admin.
 *
 * U+2028/U+2029 sind in JSON erlaubt, in JavaScript-Quelltext aber
 * Zeilentrenner und würden das eingebettete Literal zerbrechen.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // Als Zeichen geschrieben wären die beiden hier selbst Zeilentrenner und
    // würden dieses Literal zerreißen — deshalb als Escape-Sequenz.
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
