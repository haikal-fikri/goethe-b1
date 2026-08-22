import {
  RichText as LexicalRichText,
  type JSXConvertersFunction,
} from "@payloadcms/richtext-lexical/react";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import { Callout } from "./Callout";
import { PullQuote } from "./PullQuote";

type BlockNode = {
  fields: {
    blockType: string;
    quote?: string;
    attribution?: string;
    variant?: "note" | "warning";
    content?: string;
  };
};

type HeadingNode = { tag?: string };

/**
 * Der Entwurf setzt Abschnittsüberschriften als h3, direkt unter der h1 der
 * Seite — für Screenreader eine übersprungene Ebene (h1 → h3) und damit ein
 * echter Mangel. Gerendert wird deshalb eine Stufe höher; das AUSSEHEN bleibt
 * unverändert, weil die Optik über die Klassen `h-sec`/`h-sub` kommt und nicht
 * über den Tag-Namen (siehe globals.css).
 */
const HEADING_MAP: Record<string, { tag: "h2" | "h3" | "h4"; className: string }> = {
  h1: { tag: "h2", className: "h-sec" },
  h2: { tag: "h2", className: "h-sec" },
  h3: { tag: "h2", className: "h-sec" },
  h4: { tag: "h3", className: "h-sub" },
  h5: { tag: "h4", className: "h-sub" },
  h6: { tag: "h4", className: "h-sub" },
};

/**
 * Die Standard-Konverter erzeugen p/ul/li/strong und inline `code` — genau die
 * Elemente, die `.lp-legal` in globals.css bereits gestaltet. Eigene
 * Darstellung brauchen nur die Überschriften (siehe oben) und die beiden
 * Payload-Blöcke.
 */
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  heading: ({ node, nodesToJSX }) => {
    const { tag: Tag, className } = HEADING_MAP[(node as HeadingNode).tag ?? "h3"] ?? HEADING_MAP.h3;
    return <Tag className={className}>{nodesToJSX({ nodes: node.children })}</Tag>;
  },
  blocks: {
    pullQuote: ({ node }: { node: BlockNode }) => (
      <PullQuote quote={node.fields.quote ?? ""} attribution={node.fields.attribution} />
    ),
    callout: ({ node }: { node: BlockNode }) => (
      <Callout variant={node.fields.variant ?? "note"} content={node.fields.content ?? ""} />
    ),
  },
});

export function RichText({ data }: { data: SerializedEditorState }) {
  return <LexicalRichText data={data} converters={converters} disableContainer />;
}
