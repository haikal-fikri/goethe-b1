import { fetch as streamFetch } from "expo/fetch";
import { getSupabase } from "./supabase";
import { env, apiConfigured } from "./env";

// authedFetch: hängt den Bearer-JWT an; bei 401 einmal Session refreshen + retry.
// Trusted-Server-Calls (grade persist, avatar, konto). Client-direkte
// Supabase-Reads laufen über db.ts (RLS).

async function token(): Promise<string | null> {
  const s = getSupabase();
  const { data } = (await s?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!apiConfigured()) throw new Error("API_BASE nicht konfiguriert.");
  const doFetch = async (t: string | null) =>
    fetch(`${env.apiBase}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(t ? { authorization: `Bearer ${t}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  let res = await doFetch(await token());
  if (res.status === 401) {
    await getSupabase()?.auth.refreshSession();
    res = await doFetch(await token());
  }
  return res;
}

/** Profilbild: aktuelle signierte URL holen (GET, re-signiert serverseitig). Null wenn keins/Fehler. */
export async function getAvatarUrl(): Promise<string | null> {
  if (!apiConfigured()) return null;
  const res = await authedFetch("/api/profile/avatar", { method: "GET" });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return (body?.signedUrl as string | undefined) ?? null;
}

/** Profilbild hochladen (Base64 → geroutet: resize 512² webp, EXIF-strip). Gibt die neue signierte URL zurück. */
export async function uploadAvatar(imageBase64: string): Promise<string | null> {
  const res = await authedFetch("/api/profile/avatar", { method: "POST", body: JSON.stringify({ imageBase64 }) });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(typeof body?.error === "string" ? body.error : `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const body = await res.json().catch(() => null);
  return (body?.signedUrl as string | undefined) ?? null;
}

export type GradeEvent =
  | { type: "start" }
  | { type: "examiner"; label: "mild" | "streng" }
  | { type: "third" }
  | { type: "done"; grade: unknown; examiners: unknown[]; thirdUsed: boolean; resultId: string | null; persisted: boolean }
  | { type: "error"; error: string };

/**
 * Streamt die Vier-Augen-Bewertung (NDJSON) über expo/fetch (RN-fetch kann
 * keine Streams lesen). Ruft onEvent pro Zeile — der Client rendert live.
 */
export async function gradeStream(
  taskId: string,
  answer: string,
  onEvent: (e: GradeEvent) => void
): Promise<void> {
  if (!apiConfigured()) throw new Error("API_BASE nicht konfiguriert.");
  const t = await token();
  const res = await streamFetch(`${env.apiBase}/api/exam/grade`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ taskId, answer }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = typeof body?.error === "string" ? body.error : "Die Bewertung konnte nicht gestartet werden.";
    const e = new Error(msg) as Error & { retryAfterSec?: number };
    if (body?.retryAfterSec) e.retryAfterSec = body.retryAfterSec;
    throw e;
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as GradeEvent);
        } catch {
          /* unvollständige Zeile ignorieren */
        }
      }
    }
  }
}
