import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * Standard-Vorschaubild fürs Teilen in sozialen Netzwerken.
 *
 * Bewusst rein typografisch auf der Papierfarbe des Design-Systems — kein
 * erfundenes Bildmotiv. Beiträge mit eigenem Titelbild überschreiben das über
 * `openGraph.images` in ihren Metadaten.
 */
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
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
        <div style={{ fontSize: 60, lineHeight: 1.15, color: "#211C17", maxWidth: 900 }}>
          KI-gestütztes Deutschlernen für Prüfungserfolg.
        </div>
        <div style={{ fontSize: 24, color: "#75695C" }}>
          Für Lernende und Lehrkräfte · DSGVO-konform
        </div>
      </div>
    ),
    size
  );
}
