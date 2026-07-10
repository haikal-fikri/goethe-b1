"use client";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Eyebrow } from "@/components/ui/primitives";
import { IconX, IconCheck } from "@/components/icons";
import { UpgradeButton } from "@/components/abo/UpgradeButton";

// Paywall-Overlay „Mehr Klassen, faire Nutzung" (Design 1735–1762). Zeigt den
// Tarifvergleich Starter/Pro; die Pro-Spalte startet den Checkout (UpgradeButton).
// Der aktuelle Tarif ist als „Aktueller Tarif" deaktiviert. Öffnen via
// <PaywallLauncher> (der Tarif-Kopf/Cap-Hinweis rendert dessen Trigger-Button).

function Feature({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--gruen)", display: "flex", flex: "0 0 auto" }}>
        <IconCheck size={17} strokeWidth={2.2} />
      </span>
      <span style={{ fontSize: 13.5, color: "var(--text-1)" }}>{children}</span>
    </div>
  );
}

export function Paywall({
  currentPlan,
  onClose,
}: {
  currentPlan: "starter" | "pro";
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPro = currentPlan === "pro";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(20,17,12,.42)", backdropFilter: "blur(3px)" }}
      />
      <div
        className="lms-scroll"
        style={{
          position: "relative",
          width: 820,
          maxWidth: "100%",
          maxHeight: "100%",
          overflowY: "auto",
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: 22,
          boxShadow: "var(--shadow-island)",
          padding: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Eyebrow>Tarif wählen</Eyebrow>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="hover-strong press"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "none",
              background: "var(--surface-alt)",
              color: "var(--text-2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconX size={18} strokeWidth={1.9} />
          </button>
        </div>

        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 6px" }}>
          Mehr Klassen, faire Nutzung
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 14.5, color: "var(--text-2)" }}>
          Wählen Sie den Tarif, der zu Ihrem Unterricht passt. Jederzeit kündbar.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* Starter */}
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 20, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-2)", marginBottom: 12 }}>
              Starter
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 18 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--text-hi)" }}>€99</span>
              <span style={{ fontSize: 14, color: "var(--text-2)" }}>/ Jahr</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 22 }}>
              <Feature>
                <span style={{ fontFamily: "var(--font-serif)", color: "var(--text-hi)" }}>3</span> Klassen
              </Feature>
              <Feature>
                <span style={{ fontFamily: "var(--font-serif)", color: "var(--text-hi)" }}>60</span> Teilnehmende
              </Feature>
              <Feature>KI-Bewertung Schreiben &amp; Sprechen</Feature>
            </div>
            {isPro ? (
              <UpgradeButton
                plan="starter"
                variant="primary"
                label="Zu Starter wechseln"
                style={{ width: "100%", height: 46 }}
              />
            ) : (
              <button
                disabled
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 12,
                  border: "1px solid var(--border-1)",
                  background: "var(--surface-alt)",
                  color: "var(--text-2)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "default",
                }}
              >
                Aktueller Tarif
              </button>
            )}
          </div>

          {/* Pro */}
          <div style={{ background: "var(--surface-1)", border: "2px solid var(--gruen)", borderRadius: 20, padding: 24, position: "relative" }}>
            {!isPro ? (
              <span
                style={{
                  position: "absolute",
                  top: -11,
                  left: 24,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "#fff",
                  background: "var(--gruen)",
                  padding: "4px 11px",
                  borderRadius: 999,
                }}
              >
                Empfohlen
              </span>
            ) : null}
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--gruen)", marginBottom: 12 }}>
              Pro
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 18 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 600, color: "var(--text-hi)" }}>€249</span>
              <span style={{ fontSize: 14, color: "var(--text-2)" }}>/ Jahr</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 22 }}>
              <Feature>
                <span style={{ fontWeight: 600, color: "var(--text-hi)" }}>Unbegrenzt</span> viele Klassen
              </Feature>
              <Feature>Faire Nutzung statt harter Limits</Feature>
              <Feature>Vorrangiger Support</Feature>
            </div>
            {isPro ? (
              <button
                disabled
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 12,
                  border: "1px solid var(--border-1)",
                  background: "var(--surface-alt)",
                  color: "var(--text-2)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "default",
                }}
              >
                Aktueller Tarif
              </button>
            ) : (
              <UpgradeButton
                plan="pro"
                variant="accent"
                label="Zu Pro wechseln"
                style={{ width: "100%", height: 46 }}
              />
            )}
          </div>
        </div>

        <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 12.5, color: "var(--text-2)" }}>
          Sichere Zahlung über unseren Partner · Weiterleitung zum Checkout
        </p>
      </div>
    </div>
  );
}

// Trigger-Button, der das Paywall-Overlay öffnet. Wird im Tarif-Kopf und im
// Cap-Hinweis der Abo-Seite gerendert (beide sind Server-Markup).
export function PaywallLauncher({
  currentPlan,
  label,
  triggerStyle,
  triggerClassName = "press",
}: {
  currentPlan: "starter" | "pro";
  label: ReactNode;
  triggerStyle?: CSSProperties;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName} style={triggerStyle}>
        {label}
      </button>
      {open ? <Paywall currentPlan={currentPlan} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
