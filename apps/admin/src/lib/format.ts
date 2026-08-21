// Deutsche Formatierung für Datum/Zeit/Namen. Framework-agnostisch (Server +
// Client). Zahlen im UI setzt die Serifenschrift — hier nur die Rohwerte.

const WEEKDAY = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** "vor 2 Std." / "gestern" / "vor 3 Tagen" / "gerade eben". */
export function relativeDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.round(std / 24);
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  return shortDate(iso);
}

/** "So, 6. Juli" (Wochentag · Tag · Monat). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${WEEKDAY[d.getDay()]}, ${new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
  }).format(d)}`;
}

/** "18:30" (Europe/Berlin-agnostisch — nutzt die lokale Zeit des Timestamps). */
export function timeDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Kurzform relativ zu heute für Terminlisten: "Heute 18:30" / "Morgen 09:00" / "Do 18:30". */
export function whenShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(today)) / 86400000);
  const t = timeDe(iso);
  if (days === 0) return `Heute ${t}`;
  if (days === 1) return `Morgen ${t}`;
  return `${WEEKDAY[d.getDay()]} ${t}`;
}

/** Tages-Label relativ zu heute: "Heute" / "Morgen" / "Do". */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(today)) / 86400000);
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  return WEEKDAY[d.getDay()];
}

/** true wenn der Timestamp auf den heutigen Tag fällt. */
export function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Initialen aus einem Namen ("Lena Krüger" → "LK"). */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministische Avatar-Tönung aus einem Schlüssel (Namensfarben der Roster). */
const AV_PALETTE: Array<[string, string]> = [
  ["var(--gruen-tint)", "var(--gruen)"],
  ["var(--blau-tint)", "var(--blau)"],
  ["var(--lila-tint)", "var(--lila)"],
  ["var(--gold-tint)", "var(--gold-text)"],
  ["var(--rot-tint)", "var(--rot-text)"],
];
export function avatarTint(key: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const [bg, fg] = AV_PALETTE[h % AV_PALETTE.length];
  return { bg, fg };
}
