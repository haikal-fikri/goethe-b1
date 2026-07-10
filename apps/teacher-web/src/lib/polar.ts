import "server-only";
import { Polar } from "@polar-sh/sdk";
import { validateEvent } from "@polar-sh/sdk/webhooks";

// Polar (Merchant-of-Record) — teacher-lms/05 §1. Reine Abbildung + SDK-Wiring.
// planForProduct THROWt bei unbekannter product_id — ein umbenanntes/mispreistes
// Produkt muss LAUT scheitern, nie still die falschen Caps gewähren.
export function planForProduct(productId: string): "starter" | "pro" {
  if (productId && productId === process.env.POLAR_PRO_PRODUCT_ID) return "pro";
  if (productId && productId === process.env.POLAR_STARTER_PRODUCT_ID) return "starter";
  throw new Error("planForProduct(): unbekannte Polar product_id");
}

// SDK-agnostische Minimalform des verifizierten Webhook-Events (05 §1.3).
export interface PolarWebhookEvent {
  id: string; // Polar event id → Idempotenz (billing_events)
  type: string; // 'subscription.active' | '.updated' | '.canceled' | '.revoked' | …
  data: {
    metadata?: Record<string, unknown>; // SERVER-gestempelt beim checkout: supabase_user_id, plan
    productId?: string;
    customerId?: string;
    currentPeriodEnd?: string | null; // ISO
    subscriptionId?: string;
  };
}

export interface EntitlementPatch {
  /** nur setzen, wenn der Event den Status ändert (canceled: unverändert). */
  status?: "active" | "revoked";
  plan?: "starter" | "pro";
  currentPeriodEnd?: string | null;
  polarSubscriptionId?: string;
  polarCustomerId?: string;
  productId?: string;
  /** Rolle 'teacher' gewähren — NUR beim ersten 'active'. */
  grantTeacherRole: boolean;
  /** upsert (active) vs. update-only (updated/canceled/revoked). */
  upsert: boolean;
}

/**
 * Reine Event→Entitlement-Abbildung (05 §1.3). `null` ⇒ Event ignorieren.
 * - active   → status active + plan + period, Rolle gewähren (upsert)
 * - updated  → period-end (+ plan nur bei Produktwechsel), status unverändert
 * - canceled → NUR period-end; status BLEIBT active (cancel ≠ revoke)
 * - revoked  → status revoked (Rolle bleibt; Authority via has_active_teacher_sub)
 */
export function mapPolarEvent(ev: PolarWebhookEvent): EntitlementPatch | null {
  const d = ev.data;
  const plan = d.productId ? planForProduct(d.productId) : undefined; // THROWt bei unbekannter id
  switch (ev.type) {
    case "subscription.active":
      return {
        status: "active",
        plan,
        currentPeriodEnd: d.currentPeriodEnd ?? undefined,
        polarSubscriptionId: d.subscriptionId,
        polarCustomerId: d.customerId,
        productId: d.productId,
        grantTeacherRole: true,
        upsert: true,
      };
    case "subscription.updated":
      return {
        plan,
        currentPeriodEnd: d.currentPeriodEnd ?? undefined,
        polarSubscriptionId: d.subscriptionId,
        grantTeacherRole: false,
        upsert: false,
      };
    case "subscription.canceled":
      return {
        currentPeriodEnd: d.currentPeriodEnd ?? undefined,
        grantTeacherRole: false,
        upsert: false,
      };
    case "subscription.revoked":
      return { status: "revoked", grantTeacherRole: false, upsert: false };
    default:
      return null;
  }
}

// ── Polar API wiring (@polar-sh/sdk) ────────────────────────────────────────
// Lazy-Client: fehlendes Secret wirft erst zur Laufzeit (sauberer 503/400 in der
// Route), nie beim `next build`. server = sandbox (Default) | production.
function polarClient(): Polar {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) throw new Error("POLAR_ACCESS_TOKEN not set");
  const server = process.env.POLAR_SERVER === "production" ? "production" : "sandbox";
  return new Polar({ accessToken, server });
}

function productIdFor(plan: "starter" | "pro"): string {
  const id = plan === "pro" ? process.env.POLAR_PRO_PRODUCT_ID : process.env.POLAR_STARTER_PRODUCT_ID;
  if (!id) throw new Error(`Polar product id für Tarif '${plan}' fehlt`);
  return id;
}

/**
 * Verifiziert die Signatur (POLAR_WEBHOOK_SECRET) auf dem ROHBODY und bildet das
 * Polar-Event auf die SDK-agnostische Minimalform ab. Wirft bei ungültiger
 * Signatur/fehlendem Secret → die Route antwortet 400 OHNE Aufzeichnung.
 * Idempotenz-Schlüssel = `webhook-id`-Header (Standard-Webhooks-Zustell-ID; bei
 * Retry gleich), sonst Fallback aus Typ + Entity-ID.
 */
export function verifyPolarWebhook(rawBody: string, headers: Headers): PolarWebhookEvent {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) throw new Error("POLAR_WEBHOOK_SECRET not set");

  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerRecord[key] = value;
  });

  // Wirft WebhookVerificationError bei ungültiger Signatur.
  const event = validateEvent(rawBody, headerRecord, secret);

  const data = event.data as {
    id?: string;
    metadata?: Record<string, unknown>;
    productId?: string;
    customerId?: string;
    currentPeriodEnd?: Date | string | null;
  };
  const cpe = data.currentPeriodEnd;
  const currentPeriodEnd =
    cpe instanceof Date ? cpe.toISOString() : typeof cpe === "string" ? cpe : null;

  return {
    id: headerRecord["webhook-id"] || `${event.type}:${data.id ?? ""}`,
    type: event.type,
    data: {
      metadata: data.metadata,
      productId: data.productId,
      customerId: data.customerId,
      currentPeriodEnd,
      subscriptionId: data.id, // Subscription-Events: data IST die Subscription
    },
  };
}

/**
 * Server-initiierter Checkout. Die authentifizierte user.id wird server-seitig in
 * die Metadata gestempelt (der Webhook vertraut NUR darauf, nie der E-Mail) und
 * zusätzlich als externalCustomerId gesetzt, damit der Portal-Call den Kunden
 * ohne DB-Lookup auflöst. Gibt die gehostete Checkout-URL zurück.
 */
export async function createCheckoutUrl(opts: {
  plan: "starter" | "pro";
  userId: string;
  successUrl: string;
}): Promise<string> {
  const checkout = await polarClient().checkouts.create({
    products: [productIdFor(opts.plan)],
    successUrl: opts.successUrl,
    externalCustomerId: opts.userId,
    metadata: { supabase_user_id: opts.userId, plan: opts.plan },
  });
  return checkout.url;
}

/** Gehostetes Polar-Kundenportal (Upgrade/Downgrade/Kündigen/Karte) für die
 *  eigene user.id — aufgelöst über die beim Checkout gesetzte externalCustomerId. */
export async function createPortalUrl(opts: { userId: string }): Promise<string> {
  const session = await polarClient().customerSessions.create({
    externalCustomerId: opts.userId,
  });
  return session.customerPortalUrl;
}
