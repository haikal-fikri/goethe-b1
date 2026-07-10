"use client";
import { useState } from "react";
import { IconLogout } from "@/components/icons";

// Abmelden: echtes Form-POST auf die bestehende Route /auth/signout. Diese ruft
// server-seitig supabase.auth.signOut() (löscht die Session-Cookies) und
// 303-redirectet auf /login. Ein Voll-Navigations-POST folgt dem Redirect nativ.
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <form action="/auth/signout" method="post" onSubmit={() => setBusy(true)}>
      <button
        type="submit"
        disabled={busy}
        className="press"
        style={{
          width: "100%",
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          borderRadius: 13,
          border: "1px solid color-mix(in oklab, var(--rot) 30%, transparent)",
          background: "var(--rot-tint)",
          color: "var(--rot-text)",
          fontSize: 14,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <IconLogout size={17} />
        {busy ? "Wird abgemeldet…" : "Abmelden"}
      </button>
    </form>
  );
}
