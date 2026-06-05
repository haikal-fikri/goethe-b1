export function AppFooter() {
  return (
    <footer className="mt-10 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6">
      <div className="mx-auto max-w-5xl border-t border-[var(--border-soft)] pt-4 text-xs text-[var(--fg-dim)]">
        {/* Datenschutz & AGB folgen später auf einer separaten Landingpage. */}
        © 2026 Digi.S - Digital Sprache Stiftung
      </div>
    </footer>
  );
}
