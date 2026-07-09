// @repo/server — shared server-only primitives for the trusted-server routes
// (web · teacher-web · admin). Barrel export; apps may also import the subpaths
// "@repo/server/db" | "/log" | "/ratelimit" | "/supabaseServer".
//
// NOTE: `hkey` is defined in both ./log and ./ratelimit (identical); re-export it
// only from ./ratelimit here to avoid an ambiguous barrel re-export.
export * from "./db";
export { log, newRequestId } from "./log";
export * from "./ratelimit";
export * from "./supabaseServer";
