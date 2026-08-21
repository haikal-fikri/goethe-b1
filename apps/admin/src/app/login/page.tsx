"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { IconShield } from "@/components/icons";
import { Button } from "@/components/ui/controls";

// Superadmin-Anmeldung. E-Mail → POST /api/auth/otp → 8-stelliger Code →
// client-seitiges verifyOtp. Ohne admin-Claim (nur via grant-role/Bootstrap
// vergeben) greifen alle C-Routen 403 — der Login mintet nur die Session.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Nur relative Same-Origin-Pfade zulassen (Open-Redirect-Schutz). Der WHATWG-
// URL-Parser (den router.replace nutzt) faltet Backslash (0x5C) UND C0-Steuer-
// zeichen (0x00–0x1F) zu "/", sodass "/\evil.com" cross-origin auflöst — daher
// zusätzlich zu "//" auch diese Zeichen ablehnen.
function safeNext(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c <= 0x1f || c === 0x5c) return "/";
  }
  return raw;
}

// requireAdmin() und /auth/confirm leiten mit diesen Parametern hierher.
const REDIRECT_ERRORS: Record<string, string> = {
  forbidden: "Dieses Konto hat keine Superadmin-Rechte. Melden Sie sich mit einem Admin-Konto an.",
  auth: "Der Anmeldelink war ungültig oder abgelaufen. Bitte fordern Sie einen neuen Code an.",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 42,
  marginTop: 6,
  borderRadius: 11,
  border: "1px solid var(--border-1)",
  background: "var(--bg)",
  padding: "0 13px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "var(--text-hi)",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-1)",
};

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next") ?? "/");
  const redirectError = REDIRECT_ERRORS[params.get("error") ?? ""] ?? null;

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

  const message = err ?? redirectError;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text-1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 26 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "var(--lila)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 38px",
              color: "#fff",
              boxShadow: "0 4px 14px color-mix(in oklab, var(--lila) 45%, transparent)",
            }}
          >
            <IconShield size={21} strokeWidth={1.9} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-hi)" }}>B1+Trainer</span>
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

        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-1)",
            borderRadius: 20,
            boxShadow: "var(--shadow-card-now)",
            padding: "26px 24px",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 24,
              fontWeight: 600,
              color: "var(--text-hi)",
              margin: "0 0 6px",
            }}
          >
            Anmelden
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-2)" }}>
            {sent
              ? `Wir haben einen Code an ${email} gesendet.`
              : "Sie erhalten einen einmaligen Code per E-Mail."}
          </p>

          {!sent ? (
            <form onSubmit={requestCode} style={{ display: "grid", gap: 16 }}>
              <label style={labelStyle}>
                E-Mail
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="focus-ring"
                  style={inputStyle}
                />
              </label>
              {SITE_KEY ? <Turnstile siteKey={SITE_KEY} onSuccess={setTsToken} /> : null}
              <Button type="submit" disabled={busy} style={{ width: "100%" }}>
                {busy ? "Sende…" : "Code senden"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} style={{ display: "grid", gap: 16 }}>
              <label style={labelStyle}>
                Code
                <input
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  className="focus-ring"
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)", letterSpacing: ".18em" }}
                />
              </label>
              <Button type="submit" disabled={busy} style={{ width: "100%" }}>
                {busy ? "Prüfe…" : "Anmelden"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSent(false);
                  setErr(null);
                }}
                style={{ width: "100%" }}
              >
                Andere E-Mail
              </Button>
            </form>
          )}

          {message ? (
            <p
              role="alert"
              style={{
                margin: "16px 0 0",
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--rot-tint)",
                color: "var(--rot-text)",
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>
          ) : null}
        </div>
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
