// Theme-Persistenz (Client). Der flash-freie Erst-Anstrich passiert im
// Inline-Script in layout.tsx; hier nur Lesen/Umschalten zur Laufzeit.
// Der Schlüssel bleibt 'theme' (eigener Origin, keine Migration nötig).

export type Theme = "light" | "dark";
const KEY = "theme";

/** Papier (hell) / warmes Dunkel — passend zur theme-color-Meta. */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#fdfbf6",
  dark: "#15120e",
};

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// Ersetzt den theme-color-<meta>-Knoten (statt nur das content-Attribut zu
// ändern), damit iOS Safari die Notch/Statusleiste sofort neu einfärbt — ein
// bloßes Ändern von content wird dort ignoriert.
function setThemeColor(color: string): void {
  document.querySelector("meta[name=theme-color]")?.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  setThemeColor(THEME_COLOR[theme]);
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
