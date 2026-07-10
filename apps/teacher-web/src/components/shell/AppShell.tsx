"use client";
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconUsers,
  IconClipboardCheck,
  IconCalendar,
  IconCard,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconSearch,
  IconBell,
  IconSun,
  IconMoon,
  IconGrid,
  IconPlus,
  IconLogout,
} from "@/components/icons";
import { toggleTheme, currentTheme } from "@/lib/theme";
import { Avatar } from "@/components/ui/primitives";
import { initials } from "@/lib/format";

export interface ShellClass {
  id: string;
  name: string;
  members: number;
}
export interface ShellUser {
  name: string;
  email: string;
}
interface Props {
  user: ShellUser;
  classes: ShellClass[];
  plan: "starter" | "pro";
  classesUsed: number;
  studentsUsed: number;
  unread: number;
  children: ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/klassen", label: "Klassen", Icon: IconUsers },
  { href: "/aufgaben", label: "Aufgaben", Icon: IconClipboardCheck },
  { href: "/stundenplan", label: "Stundenplan", Icon: IconCalendar },
];
const NAV_SECONDARY = [
  { href: "/abo", label: "Abo", Icon: IconCard },
  { href: "/einstellungen", label: "Einstellungen", Icon: IconSettings },
];

const CLASS_CAP = 3;
const STUDENT_CAP = 60;

