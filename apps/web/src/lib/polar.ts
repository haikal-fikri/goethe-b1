import "server-only";
import { Polar } from "@polar-sh/sdk";
import { toCents } from "@/lib/payConfig";

// Polar (Merchant-of-Record) — Pay-what-you-want auf /pay. Lazy-Singleton:
// erst beim ersten Aufruf instanziiert, damit der Build (und Routen ohne
// Bezahlung) nicht am fehlenden Token scheitern.
// ACHTUNG: server fällt auf "sandbox" zurück, wenn POLAR_SERVER nicht exakt
// "production" ist — dasselbe Verhalten wie in apps/teacher-web.
let cached: Polar | null = null;

function polarClient(): Polar {
  if (cached) return cached;
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN ist nicht gesetzt.");
  }
  cached = new Polar({
    accessToken,
    server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
  });
  return cached;
}

// Erstellt eine Polar-Checkout-Session für das Pay-what-you-want-Produkt und
// gibt die gehostete Bezahl-URL zurück. `amount` ist in Cent und überschreibt
// den Vorgabebetrag des Produkts (custom pricing).
export async function createTipCheckoutUrl(opts: {
  amountUsd: number;
  successUrl: string;
  returnUrl: string;
}): Promise<string> {
  const productId = process.env.POLAR_PAYW_PRODUCT_ID;
  if (!productId) {
    throw new Error("POLAR_PAYW_PRODUCT_ID ist nicht gesetzt.");
  }
  const checkout = await polarClient().checkouts.create({
    products: [productId],
    amount: toCents(opts.amountUsd),
    successUrl: opts.successUrl,
    returnUrl: opts.returnUrl,
  });
  return checkout.url;
}
