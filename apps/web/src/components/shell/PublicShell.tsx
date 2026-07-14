"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconPencil,
  IconSearch,
  IconClipboardCheck,
  IconCard,
  IconChevronLeft,
  IconChevronRight,
  IconApple,
  IconGooglePlay,
  type IconProps,
} from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppFooter } from "@/components/AppFooter";
import { buttonClass, buttonStyle } from "@/components/ui/controls";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/stores";

// Öffentliche Hülle: ab `lg` die Seitenleiste des Lehrkraft-Portals (fixe
// Höhe, scrollende Content-Spalte), darunter die schwebende Kopf-Insel und
// normaler Dokumentenfluss. Die Umschaltung passiert AUSSCHLIESSLICH über
// CSS-Media-Queries (`lg:`-Utilities) — kein matchMedia, kein Breakpoint-State,
// damit Server- und Client-Render identisch sind (kein Hydration-Mismatch).

interface NavItem {
  href: string;
  label: string;
  Icon: (p: IconProps) => ReactNode;
}

const NAV: NavItem[] = [
  { href: "/", label: "Üben", Icon: IconPencil },
  { href: "/lernen", label: "Lernen", Icon: IconSearch },
  { href: "/pruefen", label: "Prüfen", Icon: IconClipboardCheck },
];
const NAV_SECONDARY: NavItem[] = [
  { href: "/pay", label: "Unterstützen", Icon: IconCard },
];

const TITLES: Record<string, string> = {
  "/": "Üben",
  "/lernen": "Lernen",
  "/pruefen": "Prüfen",
  "/pay": "Unterstützen",
  "/pay/danke": "Danke",
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");
}

export function PublicShell({ children }: { children: ReactNode }) {
  // SSR-stabil: startet auf Server UND Client mit `false` → kein Mismatch.
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "B1+Trainer";

  return (
    <div className="lg:flex lg:h-screen lg:w-screen lg:overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <div className="lg:flex lg:h-screen lg:min-w-0 lg:flex-1 lg:flex-col">
        <MobileHeader />
        <DesktopTopbar title={title} />

        {/* Ab `lg` ist <main> der Scroll-Container; darunter scrollt das Dokument. */}
        <main className="lms-scroll lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {/* Fußzeile an den unteren Rand des Viewports drücken, wenn die Seite kurz ist. */}
          <div className="flex min-h-full flex-col">
            <div className="flex-1">{children}</div>
            <AppFooter />
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Seitenleiste (nur ab lg) ───────────────────────────────────────────── */

function navItemStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 11,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    textAlign: "left",
    background: active ? "var(--surface-alt)" : "transparent",
    color: active ? "var(--text-hi)" : "var(--text-1)",
    textDecoration: "none",
  };
}

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const isActive = useIsActive();

  return (
    <aside
      data-collapsed={collapsed}
      className="relative hidden lg:flex"
      style={{
        width: 250,
        flex: "0 0 250px",
        borderRight: "1px solid var(--border-1)",
        background: "var(--surface-1)",
        flexDirection: "column",
        zIndex: 5,
        transition: "width .2s var(--ease), flex-basis .2s var(--ease)",
      }}
    >
      <button
        onClick={onToggle}
        title="Seitenleiste ein-/ausklappen"
        aria-label="Seitenleiste ein-/ausklappen"
        className="hover-strong"
        style={{
          position: "absolute",
          top: 50,
          right: -13,
          width: 26,
          height: 26,
          borderRadius: 999,
          border: "1px solid var(--border-1)",
          background: "var(--surface-1)",
          color: "var(--text-2)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20,
          boxShadow: "0 1px 4px rgba(28,24,20,.12)",
        }}
      >
        {collapsed ? (
          <IconChevronRight size={15} strokeWidth={2} />
        ) : (
          <IconChevronLeft size={15} strokeWidth={2} />
        )}
      </button>

      <div
        className="sb-header"
        style={{
          height: 63,
          flex: "0 0 63px",
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "0 18px",
          borderBottom: "1px solid var(--border-1)",
        }}
      >
        <BrandTile />
        <div
          className="sb-hide"
          style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)" }}>
            B1+Trainer
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--text-2)",
            }}
          >
            Lernende
          </span>
        </div>
      </div>

      <nav
        className="sb-nav"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="hover-nav"
            style={navItemStyle(isActive(href))}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
        <div
          style={{ height: 1, background: "var(--border-1)", margin: "10px 8px" }}
        />
        {NAV_SECONDARY.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="hover-nav"
            style={navItemStyle(isActive(href))}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Ersetzt die Tarif-/Auslastungskarte des Lehrkraft-Portals: die
          öffentliche App kennt weder Konto noch Kontingente. Stattdessen der
          Weg in die mobile App (apps/mobile) — Store-Links in lib/site.ts. */}
      <div className="sb-hide" style={{ padding: 12, borderTop: "1px solid var(--border-1)" }}>
        <div
          style={{
            background: "var(--surface-alt)",
            borderRadius: 14,
            padding: "12px 13px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--text-2)",
            }}
          >
            Mehr in der App
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--text-2)",
            }}
          >
            Verfolge deinen Fortschritt, tritt einer Klasse bei und schalte
            weitere Prüfungssimulationen frei.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <StoreButton
              href={APP_STORE_URL}
              Icon={IconApple}
              label="App Store"
            />
            <StoreButton
              href={PLAY_STORE_URL}
              Icon={IconGooglePlay}
              label="Google Play"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Store-Button — externer Link, öffnet in neuem Tab. */
