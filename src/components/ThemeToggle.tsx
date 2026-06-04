"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// Ersetzt den theme-color-<meta>-Knoten (statt nur das content-Attribut zu
// ändern), damit iOS Safari die Notch/Statusleiste sofort neu einfärbt.
function setThemeColor(color: string) {
  document.querySelector("meta[name=theme-color]")?.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    // theme-color mitführen, damit die iPhone-Notch/Statusleiste dem Header folgt.
    // iOS Safari liest theme-color nur beim Einfügen des <meta> – ein bloßes
    // Ändern des content-Attributs wird ignoriert. Darum den Knoten ersetzen.
    setThemeColor(next === "light" ? "#ffffff" : "#17191b");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage nicht verfügbar — Theme gilt nur für diese Sitzung
    }
    setTheme(next);
  }

  // Vor dem Mount: neutraler Platzhalter gleicher Größe (kein Hydration-Mismatch).
  const label =
    theme === "light" ? "Zur Tafel wechseln" : "Zu Weiß wechseln";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--fg)]"
    >
      {theme === null ? (
        <span className="block h-[18px] w-[18px]" aria-hidden />
      ) : theme === "dark" ? (
        // Mond → Klick wechselt zu Weiß (hell)
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        // Sonne → Klick wechselt zur Tafel (dunkel)
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
