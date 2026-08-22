import type { CSSProperties } from "react";

/**
 * Die beiden schwarzen Store-Buttons. Erscheinen im mobilen Menü (schmaler)
 * und am Fuß der „Mobile App"-Karte auf /loesungen (etwas mehr Innenabstand) —
 * beide Werte stammen aus dem Design.
 */
type Props = {
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  variant?: "drawer" | "card";
};

const badgeBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  height: 50,
  borderRadius: 14,
  border: "1px solid #000",
  background: "#000",
  color: "#fff",
};

export function StoreBadges({ appStoreUrl, playStoreUrl, variant = "drawer" }: Props) {
  const padding = variant === "drawer" ? "0 12px" : "0 16px";
  const labelStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.2,
    ...(variant === "drawer" ? { minWidth: 0 } : {}),
  };
  const containerStyle: CSSProperties =
    variant === "drawer"
      ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }
      : {
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 26,
          paddingTop: 22,
          borderTop: "1px solid var(--border-1)",
        };

  return (
    <div style={containerStyle}>
      <a
        href={appStoreUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...badgeBase, padding }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style={{ flex: "0 0 19px" }} aria-hidden="true">
          <path d="M16.4 12.9c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.7.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.7.7c1.1 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.2-.9-2.2-3.2zM14.3 5.9c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2z" />
        </svg>
        <span style={labelStyle}>
          <span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}>
            Laden im
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>App Store</span>
        </span>
      </a>
      <a
        href={playStoreUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...badgeBase, padding }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style={{ flex: "0 0 19px" }} aria-hidden="true">
          <path d="M4.2 2.6c-.3.3-.4.7-.4 1.3v16.2c0 .6.1 1 .4 1.3l9-9.4-9-9.4zm10.1 8.3l2.6-2.7-8.4-4.8c-.5-.3-.9-.3-1.2-.1l7 7.6zm0 2.2l-7 7.6c.3.2.7.2 1.2-.1l8.4-4.8-2.6-2.7zm5.4-2.1l-2.1-1.2-2.8 2.2 2.8 2.2 2.1-1.2c.7-.4.7-1.6 0-2z" />
        </svg>
        <span style={labelStyle}>
          <span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}>
            Jetzt bei
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>Google Play</span>
        </span>
      </a>
    </div>
  );
}
