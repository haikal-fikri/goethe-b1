"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Minimale, FUNKTIONALE Superadmin-Anmeldung (Phase 4). Phase 5 gestaltet neu.
// E-Mail → POST /api/auth/otp → 8-stelliger Code → client-seitiges verifyOtp.
// Ohne admin-Claim (nur via grant-role/Bootstrap vergeben) greifen alle
// C-Routen 403 — der Login mintet nur die Session.
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
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.4rem" }}>Superadmin-Anmeldung</h1>
      {!sent ? (
        <form onSubmit={requestCode} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label>
            E-Mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          {SITE_KEY ? <Turnstile siteKey={SITE_KEY} onSuccess={setTsToken} /> : null}
          <button type="submit" disabled={busy} style={{ padding: 10 }}>
            {busy ? "Sende…" : "Code senden"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <p>Wir haben einen Code an {email} gesendet.</p>
          <label>
            Code
            <input
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <button type="submit" disabled={busy} style={{ padding: 10 }}>
            {busy ? "Prüfe…" : "Anmelden"}
          </button>
          <button type="button" onClick={() => setSent(false)} style={{ padding: 6 }}>
            Andere E-Mail
          </button>
        </form>
      )}
      {err ? <p style={{ color: "#C0392E", marginTop: 12 }}>{err}</p> : null}
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
