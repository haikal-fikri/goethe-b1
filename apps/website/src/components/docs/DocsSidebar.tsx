"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { DocNavGroup } from "@/lib/queries";

/**
 * Seitenleiste der Dokumentation.
 *
 * Ab 1060px abwärts klappt sie zu einem Schalter „Alle Artikel" zusammen,
 * standardmäßig geschlossen, und schließt sich nach der Auswahl wieder — damit
 * der Artikel auf dem Telefon oben im Bild beginnt.
 *
 * Der Zustand steckt in `data-open` und wird per CSS ausgewertet (siehe
 * globals.css). So stimmt schon die vom Server gelieferte Fassung, es gibt kein
 * Aufblitzen der Liste vor der Hydration und keine Media-Query in JavaScript.
 */
export function DocsSidebar({ groups }: { groups: DocNavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const listId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <aside
      className="docs-side"
      style={{
        position: "sticky",
        top: 100,
        maxHeight: "calc(100vh - 130px)",
        overflowY: "auto",
        paddingRight: 18,
        borderRight: "1px solid var(--border-1)",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <button
        type="button"
        className="m-only"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          height: 46,
          padding: "0 16px",
          borderRadius: 14,
          border: "1px solid var(--border-strong)",
          background: "var(--surface-1)",
          color: "var(--text-hi)",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <span>{open ? "Artikel ausblenden" : "Alle Artikel"}</span>
        <span aria-hidden="true" style={{ fontSize: 13, color: "var(--text-2)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      <nav
        id={listId}
        className="docs-nav-groups"
        data-open={open}
        aria-label="Dokumentation"
        style={{ display: "flex", flexDirection: "column", gap: 22 }}
      >
        {groups.map((group) => (
          <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".11em",
                textTransform: "uppercase",
                color: "var(--text-2)",
                marginBottom: 8,
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="doc-link"
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.4,
                    color: "var(--text-1)",
                    padding: "7px 10px",
                    borderRadius: 9,
                    display: "flex",
                    alignItems: "center",
                    minHeight: 34,
                  }}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
