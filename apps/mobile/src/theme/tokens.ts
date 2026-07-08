// Theme-Tokens aus README (Design Tokens) + CLAUDE.md. NIE Hex in Komponenten
// hardcoden — immer aus dem Theme lesen. Akzente/CEFR/Radien sind über beide
// Themes geteilt; der Primary-Button invertiert (Tinte auf hell, Papier auf dunkel).

// Tints: `*TintLight` für helles Theme, `*TintDark` (transparente Akzent-Lasuren) für
// dunkles Theme. IMMER über useTheme().tint(name) lesen, nie eine Tint-Konstante direkt —
// sonst bleibt die Karte im Dark Mode hell (siehe README „Nie Hex in Komponenten").
export const accent = {
  gruen: "#1C8A5B",
  gruenAlt: "#2E9E6B",
  gruenDarkText: "#34B97E",
  gruenTintLight: "#E9F1EA",
  gruenTintDark: "rgba(46,158,107,0.18)",
  blau: "#2B7FD4",
  blauDarkText: "#5B9BE0",
  blauTintLight: "#E7F0FA",
  blauTintDark: "rgba(43,127,212,0.18)",
  lila: "#7A52D9",
  lilaDark: "#9D78E6",
  lilaTintLight: "#F0EAFA",
  lilaTintDark: "rgba(122,82,217,0.20)",
  gold: "#DD8A22",
  goldText: "#B96F12",
  goldHi: "#FFC95C",
  goldTintLight: "#FBF0DD",
  goldTintDark: "rgba(221,138,34,0.18)",
  rot: "#D6463C",
  rotText: "#C0392E",
  rotDark: "#E8776C",
  rotTintLight: "#FBE9E7",
  rotTintDark: "rgba(214,70,60,0.18)",
} as const;

export const cefr = {
  B1: "#2E9E6B",
  B2: "#2B7FD4",
  C1: "#7A52D9",
  C2: "#BE8226",
} as const;

export const radius = {
  input: 15,
  card: 18,
  cardLg: 24,
  tile: 12,
  chip: 11,
  badge: 6,
  pill: 999,
} as const;

export const fonts = {
  serif: "SourceSerif4",       // Anzeigen/Überschriften/ALLE Zahlen
  serifMed: "SourceSerif4-Med",
  ui: "Jost",                  // UI/Body/Labels/Buttons
  uiMed: "Jost-Med",
  uiSemi: "Jost-Semi",
  uiBold: "Jost-Bold",
  mono: "IBMPlexMono",         // getippter Prüfungstext
} as const;

const light = {
  bg: "#FDFBF6",
  surface: "#FFFFFF",
  surfaceSunken: "#FCFAF5",
  surfaceAlt: "#F4F0E7",
  textHi: "#211C17",
  textBody: "#4F463C",
  textMuted: "#75695C",
  textFaint: "#BCAE9C",
  border: "rgba(33,28,23,0.09)",
  borderStrong: "rgba(33,28,23,0.14)",
  track: "#EFEAE1",
  primaryBtnBg: "#1C1815",
  primaryBtnFg: "#FFFFFF",
  islandBg: "rgba(255,255,255,0.88)",
  islandBorder: "rgba(20,22,28,0.08)",
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  bg: "#15120E",
  surface: "#221D18",
  surfaceSunken: "#2E2925",
  surfaceAlt: "#2A241D",
  textHi: "#F3EEE6",
  textBody: "#C4BBAD",
  textMuted: "#928777",
  textFaint: "#6B6052",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.12)",
  track: "#332C23",
  primaryBtnBg: "#F3EEE6",
  primaryBtnFg: "#1C1815",
  islandBg: "rgba(34,29,23,0.84)",
  islandBorder: "rgba(255,255,255,0.12)", // R4: Schatten trägt auf dunklem BG kaum — Border trennt
};

export const palettes = { light, dark } as const;

export const shadow = {
  card: {
    shadowColor: "#1C1814",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  island: {
    shadowColor: "#1C1814",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, // R4: etwas mehr BG-Trennung (Schatten war zuvor iOS-geclippt)
    shadowRadius: 22,
    elevation: 10,
  },
} as const;

export const space = { screenH: 18, onboardingH: 22, scrollBottom: 104 } as const;
