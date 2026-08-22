import Image from "next/image";
import type { CSSProperties } from "react";
import type { Media } from "@/payload-types";

type Props = {
  /** Die id aus dem Design, z. B. „hero-lms". Wird als data-image-slot ausgegeben. */
  slot: string;
  /** Deutsche Beschreibung des erwarteten Bildes — sichtbar, solange keines da ist. */
  placeholder: string;
  media?: Media | number | null;
  /** Für next/image: welche Breite das Bild im Layout einnimmt. */
  sizes?: string;
  priority?: boolean;
};

/**
 * Ein Bildplatz aus dem Design.
 *
 * Der umgebende Container (Rahmen, Radius, Höhe/Seitenverhältnis) kommt aus der
 * jeweiligen Seite — exakt wie im Design. Diese Komponente füllt ihn: entweder
 * mit dem hochgeladenen Bild oder mit einem beschrifteten Platzhalter. Das
 * Layout steht dadurch in beiden Fällen identisch; es entsteht nie ein Loch
 * oder ein Sprung.
 *
 * Bitte keine generierten, illustrierten oder Stock-Bilder einsetzen — leer und
 * richtig bemessen ist besser als gefüllt und falsch.
 */
export function ImageSlot({ slot, placeholder, media, sizes = "100vw", priority }: Props) {
  const image = typeof media === "object" && media !== null ? media : null;

  return (
    <div
      data-image-slot={slot}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "var(--surface-alt)",
        overflow: "hidden",
      }}
    >
      {image?.url ? (
        <Image
          src={image.url}
          alt={image.alt ?? ""}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: "cover" }}
          {...(image.blurDataURL
            ? { placeholder: "blur" as const, blurDataURL: image.blurDataURL }
            : {})}
        />
      ) : (
        <span
          aria-hidden="true"
          style={placeholderStyle}
        >
          {placeholder}
        </span>
      )}
    </div>
  );
}

const placeholderStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "16px 18px",
  margin: 10,
  border: "1px dashed var(--border-strong)",
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--text-2)",
  textWrap: "balance",
};
