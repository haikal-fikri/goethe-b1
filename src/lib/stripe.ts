import Stripe from "stripe";

// Lazy-Singleton: erst beim ersten Aufruf instanziiert, damit der Build (und
// Routen ohne Bezahlung) nicht am fehlenden Key scheitern. Wirft eine klare
// Meldung, falls STRIPE_SECRET_KEY fehlt — analog zum GROQ_API_KEY-Guard in
// src/app/api/exam/grade/route.ts.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt.");
  }
  cached = new Stripe(key);
  return cached;
}

// Pay-what-you-want-Konfiguration — von Seite und Route gemeinsam genutzt,
// damit Validierung und UI synchron bleiben.
export const CURRENCY = "usd";
export const PRESET_AMOUNTS = [3, 5, 10, 20] as const; // in Dollar
export const MIN_USD = 1;
export const MAX_USD = 1000;

// USD ist zweistellig (Cent). Bei Wechsel auf eine nullstellige Währung (z.B.
// IDR) diese Umrechnung entfernen.
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}
