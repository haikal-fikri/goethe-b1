import {
  getStripe,
  CURRENCY,
  MIN_USD,
  MAX_USD,
  toCents,
} from "@/lib/stripe";

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
  } catch {
    return Response.json(
      { error: "Zahlung konnte nicht gestartet werden." },
      { status: 502 }
    );
  }
}
