import React, { createContext, useContext, useEffect, useState } from "react";
import type { FeatureFlags } from "@repo/types";
import { env, apiConfigured } from "./env";

// Ferngesteuerte Feature-Flags. class_enabled steuert die Klasse/Sprechen-
// Oberflächen (in v1 AUS → 4-Tab-Leiste). Einmal beim Start gelesen (gecacht);
// Umlegen ohne App-Store-Release.
// DEFAULT aus dem Dev-Override geseedet: EXPO_PUBLIC_CLASS_ENABLED=true schaltet
// den Klasse-Tab lokal an — auch wenn /api/config unerreichbar ist (Dev-LAN-IP)
// oder prod class_enabled=false liefert.
const DEFAULT: FeatureFlags = { classEnabled: env.classEnabled };
const Ctx = createContext<FeatureFlags>(DEFAULT);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT);

  useEffect(() => {
    if (env.classEnabled) return; // Dev-Override erzwingt AN → Remote-Fetch überspringen
    if (!apiConfigured()) return;
    let mounted = true;
    fetch(`${env.apiBase}/api/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (mounted && j && typeof j.classEnabled === "boolean") {
          setFlags({ classEnabled: j.classEnabled });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>;
}

export const useFeatureFlags = () => useContext(Ctx);
