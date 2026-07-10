// Theme-Persistenz (Client). Der Flash-freie Erst-Anstrich passiert im
// Inline-Script in layout.tsx; hier nur Lesen/Umschalten zur Laufzeit.

export type Theme = "light" | "dark";
const KEY = "b1lk-theme";

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.dataset.theme as Theme) ?? "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* Storage kann blockiert sein — das Attribut ist gesetzt, das genügt. */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
