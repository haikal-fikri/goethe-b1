"use client";

import { useState } from "react";
import { PRESET_AMOUNTS, MIN_USD, MAX_USD } from "@/lib/stripe";

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
    <div className="rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--bg)] p-5">
      {canceled && (
        <p className="mb-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-elev)] px-4 py-3 text-sm text-[var(--fg-muted)]">
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
              className={`rounded-xl border px-3 py-3 text-center text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--accent-write)] bg-[color-mix(in_srgb,var(--accent-write)_18%,transparent)] text-[var(--fg)]"
                  : "border-[var(--border-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-elev)] hover:text-[var(--fg)]"
              }`}
            >
              ${amt}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block">
        <span className="text-xs uppercase tracking-wide text-[var(--fg-dim)]">
          Eigener Betrag
        </span>
        <div
          className={`mt-1 flex items-center gap-1 rounded-xl border px-3 py-2.5 transition-colors ${
            selected === "custom"
              ? "border-[var(--accent-write)]"
              : "border-[var(--border-soft)]"
          }`}
        >
          <span className="text-[var(--fg-muted)]">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={MIN_USD}
            max={MAX_USD}
            step="1"
            placeholder="0"
            value={custom}
            onFocus={() => setSelected("custom")}
            onChange={(e) => {
              setCustom(e.target.value);
              setSelected("custom");
            }}
            className="w-full bg-transparent text-[var(--fg)] outline-none placeholder:text-[var(--fg-dim)]"
          />
        </div>
      </label>

      {error && (
        <p className="mt-3 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!valid || loading}
        className="mt-4 w-full rounded-xl bg-[var(--accent-write)] px-4 py-3 text-sm font-semibold text-[var(--bg)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading
          ? "Weiterleitung …"
          : valid
            ? `Pay $${amount}`
            : "Preis wählen"}
      </button>

      <p className="mt-3 text-xs text-[var(--fg-dim)]">
        Sichere Bezahlung über Stripe. Du wirst zur Bezahlseite weitergeleitet.
        Freiwillige Zahlung für die Nutzung von B1+Trainer — keine Spende im
        steuerlichen Sinne.
      </p>
    </div>
  );
}
