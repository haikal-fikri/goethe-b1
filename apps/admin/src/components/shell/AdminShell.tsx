"use client";
import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconBuilding,
  IconCard,
  IconBook,
  IconSparkles,
  IconShieldCheck,
  IconChartBars,
  IconChat,
  IconShield,
  IconSun,
  IconMoon,
  IconLogout,
} from "@/components/icons";
import { toggleTheme, currentTheme } from "@/lib/theme";
import { initials } from "@/lib/format";

// Superadmin-Chrome (teacher-lms/05 §4). Bewusst schlanker als das Lehrkraft-
// AppShell: kein Klassen-Umschalter, keine Tarif-Meter, keine Glocke, keine
// globale Suche — die Konsole hat weder Tenant-Kontext noch einen Suchindex.
// Akzent ist --lila (im Lehrkraft-Portal nur der KI-Akzent, hier die Primärfarbe).

export interface ShellUser {
  name: string;
  email: string;
}

/** Zielumgebung der DB-Verbindung — steht im Topbar, damit ein Corpus-Write nie
 *  versehentlich in der falschen Umgebung landet. */
export type ShellEnv = "production" | "preview" | "development";

interface Props {
  user: ShellUser;
  env: ShellEnv;
  children: ReactNode;
}

const NAV = [
  { href: "/uebersicht", label: "Übersicht", Icon: IconDashboard },
  { href: "/organisationen", label: "Organisationen", Icon: IconBuilding },
  { href: "/abrechnung", label: "Abrechnung", Icon: IconCard },
  { href: "/korpus", label: "Prüfungs-Korpus", Icon: IconBook },
  { href: "/ki-bewertung", label: "KI-Bewertung", Icon: IconSparkles },
  { href: "/dsgvo", label: "DSGVO & Compliance", Icon: IconShieldCheck },
  { href: "/analytics", label: "Analytics", Icon: IconChartBars },
  { href: "/support", label: "Support", Icon: IconChat },
];

const ENV_LABEL: Record<ShellEnv, string> = {
  production: "Produktion",
  preview: "Vorschau",
  development: "Entwicklung",
};
const ENV_COLOR: Record<ShellEnv, { fg: string; bg: string }> = {
  production: { fg: "var(--rot-text)", bg: "var(--rot-tint)" },
  preview: { fg: "var(--gold-text)", bg: "var(--gold-tint)" },
  development: { fg: "var(--gruen)", bg: "var(--gruen-tint)" },
};

export function AdminShell({ user, env, children }: Props) {
  const pathname = usePathname();
  const [accountMenu, setAccountMenu] = useState(false);
  // Wie im Lehrkraft-Portal: das Inline-Script setzt data-theme VOR dem Paint;
  // Server und erste Hydration kennen es nicht. Stabil "hell" starten und nach
  // dem Mount korrigieren, sonst Hydration-Mismatch am Toggle-Icon.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(currentTheme() === "dark");
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  function navItemStyle(active: boolean): CSSProperties {
    return {
      display: "flex",
      alignItems: "center",
      gap: 11,
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      textAlign: "left",
      background: active ? "var(--surface-alt)" : "transparent",
      color: active ? "var(--text-hi)" : "var(--text-1)",
      textDecoration: "none",
    };
  }

  function onToggleTheme() {
    setIsDark(toggleTheme() === "dark");
  }

  const envTone = ENV_COLOR[env];

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--text-1)",
      }}
    >
      {/* ── Sidebar (fix, nicht einklappbar) ─────────────────────── */}
      <aside
        style={{
          width: 248,
          flex: "0 0 248px",
          borderRight: "1px solid var(--border-1)",
          background: "var(--surface-1)",
          display: "flex",
          flexDirection: "column",
          zIndex: 5,
        }}
      >
        <div
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
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--lila)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 34px",
              color: "#fff",
              boxShadow: "0 4px 14px color-mix(in oklab, var(--lila) 45%, transparent)",
            }}
          >
            <IconShield size={19} strokeWidth={1.9} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)" }}>B1+Trainer</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--lila)",
              }}
            >
              Superadmin
            </span>
          </div>
        </div>

        <nav
          style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 3 }}
          className="lms-scroll"
        >
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="hover-nav" style={navItemStyle(isActive(href))}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* ── Hauptspalte ──────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
        <header
          style={{
            height: 63,
            flex: "0 0 63px",
            borderBottom: "1px solid var(--border-1)",
            background: "var(--surface-1)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 22px",
            position: "relative",
            zIndex: 4,
          }}
        >
          <span
            title="Zielumgebung dieser Konsole"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: envTone.fg,
              background: envTone.bg,
              padding: "5px 11px",
              borderRadius: 999,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "currentColor" }} />
            {ENV_LABEL[env]}
          </span>

          <div style={{ flex: 1 }} />

          <button onClick={onToggleTheme} title="Design wechseln" className="hover-strong" style={chromeBtn}>
            {isDark ? <IconMoon size={18} /> : <IconSun size={18} />}
          </button>

          <button
            onClick={() => setAccountMenu((v) => !v)}
            className="hover-surface"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "5px 6px 5px 5px",
              borderRadius: 11,
              border: "1px solid transparent",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "var(--lila-tint)",
                color: "var(--lila)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {initials(user.name)}
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, alignItems: "flex-start" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-hi)", whiteSpace: "nowrap" }}>
                {user.name}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>Superadmin</span>
            </div>
          </button>

          {accountMenu ? (
            <div
              style={{
                position: "absolute",
                top: 58,
                right: 22,
                width: 240,
                background: "var(--surface-1)",
                border: "1px solid var(--border-1)",
                borderRadius: 15,
                boxShadow: "var(--shadow-island)",
                padding: 7,
                zIndex: 20,
              }}
            >
              <div
                style={{
                  padding: "8px 10px 6px",
                  fontSize: 12,
                  color: "var(--text-2)",
                  wordBreak: "break-all",
                  lineHeight: 1.4,
                }}
              >
                {user.email}
              </div>
              <div style={{ height: 1, background: "var(--border-1)", margin: "5px 6px" }} />
              <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                <button
                  type="submit"
                  className="hover-surface"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--rot-text)",
                    textAlign: "left",
                    fontSize: 13.5,
                    fontWeight: 500,
                  }}
                >
                  <IconLogout size={16} />
                  Abmelden
                </button>
              </form>
            </div>
          ) : null}
        </header>

        <main className="lms-scroll" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {children}
        </main>
      </div>

      {accountMenu ? (
        // zIndex MUSS über der Seitenleiste (5) und dem Topbar (4) liegen,
        // sonst erreichen Klicks auf die Navigation die Fläche nie und das
        // Menü bleibt beim Seitenwechsel offen stehen (AdminShell wird vom
        // Client-Routing nicht neu gemountet). Das Menü selbst liegt auf 20.
        <div onClick={() => setAccountMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
      ) : null}
    </div>
  );
}

const chromeBtn: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 11,
  border: "1px solid var(--border-1)",
  background: "var(--bg)",
  cursor: "pointer",
  color: "var(--text-1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
