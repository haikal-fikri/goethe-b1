const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Alle Datumsangaben der Website werden in deutscher Ortszeit gelesen. */
const TIME_ZONE = "Europe/Berlin";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/**
 * „12. August 2026" — dieselbe Schreibweise wie im Design.
 *
 * Fest auf Europe/Berlin, nicht auf UTC und nicht auf die Zeitzone des
 * Build-Rechners. Beides wäre falsch:
 *  · UTC verschiebt Redaktionsangaben um einen Tag — das Admin speichert bei
 *    „12. August" in deutscher Sommerzeit 2026-08-11T22:00:00Z.
 *  · Die Zeitzone des Build-Rechners macht das Ergebnis vom Ort des Builds
 *    abhängig.
 * Der Monatsname kommt aus der eigenen Liste, damit die Schreibweise exakt der
 * des Designs entspricht (Intl liefert je nach ICU-Version „Aug." o. Ä.).
 */
export function formatGermanDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const day = get("day");
  const month = get("month");
  const year = get("year");
  if (!day || !month || !year) return "";

  return `${day}. ${MONTHS_DE[month - 1]} ${year}`;
}

/** Für <time dateTime="…"> und Structured Data. */
export function isoDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

/**
 * Gegenstück zum Seed: „12. August 2026" → ISO-Zeitpunkt.
 *
 * Gesetzt wird 12:00 UTC, nicht Mitternacht: Damit liegt der Zeitpunkt in jeder
 * Zeitzone der Welt am selben Kalendertag, egal ob jemand die Angabe später in
 * Berlin, London oder Los Angeles anzeigt. Wirft bewusst, statt still ein
 * falsches Datum zu erzeugen.
 */
export function parseGermanDate(input: string): string {
  const match = /^(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/.exec(input.trim());
  if (!match) throw new Error(`Unlesbares Datum: „${input}“`);
  const [, day, monthName, year] = match;
  const monthIndex = MONTHS_DE.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
  if (monthIndex < 0) throw new Error(`Unbekannter Monat: „${monthName}“`);
  return new Date(Date.UTC(Number(year), monthIndex, Number(day), 12)).toISOString();
}
