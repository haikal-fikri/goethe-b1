"use client";
import type { ReactNode } from "react";

// Geteilte Modal-Hülle (Overlay + zentrierte Token-Karte) — spiegelt
// components/review/FreigebenModal. Genutzt von den Klassen-Dialogen.
export function ModalShell({
  children,
  onClose,
  busy,
  width = 460,
}: {
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  width?: number;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div
        onClick={busy ? undefined : onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(20,17,12,.42)", backdropFilter: "blur(3px)" }}
      />
      <div
        style={{
          position: "relative",
          width,
          maxWidth: "100%",
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: 22,
          boxShadow: "var(--shadow-island)",
          padding: 26,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalError({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        background: "var(--rot-tint)",
        color: "var(--rot-text)",
        borderRadius: 12,
        padding: "10px 13px",
        fontSize: 13,
        lineHeight: 1.5,
        marginBottom: 14,
      }}
    >
      {message}
    </div>
  );
}
