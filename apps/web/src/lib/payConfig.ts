// Pay-what-you-want-Konfiguration — von Seite und Route gemeinsam genutzt,
// damit Validierung und UI synchron bleiben. Bewusst OHNE "server-only" und
// ohne SDK-Import: PayForm.tsx (Client) importiert diese Werte.
export const CURRENCY = "usd";
export const PRESET_AMOUNTS = [3, 5, 10, 20] as const; // in Dollar

// Der Betreiber trägt die Zahlungsgebühr selbst (kein Aufschlag auf den Betrag
// des Zahlenden). MIN_USD ist der kleinste Betrag, bei dem dem Betreiber nach
// Gebühren noch >= 1 $ bleibt.
export const MIN_USD = 1.5;
export const MAX_USD = 1000;

// USD ist zweistellig (Cent). Bei Wechsel auf eine nullstellige Währung (z.B.
// IDR) diese Umrechnung entfernen.
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}
