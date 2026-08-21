import type { CSSProperties, ReactNode } from "react";
import { Card } from "./primitives";

// Gemeinsames Seitengerüst der Konsole. Jede Konsolen-Seite rendert
// <PageShell><PageHeader …/> … </PageShell> — gleiche Maxbreite/Polsterung wie
// die Superadmin-Comp (max 1240px, 30px/34px).

export function PageShell({
  children,
  width = 1240,
  style,
}: {
  children: ReactNode;
  width?: number;
  style?: CSSProperties;
}) {
  return <div style={{ maxWidth: width, margin: "0 auto", padding: "30px 34px 60px", ...style }}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  right,
  style,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 20,
        marginBottom: 24,
        ...style,
      }}
    >
      <div>
        {eyebrow ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--text-2)",
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: 0,
            letterSpacing: "-.01em",
          }}
        >
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}

/**
 * Ehrlicher Leerzustand. Die Superadmin-Comp zeigt an vielen Stellen Zahlen
 * (MRR, Uptime, Ticket-SLA, KI-Confidence), für die es KEINE Tabelle und keine
 * Erfassung gibt. Statt Platzhalterzahlen zu erfinden, benennt diese Karte die
 * fehlende Datenquelle — sonst liest sich die Konsole wie ein Bericht.
 */
export function NotAvailable({
  title,
  reason,
  style,
}: {
  title: string;
  reason: string;
  style?: CSSProperties;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 7, ...style }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>{title}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" }}>{reason}</div>
      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        Nicht verfügbar
      </div>
    </Card>
  );
}

/** Beschriftete Kennzahl. Zahlen immer in der Serifenschrift (Design-Regel). */
export function StatCard({
  label,
  value,
  sub,
  subColor = "var(--text-2)",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  subColor?: string;
}) {
  return (
    <Card radius={16} style={{ padding: "16px 18px" }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--text-2)",
          marginBottom: 9,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 27,
          fontWeight: 600,
          color: "var(--text-hi)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11.5, color: subColor, marginTop: 5 }}>{sub}</div> : null}
    </Card>
  );
}

/** Karte mit Titelzeile + optionalem Link rechts (Listen-/Tabellenblöcke). */
export function SectionCard({
  title,
  right,
  children,
  style,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Card radius={20} style={{ padding: "20px 22px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "var(--text-hi)", margin: 0 }}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </Card>
  );
}

/** Leerzeile für Tabellen/Listen ohne Treffer (echte Tabelle, nur 0 Zeilen). */
export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "18px 2px", fontSize: 13, color: "var(--text-2)" }}>{children}</div>
  );
}
