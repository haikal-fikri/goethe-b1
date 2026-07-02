import React, { createContext, useContext, useEffect, useState } from "react";
import type { FeatureFlags } from "@repo/types";
import { env, apiConfigured } from "./env";

// Ferngesteuerte Feature-Flags. class_enabled steuert die Klasse/Sprechen-
// Oberflächen (in v1 AUS → 4-Tab-Leiste). Einmal beim Start gelesen (gecacht);
// Umlegen ohne App-Store-Release.
const DEFAULT: FeatureFlags = { classEnabled: false };
const Ctx = createContext<FeatureFlags>(DEFAULT);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT);

  useEffect(() => {
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
