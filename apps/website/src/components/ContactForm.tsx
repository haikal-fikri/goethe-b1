"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CSSProperties } from "react";
import Link from "next/link";
import { submitContact, type ContactState } from "@/app/(site)/kontakt/actions";
import { SendIcon } from "./icons";

const initialState: ContactState = { status: "idle" };

// Ohne Site-Key wird das Widget nicht gerendert — lokale Entwicklung ohne
// Cloudflare-Keys funktioniert dadurch unverändert. Die Gegenprüfung auf dem
// Server hängt am TURNSTILE_SECRET_KEY; beide gehören zusammen.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const labelTextStyle: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--text-hi)" };
const fieldStyle: CSSProperties = {
  height: 44,
  borderRadius: 15,
  border: "1px solid var(--border-strong)",
  background: "var(--bg)",
  color: "var(--text-hi)",
  fontSize: 14,
  padding: "0 14px",
};
const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 7 };
const errorStyle: CSSProperties = { fontSize: 12.5, color: "var(--error-text)" };

function SubmitButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || blocked;
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-describedby={blocked ? "turnstile-hinweis" : undefined}
      style={{
        height: 46,
        padding: "0 22px",
        borderRadius: 15,
        border: "none",
        background: "var(--gruen)",
        color: "#fff",
        fontSize: 14.5,
        fontWeight: 600,
        cursor: pending ? "progress" : disabled ? "not-allowed" : "pointer",
        boxShadow: "var(--glow-gruen)",
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        opacity: disabled ? 0.75 : 1,
      }}
    >
      {pending ? "Wird gesendet …" : "Senden"}
      <SendIcon />
    </button>
  );
}

