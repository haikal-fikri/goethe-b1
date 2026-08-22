import "server-only";
import { cache } from "react";
import type { Author, Doc, DocGroup, Post, Pricing, SiteSetting } from "@/payload-types";
import { getPayloadClient } from "./payload";

/**
 * ACHTUNG: Die Local API läuft standardmäßig mit `overrideAccess: true`, die
 * `access.read`-Regel der Collection greift hier also NICHT. Der Filter auf
 * veröffentlichte Beiträge muss deshalb in jeder Abfrage stehen — sonst tauchen
 * geplante Beiträge vorzeitig auf der Website auf.
 */
const publishedOnly = () => ({ publishedAt: { less_than_equal: new Date().toISOString() } });

/**
 * Hält den Build am Leben, wenn die Datenbank nicht erreichbar ist.
 *
 * Hintergrund: `npm run build` im Repo-Wurzelverzeichnis baut alle Apps. Ohne
 * diesen Fallback würde ein fehlendes DATABASE_URL den gesamten Monorepo-Build
 * kippen, obwohl die Marketing-Seiten gar keine Inhalte aus dem CMS brauchen.
 * Blog und Dokumentation sind dann leer — die Warnung im Log ist laut genug,
 * damit das niemand versehentlich ausliefert.
 */
/** Ohne diese beiden Variablen kann Payload gar nicht erst starten. */
const cmsConfigured = () => Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

async function safeQuery<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Ist das CMS konfiguriert, ist ein Fehler hier ein echter Ausfall —
    // dann MUSS der Build scheitern. Sonst ginge eine Seite mit leerem Blog
    // und leerer Dokumentation live, ohne dass es jemand merkt.
    if (cmsConfigured()) throw error;

    // Ohne Konfiguration (z. B. `npm run build` im Repo-Wurzelverzeichnis ohne
    // .env) bauen wenigstens die Marketing-Seiten durch.
    console.warn(
      `\n[website] Kein CMS konfiguriert — „${label}" wird übersprungen.\n` +
        `[website] Blog und Dokumentation bleiben LEER. Für einen vollständigen Build\n` +
        `[website] DATABASE_URL und PAYLOAD_SECRET setzen (siehe .env.example).\n`
    );
    return fallback;
  }
}

/* ── Globals ──────────────────────────────────────────────────── */

/** Standardwerte aus dem Design, falls das Global noch nie gespeichert wurde. */
const SITE_SETTINGS_FALLBACK = {
  id: 0,
  lernenUrl: "https://lernen.digi-s.institute",
  contactEmail: "hallo@digi-s.institute",
  privacyEmail: "datenschutz@digi-s.institute",
} as unknown as SiteSetting;

export const getSiteSettings = cache(async function getSiteSettings(): Promise<SiteSetting> {
  return safeQuery(
    "site-settings",
    async () => {
      const payload = await getPayloadClient();
      const settings = await payload.findGlobal({ slug: "site-settings", depth: 1 });
      return {
        ...settings,
        lernenUrl: settings.lernenUrl || SITE_SETTINGS_FALLBACK.lernenUrl,
        contactEmail: settings.contactEmail || SITE_SETTINGS_FALLBACK.contactEmail,
      };
    },
    SITE_SETTINGS_FALLBACK
  );
});

export const getPricing = cache(async function getPricing(): Promise<Pricing> {
  return safeQuery(
    "pricing",
    async () => {
      const payload = await getPayloadClient();
      return payload.findGlobal({ slug: "pricing", depth: 0 });
    },
    { id: 0, tiers: [] } as unknown as Pricing
  );
});

/* ── Blog ─────────────────────────────────────────────────────── */

export type PostWithAuthor = Omit<Post, "author"> & { author: Author };

function hasAuthor(post: Post): post is PostWithAuthor {
  return typeof post.author === "object" && post.author !== null;
}

export const getPosts = cache(async function getPosts(): Promise<PostWithAuthor[]> {
  return safeQuery(
    "posts",
    async () => {
      const payload = await getPayloadClient();
      const result = await payload.find({
        collection: "posts",
        where: publishedOnly(),
        sort: "-publishedAt",
        depth: 1,
        limit: 500,
        pagination: false,
      });
      return result.docs.filter(hasAuthor);
    },
    []
  );
});

/**
 * Der Aufmacher ist der als „featured" markierte Beitrag. Fehlt er (etwa weil
 * die Redaktion das Flag entfernt hat), rückt der neueste Beitrag nach, damit
 * die große Karte nie leer bleibt.
 */
export function splitFeatured(posts: PostWithAuthor[]) {
  const featured = posts.find((post) => post.featured) ?? posts[0] ?? null;
  const rest = featured ? posts.filter((post) => post.id !== featured.id) : posts;
  return { featured, rest };
}

export async function getPostBySlug(slug: string): Promise<PostWithAuthor | null> {
  return safeQuery(
    `posts/${slug}`,
    async () => {
      const payload = await getPayloadClient();
      const result = await payload.find({
        collection: "posts",
        where: { and: [{ slug: { equals: slug } }, publishedOnly()] },
        depth: 1,
        limit: 1,
        pagination: false,
      });
      const post = result.docs[0];
      return post && hasAuthor(post) ? post : null;
    },
    null
  );
}

/* ── Dokumentation ────────────────────────────────────────────── */

export type DocSummary = {
  id: number;
  title: string;
  slug: string;
  order: number;
  popular: boolean;
  popularOrder: number | null;
  groupLabel: string;
  groupSlug: string;
  href: string;
};

export type DocNavGroup = {
  id: number;
  label: string;
  slug: string;
  description: string | null;
  order: number;
  items: DocSummary[];
};

