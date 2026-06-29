// Compatibility shim: the canonical domain types now live in the shared
// @repo/types package (consumed by both apps/web and apps/mobile). This
// re-export keeps existing `@/types` imports across the web app working
// unchanged. Import from "@repo/types" directly in new code.
export * from "@repo/types";
