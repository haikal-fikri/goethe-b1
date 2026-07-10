// Client-direkte Superadmin-Oversight-Datenschicht (teacher-lms/03 #29, Phase 4).
// Reine is_admin()-RLS-Reads über den (per DI übergebenen) SupabaseClient. Jeder
// Admin-WRITE bleibt in den /api/admin-Routen (lib/api.ts → authedFetch).
export * as oversight from "./oversight";
