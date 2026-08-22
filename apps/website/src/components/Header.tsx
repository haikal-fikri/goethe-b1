"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { StoreBadges } from "./StoreBadges";

type Props = {
  lernenUrl: string;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/loesungen", label: "Lösungen" },
  { href: "/ueber-uns", label: "Über uns" },
  { href: "/kontakt", label: "Kontakt" },
];

/**
 * Kopfzeile inklusive mobilem Menü.
 *
 * Bewusst als eine Client-Komponente: Der Umschalter und die aktive
 * Navigations-Markierung teilen sich den Zustand, und die Schublade muss im
 * Design ein Geschwister der Kopfleiste bleiben (sie schiebt den Inhalt nicht,
 * sondern liegt darüber). Die Markup-Menge ist klein.
 */
export function Header({ lernenUrl, appStoreUrl, playStoreUrl }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const burgerRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  // Beim Seitenwechsel schließen — im Design macht das `go()`.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape schließt und gibt den Fokus an den Menü-Button zurück.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        // Deckend statt Milchglas (nachträglich gewünscht — der Entwurf hatte
        // var(--tabbar-bg) + backdrop-filter: blur(14px)). Wer das Milchglas
        // zurück will: beide Zeilen wiederherstellen UND die Notch-Farben in
        // globals.css/layout.tsx zurück auf die Komposit-Werte (#FFFFFE/#201B16)
        // stellen — Streifen und Kopfzeile müssen dieselbe Farbe haben.
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-1)",
      }}
    >
      <div
        className="lp-headbar"
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          height: 70,
          display: "flex",
          alignItems: "center",
          gap: 26,
          padding: "0 24px",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 11, color: "inherit" }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "var(--gruen)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 36px",
              boxShadow: "var(--glow-gruen)",
            }}
          >
            <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 18, color: "#fff", lineHeight: 1 }}>
              DS
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-.005em" }}>
              Digital Sprache Institut
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--text-2)" }}>
              Prüfungstraining Deutsch
            </span>
          </div>
        </Link>

        <nav
          className="nav-row m-hide"
          aria-label="Hauptnavigation"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item tap-target"
              data-active={isActive(item.href)}
              aria-current={isActive(item.href) ? "page" : undefined}
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text-2)",
                padding: "9px 13px",
                borderRadius: 11,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <a
          className="m-hide lernen-link"
          href={lernenUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginRight: -16,
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: 40,
            padding: "0 15px",
            borderRadius: 12,
            border: "1px solid var(--border-1)",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--text-hi)",
            background: "var(--bg)",
          }}
        >
          Lernen
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7" />
            <path d="M9 7h8v8" />
          </svg>
          <span className="sr-only">(öffnet in neuem Tab)</span>
        </a>

        <Link
          className="m-hide"
          href="/kontakt"
          style={{
            display: "flex",
            alignItems: "center",
            height: 40,
            padding: "0 15px",
            borderRadius: 12,
            border: "1px solid var(--gruen)",
            background: "var(--gruen)",
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: 1,
            boxShadow: "var(--glow-gruen)",
          }}
        >
          Demo buchen
        </Link>

        <button
          ref={burgerRef}
          type="button"
          className="m-only tap-target"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          data-open={open}
          aria-controls={open ? drawerId : undefined}
          style={{
            display: "none",
            width: 38,
            height: 38,
            flex: "0 0 38px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-hi)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Offen wird aus dem Burger ein X (auf Wunsch — im Entwurf blieb das
              Symbol gleich). Die drei Striche behalten ihre Endpunkte und
              bewegen sich ineinander; bei prefers-reduced-motion schaltet die
              Regel in globals.css die Bewegung ab. */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path className="burger-line burger-top" d="M4 7h16" />
            <path className="burger-line burger-mid" d="M4 12h16" />
            <path className="burger-line burger-bot" d="M4 17h16" />
          </svg>
        </button>
      </div>

      {open ? (
        <nav
          id={drawerId}
          className="m-drawer"
          aria-label="Menü"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "10px 12px 16px",
            borderTop: "1px solid var(--border-1)",
            borderBottom: "1px solid var(--border-1)",
            background: "var(--bg)",
            boxShadow: "var(--shadow-card-now)",
          }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              style={{
                textAlign: "left",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-hi)",
                padding: "12px 10px",
                borderRadius: 12,
              }}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={lernenUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 15, fontWeight: 600, padding: "12px 10px" }}
          >
            Lernen ↗<span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
          <Link
            href="/kontakt"
            style={{
              marginTop: 8,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              background: "var(--gruen)",
              color: "#fff",
              fontSize: 14.5,
              fontWeight: 600,
              boxShadow: "var(--glow-gruen)",
            }}
          >
            Demo buchen
          </Link>
          <StoreBadges appStoreUrl={appStoreUrl} playStoreUrl={playStoreUrl} variant="drawer" />
        </nav>
      ) : null}
    </header>
  );
}
