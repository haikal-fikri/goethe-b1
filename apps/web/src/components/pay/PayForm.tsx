"use client";

import { useState } from "react";
import { PRESET_AMOUNTS, MIN_USD, MAX_USD } from "@/lib/stripe";
import { Button, FieldLabel } from "@/components/ui/controls";
import { Card, Num } from "@/components/ui/primitives";

export function PayForm({ canceled }: { canceled?: boolean }) {
  // Ausgewählter Preset-Betrag (Zahl) oder "custom" für die Freieingabe.
  const [selected, setSelected] = useState<number | "custom">(PRESET_AMOUNTS[1]);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount =
    selected === "custom" ? Number.parseFloat(custom) : selected;
  const valid =
    Number.isFinite(amount) && amount >= MIN_USD && amount <= MAX_USD;

  async function handleSubmit() {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Etwas ist schiefgelaufen.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
      setLoading(false);
    }
  }

  return (
    <Card radius={20} style={{ padding: "20px 22px" }}>
      {canceled && (
        <p
          className="mb-4 rounded-tile px-4 py-3 text-sm"
          style={{ background: "var(--surface-alt)", color: "var(--text-2)" }}
        >
          Zahlung abgebrochen — kein Problem. Du kannst es jederzeit erneut
          versuchen.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESET_AMOUNTS.map((amt) => {
          const active = selected === amt;
          return (
            <button
              key={amt}
              type="button"
              onClick={() => setSelected(amt)}
              className={`press rounded-tile border px-3 py-3 text-center font-serif text-[15px] font-semibold tabular-nums ${active ? "" : "hover-strong"}`}
              style={{
                borderColor: active ? "var(--gruen)" : "var(--border-1)",
                background: active ? "var(--gruen-tint)" : "var(--surface-1)",
                color: active ? "var(--gruen)" : "var(--text-2)",
                cursor: "pointer",
              }}
            >
              ${amt}
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <FieldLabel>Eigener Betrag</FieldLabel>
        <div
          className="focus-within:shadow-none flex items-center gap-1 rounded-input border px-3"
          style={{
            height: 44,
            borderColor:
              selected === "custom" ? "var(--gruen)" : "var(--border-1)",
            background: "var(--surface-1)",
          }}
        >
          <span className="font-serif text-muted">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={MIN_USD}
            max={MAX_USD}
            step="0.01"
            placeholder="0"
            value={custom}
            onFocus={() => setSelected("custom")}
            onChange={(e) => {
              setCustom(e.target.value);
              setSelected("custom");
            }}
            className="w-full bg-transparent font-serif text-[15px] tabular-nums text-ink outline-none"
          />
        </div>
        <span className="mt-1.5 block text-xs text-faint">
          Mindestbetrag <Num>${MIN_USD.toFixed(2)}</Num>
        </span>
      </label>

      {error && (
        <p
          className="mt-3 rounded-tile px-3 py-2.5 text-sm"
          role="alert"
          style={{ background: "var(--rot-tint)", color: "var(--rot-text)" }}
        >
          {error}
        </p>
      )}

      <Button
        variant="accent"
        onClick={handleSubmit}
        disabled={!valid || loading}
        style={{
          width: "100%",
          height: 48,
          marginTop: 16,
          opacity: !valid || loading ? 0.4 : 1,
          cursor: !valid || loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          "Weiterleitung …"
        ) : valid ? (
          <>
            Pay <Num>${amount.toFixed(2)}</Num>
          </>
        ) : (
          "Preis wählen"
        )}
      </Button>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        Sichere Bezahlung über Stripe. Du wirst zur Bezahlseite weitergeleitet.
        Freiwillige Zahlung für die Nutzung von B1+Trainer — keine Spende im
        steuerlichen Sinne.
      </p>
    </Card>
  );
}
