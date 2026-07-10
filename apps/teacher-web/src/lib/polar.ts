import "server-only";

// Polar (Merchant-of-Record) — teacher-lms/05 §1. Reine Abbildung + Phase-6-Seams.
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

// ── Phase-6-Seams (@polar-sh/nextjs · Polar API) ────────────────────────────
// Bis zur Verdrahtung werfen sie → checkout/portal 503, webhook 400 (Signatur).
export function verifyPolarWebhook(_rawBody: string, _headers: Headers): PolarWebhookEvent {
  throw new Error("verifyPolarWebhook(): not implemented (Phase 6)");
}
export function createCheckoutUrl(_opts: {
  plan: "starter" | "pro";
  userId: string;
  successUrl: string;
}): Promise<string> {
  throw new Error("createCheckoutUrl(): not implemented (Phase 6)");
}
export function createPortalUrl(_opts: { userId: string }): Promise<string> {
  throw new Error("createPortalUrl(): not implemented (Phase 6)");
}