function groupSlugOf(doc: Doc): { slug: string; label: string; id: number } | null {
  const group = doc.group;
  if (typeof group !== "object" || group === null) return null;
  const typed = group as DocGroup;
  if (!typed.slug) return null;
  return { slug: typed.slug, label: typed.label, id: typed.id };
}

/**
 * Eine Abfrage für alles, was die Dokumentation braucht: Seitenleiste,
 * Kapitelkarten samt Artikelzahl, „Häufig gelesen" und Vor-/Zurück-Links.
 * Die Artikelzahl wird hier abgeleitet und nirgends gespeichert.
 */
export const getDocsNav = cache(async function getDocsNav(): Promise<DocNavGroup[]> {
  return safeQuery("docs-nav", async () => {
  const payload = await getPayloadClient();
  const [groups, docs] = await Promise.all([
    payload.find({ collection: "doc-groups", sort: "order", depth: 0, limit: 200, pagination: false }),
    payload.find({ collection: "docs", sort: "order", depth: 1, limit: 500, pagination: false }),
  ]);

  return groups.docs
    .filter((group): group is DocGroup & { slug: string } => Boolean(group.slug))
    .map((group) => ({
      id: group.id,
      label: group.label,
      slug: group.slug,
      description: group.description ?? null,
      order: group.order,
      items: docs.docs
        .filter((doc) => {
          const parent = groupSlugOf(doc);
          return parent?.id === group.id && Boolean(doc.slug);
        })
        .sort((a, b) => a.order - b.order)
        .map((doc) => ({
          id: doc.id,
          title: doc.title,
          slug: doc.slug as string,
          order: doc.order,
          popular: Boolean(doc.popular),
          popularOrder: doc.popularOrder ?? null,
          groupLabel: group.label,
          groupSlug: group.slug,
          href: `/dokumentation/${group.slug}/${doc.slug}`,
        })),
    }));
  }, []);
});

export function flattenDocs(nav: DocNavGroup[]): DocSummary[] {
  return nav.flatMap((group) => group.items);
}

/**
 * „Häufig gelesen" ist eine kuratierte Liste, keine abgeleitete: Die
 * Reihenfolge stammt aus `popularOrder`. Artikel ohne Angabe hängen sich
 * hinten an, in Kapitel-Reihenfolge.
 */
export function popularDocs(nav: DocNavGroup[]): DocSummary[] {
  return flattenDocs(nav)
    .filter((doc) => doc.popular)
    .sort((a, b) => (a.popularOrder ?? Number.MAX_SAFE_INTEGER) - (b.popularOrder ?? Number.MAX_SAFE_INTEGER));
}

export async function getDocByPath(groupSlug: string, docSlug: string): Promise<Doc | null> {
  return safeQuery(`docs/${groupSlug}/${docSlug}`, async () => {
  const payload = await getPayloadClient();
  const groups = await payload.find({
    collection: "doc-groups",
    where: { slug: { equals: groupSlug } },
    depth: 0,
    limit: 1,
    pagination: false,
  });
  const group = groups.docs[0];
  if (!group) return null;

  const docs = await payload.find({
    collection: "docs",
    where: { and: [{ slug: { equals: docSlug } }, { group: { equals: group.id } }] },
    depth: 1,
    limit: 1,
    pagination: false,
  });
  return docs.docs[0] ?? null;
  }, null);
}

/* ── Lexical-Hilfen ───────────────────────────────────────────── */

type LexicalNode = {
  type?: string;
  text?: string;
  children?: LexicalNode[];
  fields?: Record<string, unknown>;
};

/** Sammelt den reinen Text eines Lexical-Baums — für Suchindex und Meta-Beschreibung. */
export function lexicalToPlainText(value: unknown): string {
  const root = (value as { root?: LexicalNode } | null | undefined)?.root;
  if (!root) return "";
  const parts: string[] = [];

  const walk = (node: LexicalNode) => {
    if (typeof node.text === "string") parts.push(node.text);
    // Block-Inhalte (Zitat, Hinweis) stecken in `fields`, nicht in `children`.
    if (node.type === "block" && node.fields) {
      for (const key of ["quote", "content", "attribution"]) {
        const field = node.fields[key];
        if (typeof field === "string") parts.push(field);
      }
    }
    node.children?.forEach(walk);
  };
  walk(root);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function excerptFromText(text: string, max = 160): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : max).trimEnd()}…`;
}

/* ── Suchindex der Dokumentation ──────────────────────────────── */

export type DocSearchEntry = {
  title: string;
  group: string;
  href: string;
  text: string;
};

/**
 * Wird zur Build-Zeit erzeugt und als Prop an die Suche gereicht — die Suche
 * läuft vollständig im Browser, ohne Netzabfrage und ohne Drittanbieter.
 */
export async function getDocsSearchIndex(): Promise<DocSearchEntry[]> {
  return safeQuery("docs-search-index", async () => {
  const payload = await getPayloadClient();
  const docs = await payload.find({
    collection: "docs",
    sort: "order",
    depth: 1,
    limit: 500,
    pagination: false,
  });

  return docs.docs.flatMap((doc) => {
    const parent = groupSlugOf(doc);
    if (!parent || !doc.slug) return [];
    return [
      {
        title: doc.title,
        group: parent.label,
        href: `/dokumentation/${parent.slug}/${doc.slug}`,
        // Auf eine sinnvolle Länge gekürzt: Der Index wird ins HTML serialisiert.
        // Bewusst knapp: Der Index wird in die HTML-Antwort serialisiert.
        text: lexicalToPlainText(doc.body).slice(0, 600),
      },
    ];
  });
  }, []);
}
