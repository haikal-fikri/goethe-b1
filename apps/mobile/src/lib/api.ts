import { fetch as streamFetch } from "expo/fetch";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { getSupabase } from "./supabase";
import { env, apiConfigured, lmsConfigured } from "./env";

// authedFetch: hängt den Bearer-JWT an; bei 401 einmal Session refreshen + retry.
// Trusted-Server-Calls (grade persist, avatar, konto). Client-direkte
// Supabase-Reads laufen über db.ts (RLS).

async function token(): Promise<string | null> {
  const s = getSupabase();
  const { data } = (await s?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}

// Gemeinsamer Bearer-Fetch gegen eine BASIS-URL; bei 401 einmal refreshen + retry.
// base = env.apiBase (Projekt A) ODER env.lmsApiBase (teacher-web, /api/speaking/*).
async function doAuthedFetch(base: string, path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (t: string | null) =>
    fetch(`${base}${path}`, {
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

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!apiConfigured()) throw new Error("API_BASE nicht konfiguriert.");
  return doAuthedFetch(env.apiBase, path, init);
}

/** Wie authedFetch, aber gegen das LMS-Backend (teacher-web) — selbes Supabase-Projekt,
 *  also gilt der Student-JWT; RN-fetch unterliegt keinem CORS. */
export async function authedLmsFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!lmsConfigured()) throw new Error("LMS_API_BASE nicht konfiguriert.");
  return doAuthedFetch(env.lmsApiBase, path, init);
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

// ── Sprechen-Abgabe (LMS-Backend teacher-web: submit → R2-PUT → finalize) ────
export interface LmsError extends Error {
  status?: number;
  code?: string; // apiError-Code (forbidden, rate_limited, conflict, …)
  reason?: string; // error.details.reason (z. B. "consent_required")
  retryAfterSec?: number; // aus dem Retry-After-Header
}

/** Fehler-Envelope { error:{ code, message, details } } + Retry-After-Header → LmsError. */
async function lmsThrow(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; details?: { reason?: string } } }
    | null;
  const err = new Error(body?.error?.message ?? `HTTP ${res.status}`) as LmsError;
  err.status = res.status;
  err.code = body?.error?.code;
  err.reason = body?.error?.details?.reason;
  const ra = res.headers.get("retry-after");
  if (ra) {
    const n = Number(ra);
    if (Number.isFinite(n)) err.retryAfterSec = n;
  }
  throw err;
}

/** 1) Zeile + Presign anfordern. Nur { assignmentId } — der Server erzeugt Key + Zeile. */
export async function speakingSubmit(
  assignmentId: string
): Promise<{ submissionId: string; uploadUrl: string }> {
  const res = await authedLmsFetch("/api/speaking/submit", {
    method: "POST",
    body: JSON.stringify({ assignmentId }),
  });
  if (!res.ok) return lmsThrow(res);
  return (await res.json()) as { submissionId: string; uploadUrl: string };
}

/** 2) Audio DIREKT zu R2 PUTen — KEIN Bearer; Content-Type MUSS exakt "audio/m4a" sein
 *  (sonst lehnt die signierte URL ab). uploadAsync streamt von der Platte (kein Base64). */
export async function uploadSpeakingAudio(uploadUrl: string, fileUri: string): Promise<void> {
  const res = await uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": "audio/m4a" },
  });
  if (res.status < 200 || res.status >= 300) {
    const e = new Error(`R2 PUT ${res.status}`) as LmsError;
    e.status = res.status;
    throw e;
  }
}

/** 3) Transkription auslösen (CAS recorded→scored). Serverseitig idempotent/retry-sicher. */
export async function speakingFinalize(submissionId: string): Promise<{ status: "scored" }> {
  const res = await authedLmsFetch("/api/speaking/finalize", {
    method: "POST",
    body: JSON.stringify({ submissionId }),
  });
  if (!res.ok) return lmsThrow(res);
  return (await res.json()) as { status: "scored" };
}
