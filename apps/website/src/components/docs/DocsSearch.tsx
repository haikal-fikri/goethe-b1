"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DocSearchEntry } from "@/lib/queries";
import { SearchIcon } from "../icons";

/**
 * Suche über die Dokumentation.
 *
 * Der Index entsteht beim Erzeugen der Seite und kommt als Prop mit — die Suche
 * läuft vollständig im Browser: keine Netzabfrage, kein Drittanbieter, keine
 * Cookies. ⌘K bzw. Strg+K springt ins Feld, Escape leert es.
 */
export function DocsSearch({ entries }: { entries: DocSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return entries
      .map((entry) => {
        const title = entry.title.toLowerCase();
        // Treffer im Titel wiegen schwerer als Treffer im Fließtext.
        const score = title.includes(needle)
          ? title.startsWith(needle)
            ? 3
            : 2
          : entry.text.toLowerCase().includes(needle) || entry.group.toLowerCase().includes(needle)
            ? 1
            : 0;
        return { entry, score };
      })
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((hit) => hit.entry);
  }, [entries, query]);

  const showResults = query.trim().length >= 2;

  return (
    <div style={{ position: "relative", maxWidth: 460, marginBottom: 34 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 46,
          padding: "0 14px",
          border: "1px solid var(--border-strong)",
          borderRadius: 15,
          background: "var(--surface-1)",
        }}
      >
        <span style={{ color: "var(--text-2)", display: "flex" }}>
          <SearchIcon />
        </span>
        <label htmlFor="docs-search" className="sr-only">
          Dokumentation durchsuchen
        </label>
        {/* Bewusst KEINE combobox/listbox-Rollen: Ein echtes Combobox-Muster
            verlangt aria-activedescendant und Pfeiltastensteuerung über die
            Optionen. Hier sind die Treffer schlichte Links — mit Tab erreichbar,
            von Screenreadern als Links angekündigt, und die Trefferzahl meldet
            die Live-Region darunter. */}
        <input
          id="docs-search"
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Dokumentation durchsuchen …"
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            fontSize: 14,
            color: "var(--text-hi)",
            minWidth: 0,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-2)",
            border: "1px solid var(--border-1)",
            borderRadius: 6,
            padding: "2px 6px",
          }}
        >
          ⌘K
        </span>
      </div>

      {showResults ? (
        <div
          id={listId}
          aria-label="Suchergebnisse"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 10,
            background: "var(--surface-1)",
            border: "1px solid var(--border-1)",
            borderRadius: 15,
            boxShadow: "var(--shadow-card-now)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {results.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: 0, padding: "12px 10px" }}>
              Keine Treffer für „{query.trim()}“.
            </p>
          ) : (
            results.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => setQuery("")}
                className="doc-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "9px 10px",
                  borderRadius: 9,
                  fontSize: 13.5,
                  color: "var(--text-hi)",
                }}
              >
                {entry.title}
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{entry.group}</span>
              </Link>
            ))
          )}
        </div>
      ) : null}

      {/* Meldet die Trefferzahl, ohne den Fokus zu verschieben. */}
      <p aria-live="polite" className="sr-only">
        {showResults
          ? results.length === 1
            ? "1 Treffer"
            : `${results.length} Treffer`
          : ""}
      </p>
    </div>
  );
}
