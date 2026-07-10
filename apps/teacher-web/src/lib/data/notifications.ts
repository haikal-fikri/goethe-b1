import type { SupabaseClient } from "@supabase/supabase-js";

// Client-direkte Benachrichtigungen unter RLS (teacher-lms/03 #21,22). Lesen:
// "notif select own" (user_id = auth.uid()). Als gelesen markieren: "notif mark
// read" — die SPALTEN-GRANT (grant update (read_at)) erlaubt ausschließlich
// read_at. Insert/Delete sind revoked (notify() fächert service-role auf).

export function listNotifications(sb: SupabaseClient, limit = 50) {
  return sb
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
}

export function countUnread(sb: SupabaseClient) {
  return sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
}

export function markRead(sb: SupabaseClient, notificationId: string) {
  return sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select()
    .single();
}

/** Alle ungelesenen des Aufrufers als gelesen markieren. */
export function markAllRead(sb: SupabaseClient) {
  return sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .select("id");
}
