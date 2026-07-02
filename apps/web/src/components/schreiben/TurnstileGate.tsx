"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Ob das Turnstile-Widget aktiv ist (Site-Key zur Build-Zeit gesetzt). */
export const turnstileEnabledClient = Boolean(SITE_KEY);

export interface TurnstileGateHandle {
  reset: () => void;
}

interface Props {
  /** Token bei erfolgreicher Prüfung; null bei Ablauf/Fehler/Reset. */
  onToken: (token: string | null) => void;
}

/**
 * Rendert das Cloudflare-Turnstile-Widget — aber nur, wenn der Site-Key gesetzt
 * ist. Ohne Key ist die Komponente inert (rendert nichts) und die Einreichung
 * läuft ungehindert. Token-Tokens sind Einweg/~300 s gültig; die Elternkomponente
 * muss nach jedem Absende-Versuch `reset()` aufrufen, um ein frisches Token zu holen.
 */
export const TurnstileGate = forwardRef<TurnstileGateHandle, Props>(
  function TurnstileGate({ onToken }, ref) {
    const widget = useRef<TurnstileInstance | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          widget.current?.reset();
          onToken(null);
        },
      }),
      [onToken]
    );

    if (!SITE_KEY) return null;

    return (
      <div className="mt-3">
        <Turnstile
          ref={widget}
          siteKey={SITE_KEY}
          options={{ language: "de", theme: "auto" }}
          onSuccess={(token) => onToken(token)}
          onExpire={() => onToken(null)}
          onError={() => onToken(null)}
        />
      </div>
    );
  }
);
