"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Pricing } from "@/payload-types";

type Tier = NonNullable<Pricing["tiers"]>[number];

/**
 * Preisblock mit Umschalter Monatlich / Jährlich.
 *
 * Voreinstellung ist „Jährlich" — so steht es im Design (`billing: 'jahr'`),
 * auch wenn „Monatlich" links liegt.
 */
export function PricingSection({ tiers, note }: { tiers: Tier[]; note?: string | null }) {
  const [yearly, setYearly] = useState(true);
  const periodLabel = yearly ? "/ Monat, jährlich" : "/ Monat";

  return (
    <section className="lp-sec" style={{ maxWidth: 1160, margin: "0 auto", padding: "76px 24px 20px" }}>
      <div
        className="lp-row-wrap"
        style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 30, marginBottom: 30 }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".13em",
              textTransform: "uppercase",
              color: "var(--text-2)",
              marginBottom: 12,
            }}
          >
            Preise
          </div>
          <h2
            className="lp-h2"
            id="preise"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              fontWeight: 600,
              color: "var(--text-hi)",
              margin: 0,
              letterSpacing: "-.02em",
            }}
          >
            Pro Lehrkraft, nicht pro Klick.
          </h2>
        </div>
        <div
          role="radiogroup"
          aria-label="Abrechnungszeitraum"
          style={{ display: "flex", gap: 3, background: "var(--track-2)", borderRadius: 12, padding: 3 }}
        >
          <button
            type="button"
            className="nav-item tap-target"
            data-active={!yearly}
            role="radio"
            aria-checked={!yearly}
            tabIndex={yearly ? -1 : 0}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                setYearly(true);
              }
            }}
            onClick={() => setYearly(false)}
            style={toggleStyle}
          >
            Monatlich
          </button>
          <button
            type="button"
            className="nav-item tap-target"
            data-active={yearly}
            role="radio"
            aria-checked={yearly}
            tabIndex={yearly ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                setYearly(false);
              }
            }}
            onClick={() => setYearly(true)}
            style={toggleStyle}
          >
            Jährlich −20 %
          </button>
        </div>
      </div>

      <div className="lp-g3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, alignItems: "stretch" }}>
        {tiers.map((tier, index) => {
          const price = yearly ? tier.yearly : tier.monthly;
          const showPrice = typeof price === "number";
          return (
            <div
              key={tier.id ?? index}
              style={{
                background: "var(--surface-1)",
                border: tier.highlighted ? "1.5px solid var(--gruen)" : "1px solid var(--border-1)",
                borderRadius: 22,
                padding: "28px 26px",
                display: "flex",
                flexDirection: "column",
                position: tier.highlighted ? "relative" : undefined,
                boxShadow: tier.highlighted ? "var(--shadow-card-now)" : undefined,
              }}
            >
              {tier.highlighted ? (
                <span
                  style={{
                    position: "absolute",
                    top: -11,
                    left: 26,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    background: "var(--gruen)",
                    color: "#fff",
                    padding: "4px 11px",
                    borderRadius: 999,
                  }}
                >
                  Meistgewählt
                </span>
              ) : null}
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: ".11em",
                  textTransform: "uppercase",
                  color: "var(--text-2)",
                  marginBottom: 10,
                }}
              >
                {tier.eyebrow}
              </div>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 6px" }}>
                {tier.name}
              </h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)", margin: "0 0 20px" }}>{tier.tagline}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 22 }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600, color: "var(--text-hi)", lineHeight: 1 }}>
                  {showPrice ? `${price} €` : tier.customLabel}
                </span>
                {showPrice ? <span style={{ fontSize: 13, color: "var(--text-2)" }}>{periodLabel}</span> : null}
              </div>
              <Link
                href="/kontakt"
                style={{
                  width: "100%",
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  border: tier.highlighted ? "none" : "1px solid var(--border-strong)",
                  background: tier.highlighted ? "var(--gruen)" : "var(--bg)",
                  color: tier.highlighted ? "#fff" : "var(--text-hi)",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 22,
                  boxShadow: tier.highlighted ? "var(--glow-gruen)" : undefined,
                }}
              >
                {tier.ctaLabel}
              </Link>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {(tier.features ?? []).map((feature, featureIndex) => (
                  <div
                    key={feature.id ?? featureIndex}
                    style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-1)" }}
                  >
                    <span aria-hidden="true" style={{ color: "var(--gruen)" }}>✓</span>
                    {feature.text}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1 }} />
            </div>
          );
        })}
      </div>
      {note ? <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "18px 0 0" }}>{note}</p> : null}
    </section>
  );
}

const toggleStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-2)",
  padding: "8px 15px",
  borderRadius: 10,
};
