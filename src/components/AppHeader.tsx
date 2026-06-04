import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight text-[var(--fg)]">
            Redemittel-Trainer
          </span>
          <span className="text-[11px] text-[var(--fg-dim)]">
            Goethe B1 · Schreiben &amp; Sprechen
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-[13px]">
          <HeaderLink href="/">Üben</HeaderLink>
          <HeaderLink href="/nachschlagen">Nachschlagen</HeaderLink>
          <HeaderLink href="/schreiben">Schreiben</HeaderLink>
        </nav>
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
