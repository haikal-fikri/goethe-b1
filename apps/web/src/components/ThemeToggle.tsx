"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@/components/icons";
import { IconButton } from "@/components/ui/controls";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ size = 40 }: { size?: number }) {
  // Das Theme setzt ein Inline-Script VOR dem Paint aus localStorage — das DOM
  // (data-theme) ist der Wahrheitswert. Server und erste Client-Hydration kennen
  // es noch nicht, daher mit `null` starten und nach dem Mount korrigieren; sonst
  // weicht das Icon zwischen Server und Client ab → Hydration-Mismatch.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const label = theme === "dark" ? "Zu Papier wechseln" : "Zu Dunkel wechseln";

  return (
    <IconButton
      type="button"
      size={size}
      onClick={() => setTheme(toggleTheme())}
      aria-label={label}
      title={label}
    >
      {theme === null ? (
        // Vor dem Mount: Platzhalter gleicher Größe (kein Layout-Sprung).
        <span className="block h-[18px] w-[18px]" aria-hidden />
      ) : theme === "dark" ? (
        <IconMoon size={18} />
      ) : (
        <IconSun size={18} />
      )}
    </IconButton>
  );
}
