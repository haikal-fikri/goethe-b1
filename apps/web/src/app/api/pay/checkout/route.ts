import {
  getStripe,
  CURRENCY,
  MIN_USD,
  MAX_USD,
  toCents,
} from "@/lib/stripe";
import { enforce, getClientIp } from "@/lib/ratelimit";

// Erstellt eine Stripe-Checkout-Session für eine Pay-what-you-want-Zahlung und
// gibt die gehostete Bezahl-URL zurück. Kein Webhook nötig — es gibt nichts zu
// liefern.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json(
      { error: "STRIPE_SECRET_KEY ist nicht gesetzt." },
      { status: 500 }
    );
  }

  // Öffentliche Route: per-IP-Drossel (fail-CLOSED), damit niemand unbegrenzt
  // Stripe-Checkout-Sessions erzeugt (API-Rauschen / Missbrauch).
  const rl = await enforce("payCheckout", getClientIp(request), /* failClosed */ true);
  if (!rl.ok) {
    return Response.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { amount } = (body ?? {}) as { amount?: unknown };

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < MIN_USD ||
    amount > MAX_USD
  ) {
    return Response.json({ error: "Ungültiger Betrag." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      // Karten explizit setzen, statt auf "automatic payment methods" zu setzen
      // (die je Währung im Dashboard aktiviert sein müssen — sonst "No valid
      // payment method types"). Apple Pay / Google Pay laufen über "card" mit.
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: toCents(amount),
            product_data: { name: "B1+Trainer — Pay what you want" },
          },
        },
      ],
      success_url: `${origin}/pay/danke`,
      cancel_url: `${origin}/pay?abgebrochen=1`,
    });

    if (!session.url) {
      return Response.json(
        { error: "Checkout konnte nicht gestartet werden." },
        { status: 502 }
      );
    }

    return Response.json({ url: session.url });
  } catch (err) {
    // Generische Meldung an den Client, aber den echten Stripe-Fehler serverseitig
    // loggen (z.B. fehlende Berechtigung bei restricted keys, ungültiger Key).
    console.error("Stripe-Checkout fehlgeschlagen:", err);
    return Response.json(
      { error: "Zahlung konnte nicht gestartet werden." },
      { status: 502 }
    );
  }
}