function StoreButton({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: (p: IconProps) => ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-primary press"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 12px",
        borderRadius: 10,
        background: "var(--primary-btn-bg)",
        color: "var(--primary-btn-fg)",
        fontSize: 12.5,
        fontWeight: 600,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={16} />
      {label}
    </a>
  );
}

/* ── Kopfzeile Desktop (nur ab lg) ──────────────────────────────────────── */

function DesktopTopbar({ title }: { title: string }) {
  return (
    <header
      className="hidden lg:flex"
      style={{
        height: 63,
        flex: "0 0 63px",
        borderBottom: "1px solid var(--border-1)",
        background: "var(--surface-1)",
        alignItems: "center",
        gap: 14,
        padding: "0 22px",
        zIndex: 4,
      }}
    >
      <span
        className="font-serif"
        style={{ fontSize: 17, fontWeight: 600, color: "var(--text-hi)" }}
      >
        {title}
      </span>

      <div style={{ flex: 1 }} />

      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".08em",
          color: "var(--text-2)",
          border: "1px solid var(--border-1)",
          borderRadius: 8,
          padding: "5px 8px",
        }}
      >
        DE
      </span>

      <ThemeToggle />

      <Link
        href="/pay"
        className={buttonClass("primary")}
        style={{ ...buttonStyle("primary"), height: 40 }}
      >
        Unterstützen
      </Link>
    </header>
  );
}

/* ── Kopfzeile Mobil (unter lg) — schwebende Insel ─────────────────────── */

function MobileHeader() {
  const [open, setOpen] = useState(false);
  const isActive = useIsActive();
  const links = [...NAV, ...NAV_SECONDARY];

  return (
    <header className="sticky top-0 z-20 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] lg:hidden">
      <div
        className="relative mx-auto flex max-w-[1160px] items-center justify-between gap-3 rounded-card px-3 py-2.5 shadow-card backdrop-blur-md"
        style={{
          border: "1px solid var(--border-1)",
          background: "color-mix(in oklab, var(--surface-1) 88%, transparent)",
        }}
      >
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2"
          style={{ textDecoration: "none" }}
        >
          <BrandTile size={30} />
          <span
            style={{ fontSize: 15, fontWeight: 600, color: "var(--text-hi)" }}
          >
            B1+Trainer
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <ThemeToggle size={36} />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menü"
            aria-expanded={open}
            className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-chip"
            style={{ color: "var(--text-hi)", background: "transparent", cursor: "pointer" }}
          >
            <span
              className="block h-[2px] w-5 bg-current transition-transform"
              style={open ? { transform: "translateY(3.5px) rotate(45deg)" } : undefined}
            />
            <span
              className="block h-[2px] w-5 bg-current transition-transform"
              style={open ? { transform: "translateY(-3.5px) rotate(-45deg)" } : undefined}
            />
          </button>
        </div>

        {open ? (
          <nav
            className="animate-slide-down absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-card p-2 shadow-island"
            style={{
              border: "1px solid var(--border-1)",
              background: "var(--surface-1)",
            }}
          >
            {links.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="hover-nav"
                style={navItemStyle(isActive(href))}
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}

/* ── Markenkachel ───────────────────────────────────────────────────────── */

function BrandTile({ size = 34 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: 10,
        background: "var(--gruen)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--glow-gruen)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 600,
          fontSize: Math.round(size * 0.5),
          color: "#fff",
          lineHeight: 1,
        }}
      >
        B1
      </span>
    </span>
  );
}
