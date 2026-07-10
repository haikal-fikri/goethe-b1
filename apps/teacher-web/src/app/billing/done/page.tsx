"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Post-Checkout-Landung (Polar successUrl). Bewusst AUSSERHALB der (app)-Gruppe,
// damit ein noch nicht aktualisiertes Konto (JWT trägt bis zum Re-Issue noch
// 'student') die Seite erreicht, ohne vom Rollen-Gate nach /willkommen geworfen
// zu werden. Der Polar-Webhook vergibt die Rolle asynchron; wir pollen einen
// Session-Refresh (der re-mintet das Access-Token mit dem neuen app_metadata),
// bis 'teacher' erscheint → dann ins Portal. Sonst nach Timeout Re-Login-Hinweis.
const MAX_TRIES = 6;
const INTERVAL_MS = 2500;

export default function BillingDonePage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React-StrictMode-Doppel-Effekt absichern
    started.current = true;
    let cancelled = false;

    (async () => {
      const sb = supabaseBrowser();
      for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        const { data, error } = await sb.auth.refreshSession();
        if (cancelled) return;
        if (error || !data.user) {
          // Keine gültige Session → normal anmelden.
          router.replace("/login?next=/dashboard");
          return;
        }
        const role = (data.user.app_metadata?.role as string | undefined) ?? "student";
        if (role === "teacher" || role === "admin") {
          router.replace("/dashboard");
          return;
        }
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
      }
      if (!cancelled) setTimedOut(true);
    })();

    return () => {
      cancelled = true;
      // Guard zurücksetzen, damit der StrictMode-Remount (Dev) eine frische
      // Schleife startet — sonst tötet das Cleanup die einzige laufende Schleife,
      // während der Guard eine neue verhindert → Dauer-Hänger auf „wird aktiviert…".
      started.current = false;
    };
  }, [router]);

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
      <div
        style={{
          width: 440,
          maxWidth: "100%",
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: 20,
          boxShadow: "var(--shadow-card-now)",
          padding: "34px 30px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            margin: "0 auto 18px",
            background: "var(--gruen-tint)",
            color: "var(--gruen)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 8px" }}>
          Zahlung erhalten
        </h1>

        {!timedOut ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-2)" }}>
            Vielen Dank. Ihr Lehrkraft-Zugang wird gerade aktiviert — einen Moment bitte…
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "var(--text-2)" }}>
              Ihre Zahlung war erfolgreich. Die Aktivierung dauert einen Augenblick länger als üblich —
              melden Sie sich bitte erneut an, um Ihren Zugang zu laden.
            </p>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="btn-primary press"
                style={{
                  height: 46,
                  padding: "0 20px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--primary-btn-bg)",
                  color: "var(--primary-btn-fg)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Erneut anmelden
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
