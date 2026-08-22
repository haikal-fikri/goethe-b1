"use client";

import { useId, useState } from "react";

export type FaqItem = { q: string; a: string };

/**
 * Häufige Fragen. Der erste Eintrag ist offen, jeder Klick schaltet genau
 * seinen eigenen Eintrag um — wie im Design (`faqOpen: [true,false,false,false]`).
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<boolean[]>(() => items.map((_, index) => index === 0));
  const baseId = useId();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, index) => {
        const isOpen = open[index] ?? false;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        return (
          <div
            key={item.q}
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 16,
              padding: "20px 24px",
            }}
          >
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                onClick={() =>
                  setOpen((previous) => previous.map((value, i) => (i === index ? !value : value)))
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 20,
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  minHeight: 44,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-hi)",
                }}
              >
                {item.q}
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 26px",
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: "var(--surface-alt)",
                    color: "var(--text-hi)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            {isOpen ? (
              <p
                id={panelId}
                aria-labelledby={buttonId}
                style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-1)", margin: "14px 0 0", maxWidth: "70ch" }}
              >
                {item.a}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
