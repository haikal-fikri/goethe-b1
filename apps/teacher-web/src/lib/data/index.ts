// Client-direkte Daten-Zugriffsschicht (teacher-lms/03 §1, Phase 4). Reine
// RLS-gedeckte Reads/Writes über den (per DI übergebenen) SupabaseClient — kein
// service-role, keine Route. Phase-5-UI ruft diese Funktionen mit dem
// Browser-Client (client-direkt) oder Server-Client (SSR-Read) auf.
//
// Alles, was service-role verlangt (Noten, E-Mail-Einladungen, Notify-Fan-out,
// Entitlements, externe APIs), bleibt in den /api-B-Routen (lib/api.ts →
// authedFetch), NICHT hier.

export * as classesData from "./classes";
export * as scheduleData from "./schedule";
export * as assignmentsData from "./assignments";
export * as notificationsData from "./notifications";
export * as orgData from "./org";
