"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/controls";
import { IconArrowRight } from "@/components/icons";

// FUNKTIONALE Lehrkraft-Anmeldung. Ablauf: E-Mail → POST /api/auth/otp
// (gehärteter Proxy) → 8-stelliger Code → client-seitiges verifyOtp (setzt die
// Session-Cookies) → Redirect auf ?next. Phase 5: neu gestaltet (Design-Comp),
// Logik unverändert.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Nur relative Same-Origin-Pfade zulassen (Open-Redirect-Schutz). Der WHATWG-
// URL-Parser (den router.replace nutzt) faltet Backslash (0x5C) UND C0-Steuer-
// zeichen (0x00–0x1F, inkl. Tab/LF/CR) zu "/", sodass "/\evil.com" cross-origin
// auflöst — daher zusätzlich zu "//" auch diese Zeichen ablehnen.
function safeNext(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c <= 0x1f || c === 0x5c) return "/";
  }
  return raw;
}

const INPUT_STYLE = {
  width: "100%",
  height: 50,
  borderRadius: 14,
  border: "1px solid var(--border-1)",
  background: "var(--surface-1)",
  padding: "0 16px",
  fontSize: 15,
  color: "var(--text-hi)",
} as const;

const LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: 8,
} as const;

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next") ?? "/");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [tsToken, setTsToken] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: tsToken }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(b?.error?.message ?? "Code konnte nicht gesendet werden.");
      }
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (error) throw new Error(error.message);
      router.replace(next);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div style={{ width: 400, maxWidth: "100%" }}>
        {/* Marke */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              background: "var(--gruen)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--glow-gruen)",
            }}
          >
            <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 20, color: "#fff" }}>B1</span>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-hi)" }}>B1+Trainer</div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              Lehrkraft
            </div>
          </div>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 600,
            color: "var(--text-hi)",
            margin: "0 0 8px",
            letterSpacing: "-.01em",
          }}
        >
          Willkommen zurück
        </h1>
        <p style={{ margin: "0 0 26px", fontSize: 14.5, lineHeight: 1.55, color: "var(--text-2)" }}>
          Melden Sie sich in Ihrem Lehrkraft-Konto an, um Bewertungen und Klassen zu verwalten.
        </p>

        {!sent ? (
          <form onSubmit={requestCode}>
            <div style={LABEL_STYLE}>E-Mail</div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@schule.de"
              className="focus-ring"
              style={{ ...INPUT_STYLE, marginBottom: SITE_KEY ? 14 : 16 }}
            />
            {SITE_KEY ? (
              <div style={{ marginBottom: 16 }}>
                <Turnstile siteKey={SITE_KEY} onSuccess={setTsToken} />
              </div>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              disabled={busy}
              style={{ width: "100%", height: 52, borderRadius: 14, fontSize: 15, opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Sende…" : "Code senden"}
              {!busy ? <IconArrowRight size={18} /> : null}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.55, color: "var(--text-1)" }}>
              Wir haben einen Code an <strong style={{ color: "var(--text-hi)" }}>{email}</strong> gesendet.
            </p>
            <div style={LABEL_STYLE}>Code</div>
            <input
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              placeholder="8-stelliger Code"
              className="focus-ring"
              style={{ ...INPUT_STYLE, marginBottom: 16, letterSpacing: ".18em", fontFamily: "var(--font-mono)" }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={busy}
              style={{ width: "100%", height: 52, borderRadius: 14, fontSize: 15, marginBottom: 10, opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Prüfe…" : "Anmelden"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setSent(false)}
              style={{ width: "100%", height: 46 }}
            >
              Andere E-Mail
            </Button>
          </form>
        )}

        {err ? (
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 13.5,
              fontWeight: 500,
              color: "var(--rot-text)",
              background: "var(--rot-tint)",
              border: "1px solid color-mix(in oklab, var(--rot) 22%, transparent)",
              borderRadius: 12,
              padding: "11px 14px",
            }}
          >
            {err}
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
