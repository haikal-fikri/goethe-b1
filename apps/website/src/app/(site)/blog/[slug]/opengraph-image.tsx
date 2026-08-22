import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/queries";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * Vorschaubild je Artikel: dieselbe Karte wie global, aber mit dem Titel des
 * Beitrags. Rein typografisch — kein erfundenes Bildmotiv.
 *
 * Eigene Datei, weil die Artikelseite in `generateMetadata` ein eigenes
 * `openGraph`-Objekt setzt; Next ersetzt damit das geerbte, inklusive Bild.
 */
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ArticleOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? "Aus der Praxis der Prüfungsvorbereitung.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FDFBF6",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: "#1C8A5B",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 600,
            }}
          >
            DS
          </div>
          <div style={{ display: "flex", flexDirection: "column", color: "#211C17" }}>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 18, color: "#75695C", letterSpacing: 2 }}>
              {SITE_TAGLINE.toUpperCase()}
            </div>
          </div>
        </div>
        <div style={{ fontSize: title.length > 70 ? 48 : 58, lineHeight: 1.15, color: "#211C17", maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ fontSize: 24, color: "#75695C" }}>
          {post?.author?.name ? `${post.author.name} · ` : ""}
          {post?.readingTime ?? "Blog"}
        </div>
      </div>
    ),
    size
  );
}
