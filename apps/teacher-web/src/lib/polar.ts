import "server-only";

// Phase 6: @polar-sh/nextjs Checkout / CustomerPortal / Webhooks (teacher-lms/05 §1).
// planForProduct maps the Polar product_id → entitlements.plan and THROWS on an
// unknown id — a mispriced/renamed product must fail loud, never silent-grant.
export function planForProduct(productId: string): "starter" | "pro" {
  if (productId && productId === process.env.POLAR_PRO_PRODUCT_ID) return "pro";
  if (productId && productId === process.env.POLAR_STARTER_PRODUCT_ID) return "starter";
  throw new Error("planForProduct(): unbekannte Polar product_id");
}
