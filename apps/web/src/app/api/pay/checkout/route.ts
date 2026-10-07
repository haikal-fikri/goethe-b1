import { MIN_USD, MAX_USD } from "@/lib/payConfig";
import { createTipCheckoutUrl } from "@/lib/polar";
import { enforce, getClientIp } from "@/lib/ratelimit";

// Erstellt eine Polar-Checkout-Session für eine Pay-what-you-want-Zahlung und
// gibt die gehostete Bezahl-URL zurück. Kein Webhook nötig — es gibt nichts zu
// liefern.
export async function POST(request: Request) {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return Response.json(
      { error: "POLAR_ACCESS_TOKEN ist nicht gesetzt." },
      { status: 500 }
    );
  }

  // Öffentliche Route: per-IP-Drossel (fail-CLOSED), damit niemand unbegrenzt
  // Checkout-Sessions erzeugt (API-Rauschen / Missbrauch).
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
    const url = await createTipCheckoutUrl({
      amountUsd: amount,
      successUrl: `${origin}/pay/danke`,
      // Polar kennt keine cancel_url; returnUrl rendert einen Zurück-Button
      // in der Bezahlseite.
      returnUrl: `${origin}/pay?abgebrochen=1`,
    });

    return Response.json({ url });
  } catch (err) {
    // Generische Meldung an den Client, aber den echten Polar-Fehler serverseitig
    // loggen (z.B. fehlende Token-Scopes, falsche/unbekannte product_id).
    console.error("Polar-Checkout fehlgeschlagen:", err);
    return Response.json(
      { error: "Zahlung konnte nicht gestartet werden." },
      { status: 502 }
    );
  }
}