export function ContactForm({ contactEmail }: { contactEmail: string }) {
  const [state, formAction] = useActionState(submitContact, initialState);
  // „Weitere Anfrage": zurück zum Formular, ohne Seitenwechsel. Verglichen wird
  // die Objektidentität des Ergebnisses — eine erneute Absendung liefert ein
  // neues Objekt, die Erfolgsmeldung erscheint also wieder.
  const [dismissed, setDismissed] = useState<ContactState | null>(null);
  const [resetKey, setResetKey] = useState(0);
  // Ein Turnstile-Token ist einmal gültig. Nach jeder Antwort, die das Formular
  // erneut zeigt, muss ein frisches Widget her — sonst schlägt der zweite
  // Versuch mit „timeout-or-duplicate" fehl.
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [humanVerified, setHumanVerified] = useState(false);
  const showSuccess = state.status === "success" && state !== dismissed;

  // Das Design scrollt nach dem Absenden nach oben (submitForm → scrollTo(0,0)),
  // damit die Erfolgsmeldung im Bild ist.
  const lastState = useRef(state);
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.status === "success") window.scrollTo(0, 0);
      if (state.resetTurnstile) {
        setHumanVerified(false);
        setTurnstileKey((value) => value + 1);
      }
    }
  }, [state]);

  if (showSuccess) {
    return (
      <div
        style={{
          background: "var(--gruen-tint)",
          border: "1px solid var(--gruen)",
          borderRadius: 20,
          padding: "28px 30px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text-hi)",
            marginBottom: 8,
          }}
        >
          Danke, Anfrage ist da.
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text-1)", margin: "0 0 18px" }}>
          Wir antworten an die angegebene Adresse. Bei dringenden Fragen:{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
        <button
          type="button"
          onClick={() => {
            setDismissed(state);
            setResetKey((value) => value + 1);
          }}
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 12,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-1)",
            color: "var(--text-hi)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Weitere Anfrage
        </button>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form
      key={resetKey}
      data-crm-form="demo-request"
      action={formAction}
      noValidate
      className="lp-card"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 22,
        boxShadow: "var(--shadow-card-now)",
        padding: "28px 30px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {state.status === "error" && state.message ? (
        <p role="alert" style={{ ...errorStyle, margin: 0 }}>
          {state.message}
        </p>
      ) : null}

      {/* Honeypot — für Menschen unsichtbar, für Formular-Bots verlockend. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="firma_website">Bitte nicht ausfüllen</label>
        <input id="firma_website" name="firma_website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="lp-g2f" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Name *</span>
          <input
            name="name"
            required
            placeholder="Vor- und Nachname"
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "error-name" : undefined}
            style={fieldStyle}
          />
          {errors.name ? (
            <span id="error-name" style={errorStyle}>
              {errors.name}
            </span>
          ) : null}
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>E-Mail *</span>
          <input
            name="email"
            type="email"
            required
            placeholder="name@schule.de"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "error-email" : undefined}
            style={fieldStyle}
          />
          {errors.email ? (
            <span id="error-email" style={errorStyle}>
              {errors.email}
            </span>
          ) : null}
        </label>
      </div>

      <div className="lp-g2f" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Einrichtung</span>
          <input
            name="organisation"
            placeholder="Sprachschule, Träger, VHS …"
            autoComplete="organization"
            style={fieldStyle}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Lehrkräfte</span>
          <select name="teamsize" defaultValue="1" style={{ ...fieldStyle, padding: "0 12px" }}>
            <option>1</option>
            <option>2–5</option>
            <option>6–15</option>
            <option>16–50</option>
            <option>mehr als 50</option>
          </select>
        </label>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Anliegen</span>
        <select name="topic" defaultValue="Demo für meine Schule" style={{ ...fieldStyle, padding: "0 12px" }}>
          <option>Demo für meine Schule</option>
          <option>Testzugang als Einzel-Lehrkraft</option>
          <option>Angebot Campus / mehrere Standorte</option>
          <option>Datenschutz &amp; AV-Vertrag</option>
          <option>Etwas anderes</option>
        </select>
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Nachricht</span>
        <textarea
          name="message"
          rows={5}
          placeholder="Wie viele Deutschkurse laufen bei Ihnen, und wie korrigieren Sie heute?"
          aria-invalid={errors.message ? true : undefined}
          style={{
            borderRadius: 15,
            border: "1px solid var(--border-strong)",
            background: "var(--bg)",
            color: "var(--text-hi)",
            fontSize: 14,
            padding: "12px 14px",
            resize: "vertical",
            lineHeight: 1.6,
          }}
        />
        {errors.message ? <span style={errorStyle}>{errors.message}</span> : null}
      </label>

      <label style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <input
          name="consent"
          type="checkbox"
          required
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? "error-consent" : undefined}
          style={{ width: 17, height: 17, marginTop: 2, accentColor: "var(--gruen)" }}
        />
        <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-1)" }}>
          Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung dieser Anfrage gespeichert
          werden. Details in der <Link href="/datenschutz">Datenschutzerklärung</Link>.
          {errors.consent ? (
            <span id="error-consent" style={{ ...errorStyle, display: "block" }}>
              {errors.consent}
            </span>
          ) : null}
        </span>
      </label>

      {TURNSTILE_SITE_KEY ? (
        <div>
          <Turnstile
            key={turnstileKey}
            siteKey={TURNSTILE_SITE_KEY}
            options={{ language: "de", theme: "auto" }}
            onSuccess={() => setHumanVerified(true)}
            onExpire={() => setHumanVerified(false)}
            onError={() => setHumanVerified(false)}
          />
          {!humanVerified ? (
            <p id="turnstile-hinweis" style={{ fontSize: 12.5, color: "var(--text-2)", margin: "8px 0 0" }}>
              Die Sicherheitsprüfung läuft — gleich können Sie absenden.
            </p>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
        <SubmitButton blocked={Boolean(TURNSTILE_SITE_KEY) && !humanVerified} />
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>Antwort innerhalb eines Werktags</span>
      </div>
    </form>
  );
}
