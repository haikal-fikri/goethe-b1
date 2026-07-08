import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palettes, accent, cefr, radius, fonts, shadow, space, type ThemeColors } from "./tokens";

// Folgt dem OS (useColorScheme) mit manueller Überschreibung (System/Hell/Dunkel).
export type ThemeMode = "system" | "light" | "dark";

/** Akzent-Tint-Namen für die scheme-abhängige tint()-Auflösung. */
export type TintName = "gruen" | "blau" | "lila" | "gold" | "rot";

interface ThemeCtx {
  scheme: "light" | "dark";
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  c: ThemeColors;
  accent: typeof accent;
  cefr: typeof cefr;
  radius: typeof radius;
  fonts: typeof fonts;
  shadow: typeof shadow;
  space: typeof space;
  /** Scheme-abhängiger Akzent-Tint: hell → `*TintLight`, dunkel → `*TintDark`. */
  tint: (name: TintName) => string;
}

const Ctx = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = "b1.theme.mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const os = useColorScheme() ?? "light";
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setModeState(v);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const scheme: "light" | "dark" = mode === "system" ? (os as "light" | "dark") : mode;

  const value = useMemo<ThemeCtx>(
    () => ({
      scheme,
      mode,
      setMode,
      c: palettes[scheme],
      accent,
      cefr,
      radius,
      fonts,
      shadow,
      space,
      tint: (name: TintName) =>
        (accent as Record<string, string>)[`${name}Tint${scheme === "dark" ? "Dark" : "Light"}`],
    }),
    [scheme, mode, setMode]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme muss innerhalb von ThemeProvider verwendet werden.");
  return ctx;
}