export function AppShell({ user, classes, plan, classesUsed, studentsUsed, unread, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [classMenu, setClassMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [currentClass, setCurrentClass] = useState<string>("alle");
  // Das Theme setzt ein Inline-Script VOR dem Paint aus localStorage — das DOM
  // (data-theme) ist der Wahrheitswert. Server + erste Client-Hydration kennen
  // es noch nicht, daher stabil "hell" starten und nach dem Mount korrigieren.
  // Sonst weicht das Toggle-Icon zwischen Server (hell) und Client (echtes
  // Theme) ab → Hydration-Mismatch.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(currentTheme() === "dark");
  }, []);

  const currentLabel =
    currentClass === "alle" ? "Alle Klassen" : classes.find((c) => c.id === currentClass)?.name ?? "Alle Klassen";

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  function navItemStyle(active: boolean): React.CSSProperties {
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
    const t = toggleTheme();
    setIsDark(t === "dark");
  }

  const menuOpen = classMenu || accountMenu;

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
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        data-collapsed={collapsed}
        style={{
          width: 250,
          flex: "0 0 250px",
          borderRight: "1px solid var(--border-1)",
          background: "var(--surface-1)",
          display: "flex",
          flexDirection: "column",
          zIndex: 5,
          position: "relative",
          transition: "width .2s var(--ease), flex-basis .2s var(--ease)",
        }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          title="Seitenleiste ein-/ausklappen"
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
          {collapsed ? <IconChevronRight size={15} strokeWidth={2} /> : <IconChevronLeft size={15} strokeWidth={2} />}
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
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--gruen)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 34px",
              boxShadow: "var(--glow-gruen)",
            }}
          >
            <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 17, color: "#fff", lineHeight: 1 }}>
              B1
            </span>
          </div>
          <div className="sb-hide" style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-hi)" }}>B1+Trainer</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              Lehrkraft
            </span>
          </div>
        </div>

        <nav
          className="sb-nav"
          style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 3 }}
        >
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="hover-nav" style={navItemStyle(isActive(href))}>
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
          <div style={{ height: 1, background: "var(--border-1)", margin: "10px 8px" }} />
          {NAV_SECONDARY.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="hover-nav" style={navItemStyle(isActive(href))}>
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sb-hide" style={{ padding: 12, borderTop: "1px solid var(--border-1)" }}>
          <div
            style={{
              background: "var(--surface-alt)",
              borderRadius: 14,
              padding: "11px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--text-2)",
                }}
              >
                {plan === "pro" ? "Pro-Tarif" : "Starter-Tarif"}
              </span>
              {plan === "starter" ? (
                <Link href="/abo" style={{ fontSize: 11.5, fontWeight: 600 }}>
                  Upgrade
                </Link>
              ) : null}
            </div>
            <UsageRow
              label="Klassen"
              used={classesUsed}
              cap={plan === "pro" ? null : CLASS_CAP}
              color={plan === "starter" && classesUsed >= CLASS_CAP ? "var(--gold)" : "var(--gruen)"}
            />
            <UsageRow
              label="Teilnehmende"
              used={studentsUsed}
              cap={plan === "pro" ? null : STUDENT_CAP}
              color="var(--gruen)"
            />
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────── */}
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
          <button
            onClick={() => {
              setClassMenu((v) => !v);
              setAccountMenu(false);
            }}
            className="hover-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "8px 13px",
              borderRadius: 11,
              border: "1px solid var(--border-1)",
              background: "var(--bg)",
              cursor: "pointer",
              color: "var(--text-hi)",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: "var(--cefr-b1)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-serif)",
                fontSize: 10,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              B1
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{currentLabel}</span>
            <IconChevronDown size={15} style={{ color: "var(--text-2)" }} />
          </button>

          <div style={{ flex: 1, minWidth: 150, maxWidth: 400, position: "relative", display: "flex", alignItems: "center" }}>
            <IconSearch size={17} style={{ position: "absolute", left: 13, color: "var(--text-3)" }} />
            <input
              placeholder="Suchen…"
              className="focus-ring"
              style={{
                width: "100%",
                height: 40,
                borderRadius: 11,
                border: "1px solid var(--border-1)",
                background: "var(--bg)",
                padding: "0 14px 0 38px",
                fontSize: 13.5,
                color: "var(--text-hi)",
                outline: "none",
              }}
            />
          </div>

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

          <button onClick={onToggleTheme} title="Design wechseln" className="hover-strong" style={chromeBtn}>
            {isDark ? <IconMoon size={18} /> : <IconSun size={18} />}
          </button>

          <button title="Benachrichtigungen" className="hover-strong" style={{ ...chromeBtn, position: "relative" }}>
            <IconBell size={18} />
            {unread > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 9,
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: "var(--rot)",
                  border: "1.5px solid var(--surface-1)",
                }}
              />
            ) : null}
          </button>

          <button
            onClick={() => {
              setAccountMenu((v) => !v);
              setClassMenu(false);
            }}
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
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>Lehrkraft</span>
            </div>
          </button>

          {classMenu ? (
            <div style={{ ...dropdown, left: 22, width: 290 }}>
              <div style={dropdownEyebrow}>Klasse wählen</div>
              <button
                onClick={() => {
                  setCurrentClass("alle");
                  setClassMenu(false);
                }}
                className="hover-surface"
                style={dropdownItem}
              >
                <span style={{ ...menuTile, background: "var(--surface-alt)", color: "var(--text-2)" }}>
                  <IconGrid size={15} />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>Alle Klassen</span>
              </button>
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCurrentClass(c.id);
                    setClassMenu(false);
                  }}
                  className="hover-surface"
                  style={dropdownItem}
                >
                  <span
                    style={{
                      ...menuTile,
                      background: "var(--cefr-b1)",
                      color: "#fff",
                      fontFamily: "var(--font-serif)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    B1
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", flex: 1, lineHeight: 1.25 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-2)" }}>{c.members} TN</span>
                  </span>
                </button>
              ))}
              {classes.length === 0 ? (
                <div style={{ padding: "9px 10px", fontSize: 12.5, color: "var(--text-2)" }}>Noch keine Klassen.</div>
              ) : null}
              <div style={{ height: 1, background: "var(--border-1)", margin: "5px 6px" }} />
              <Link href="/klassen" onClick={() => setClassMenu(false)} className="hover-surface" style={{ ...dropdownItem, color: "var(--gruen)" }}>
                <span style={{ ...menuTile, background: "var(--gruen-tint)", color: "var(--gruen)" }}>
                  <IconPlus size={15} />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>Neue Klasse anlegen</span>
              </Link>
            </div>
          ) : null}

          {accountMenu ? (
            <div style={{ ...dropdown, right: 22, width: 230 }}>
              <Link href="/einstellungen" onClick={() => setAccountMenu(false)} className="hover-surface" style={accountItem}>
                Profil &amp; Einstellungen
              </Link>
              <div style={{ height: 1, background: "var(--border-1)", margin: "5px 6px" }} />
              <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                <button type="submit" className="hover-surface" style={{ ...accountItem, color: "var(--rot-text)", width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>
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

      {menuOpen ? (
        <div
          onClick={() => {
            setClassMenu(false);
            setAccountMenu(false);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 3 }}
        />
      ) : null}
    </div>
  );
}

const chromeBtn: React.CSSProperties = {
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
const dropdown: React.CSSProperties = {
  position: "absolute",
  top: 58,
  background: "var(--surface-1)",
  border: "1px solid var(--border-1)",
  borderRadius: 15,
  boxShadow: "var(--shadow-island)",
  padding: 7,
  zIndex: 20,
};
const dropdownEyebrow: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  padding: "8px 10px 6px",
};
const dropdownItem: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 10px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "var(--text-hi)",
  textAlign: "left",
  textDecoration: "none",
};
const accountItem: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 10px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "var(--text-hi)",
  textAlign: "left",
  fontSize: 13.5,
  fontWeight: 500,
  textDecoration: "none",
};
const menuTile: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function UsageRow({ label, used, cap, color }: { label: string; used: number; cap: number | null; color: string }) {
  const pct = cap ? Math.min(100, (used / cap) * 100) : Math.min(100, used > 0 ? 40 : 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--text-1)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--text-hi)" }}>
          {used}
          <span style={{ color: "var(--text-2)", fontSize: 11 }}>{cap ? `/${cap}` : ""}</span>
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "var(--track-1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: color }} />
      </div>
    </div>
  );
}
