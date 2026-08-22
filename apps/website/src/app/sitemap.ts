import type { MetadataRoute } from "next";
import { flattenDocs, getDocsNav, getPosts } from "@/lib/queries";
import { absoluteUrl } from "@/lib/site";

/**
 * Zeitgesteuerte Veröffentlichung: Ohne diese Angabe würde die Seite genau
 * einmal beim Build erzeugt, und ein Beitrag mit Datum in der Zukunft käme nie
 * ans Licht — der Filter `publishedAt <= jetzt` friert auf den Build-Zeitpunkt
 * ein. Eine Stunde ist fein genug für ein Veröffentlichungsdatum und grob
 * genug, um die Datenbank nicht zu belasten. Redaktionelle Änderungen wirken
 * davon unabhängig sofort (afterChange-Hooks in src/lib/revalidate.ts).
 */
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "monthly" | "yearly" | "weekly" }[] = [
  { path: "/", priority: 1, changeFrequency: "monthly" },
  { path: "/loesungen", priority: 0.9, changeFrequency: "monthly" },
  { path: "/ueber-uns", priority: 0.6, changeFrequency: "yearly" },
  { path: "/kontakt", priority: 0.8, changeFrequency: "yearly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/dokumentation", priority: 0.7, changeFrequency: "weekly" },
  { path: "/datenschutz", priority: 0.3, changeFrequency: "yearly" },
  { path: "/agb", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookie-richtlinie", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, nav] = await Promise.all([getPosts(), getDocsNav()]);

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...posts
      .filter((post) => post.slug)
      .map((post) => ({
        url: absoluteUrl(`/blog/${post.slug}`),
        lastModified: new Date(post.updatedAt ?? post.publishedAt),
        changeFrequency: "yearly" as const,
        priority: 0.6,
      })),
    ...flattenDocs(nav).map((doc) => ({
      url: absoluteUrl(doc.href),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
