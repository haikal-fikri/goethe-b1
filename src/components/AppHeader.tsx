"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/", label: "Üben" },
  { href: "/lernen", label: "Lernen" },
  { href: "/pruefen", label: "Prüfen" },
];

export function AppHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-4 py-2.5 shadow-lg backdrop-blur-md">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="text-[15px] font-semibold tracking-tight text-[var(--fg)]"
        >
          B1-Trainer
        </Link>

        <div className="flex items-center gap-1">
          {/* Desktop-Navigation */}
          <nav className="hidden items-center gap-1 text-[13px] sm:flex">
            {LINKS.map((l) => (
              <HeaderLink key={l.href} href={l.href}>
                {l.label}
              </HeaderLink>
            ))}
          </nav>

          {/* Theme-Umschalter (Tafel ↔ Papier) — immer sichtbar */}
          <ThemeToggle />

          {/* Mobile-Hamburger (2 Linien) */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menü"
            aria-expanded={open}
            className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-md text-[var(--fg)] transition-colors hover:bg-[var(--bg-elev)] sm:hidden"
          >
            <span
              className="block h-[2px] w-5 bg-current transition-transform"
              style={
                open ? { transform: "translateY(3.5px) rotate(45deg)" } : undefined
              }
            />
            <span
              className="block h-[2px] w-5 bg-current transition-transform"
              style={
                open
                  ? { transform: "translateY(-3.5px) rotate(-45deg)" }
                  : undefined
              }
            />
          </button>
        </div>

        {/* Mobile-Menü als eigene Insel unter der Kopf-Insel (schiebt den
            Inhalt nicht nach unten) */}
        {open && (
          <nav className="animate-slide-down absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-2xl border border-[var(--border-soft)] bg-[var(--bg)] p-2 shadow-lg sm:hidden">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-2.5 py-2.5 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--fg)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

function HeaderLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elev)] hover:text-[var(--fg)]"
    >
      {children}
    </Link>
  );
}
