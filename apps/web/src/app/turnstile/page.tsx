"use client";

import { Turnstile } from "@marsidev/react-turnstile";

// Minimal-Seite, die NUR das Turnstile-Widget zeigt. Wird in der Mobile-App in
// einer WebView geladen; das gelöste Token wird per postMessage an React Native
// zurückgereicht (react-native-webview → onMessage). Kein natives Turnstile-SDK,
// daher dieser WebView-Umweg. Hostname dieser Seite (Vercel-Domain/localhost)
// muss in der Turnstile-Widget-Konfiguration erlaubt sein.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function post(msg: { type: "token"; token: string } | { type: "error" | "expired" }) {
  const w = window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } };
  w.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

export default function TurnstilePage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "transparent" }}>
      {SITE_KEY ? (
        <Turnstile
          siteKey={SITE_KEY}
          options={{ language: "de", theme: "auto" }}
          onSuccess={(token) => post({ type: "token", token })}
          onError={() => post({ type: "error" })}
          onExpire={() => post({ type: "expired" })}
        />
      ) : (
        <p style={{ fontFamily: "sans-serif", color: "#75695C" }}>Turnstile ist nicht konfiguriert.</p>
      )}
    </div>
  );
}
