import { z } from "zod";
import sharp from "sharp";
import { apiError } from "@repo/core";
import { requireUser, RateLimitError, supabaseService, supabaseServiceConfigured } from "@/lib/supabaseServer";
import { enforce } from "@/lib/ratelimit";
import { log, newRequestId } from "@/lib/log";

export const runtime = "nodejs";

// Geroutet (nicht client-direkt): dekodiert, prüft Magic-Bytes (nicht die
// Client-MIME), skaliert ≤512², RE-KODIERT nach webp (strippt EXIF/GPS),
// ≤2 MB, {jpeg,png,webp} — kein SVG. Schreibt in den PRIVATEN avatars-Bucket;
// profiles.avatar_url (Objektschlüssel) wird serverseitig gesetzt (Client-
// insert/update auf die Spalte ist entzogen). Reads via signierte URL.
const MAX_BYTES = 2 * 1024 * 1024;
const schema = z.object({ imageBase64: z.string().min(16).max(Math.ceil(MAX_BYTES * 1.4)) });

export async function POST(request: Request) {
  const requestId = newRequestId();
  let auth: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    auth = await requireUser(request);
  } catch (e) {
    if (e instanceof RateLimitError) return apiError(429, "rate_limited", "Zu viele Anfragen.", { requestId, retryAfter: e.retryAfterSec });
    throw e;
  }
  if (!auth) return apiError(401, "unauthorized", "Nicht autorisiert.", { requestId });
  if (!supabaseServiceConfigured()) return apiError(503, "internal_error", "Uploads derzeit nicht verfügbar.", { requestId });

  const g = await enforce("avatarUser", auth.user.id);
  if (!g.ok) return apiError(429, "rate_limited", "Zu viele Uploads. Bitte später erneut.", { requestId, retryAfter: g.retryAfterSec });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "bad_request", "Ungültige Anfrage.", { requestId });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(422, "validation_failed", "Ungültiges Bild.", { requestId });

  const raw = parsed.data.imageBase64.replace(/^data:[^;]+;base64,/, "");
  let input: Buffer;
  try {
    input = Buffer.from(raw, "base64");
  } catch {
    return apiError(400, "bad_request", "Ungültige Bilddaten.", { requestId });
  }
  if (input.byteLength > MAX_BYTES) return apiError(413, "payload_too_large", "Bild ist zu groß (max. 2 MB).", { requestId });

  // Magic-Bytes über sharp-Metadaten (nicht die Client-MIME) — SVG/andere → 415.
  let webp: Buffer;
  try {
    const meta = await sharp(input, { failOn: "error" }).metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
      return apiError(415, "unsupported_media_type", "Nur JPEG, PNG oder WebP erlaubt.", { requestId });
    }
    webp = await sharp(input)
      .rotate() // EXIF-Orientierung anwenden, dann Metadaten verwerfen
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer(); // Re-Encode strippt EXIF/GPS
  } catch {
    return apiError(415, "unsupported_media_type", "Bild konnte nicht verarbeitet werden.", { requestId });
  }

  const key = `${auth.user.id}/current.webp`;
  const service = supabaseService();
  const up = await service.storage.from("avatars").upload(key, webp, {
    contentType: "image/webp",
    upsert: true,
  });
  if (up.error) {
    log("profile/avatar", { requestId, userId: auth.user.id, ok: false, err: up.error.message });
    return apiError(502, "upstream_error", "Upload fehlgeschlagen.", { requestId });
  }

  // avatar_url serverseitig setzen (Client-Schreibrecht auf die Spalte ist entzogen).
  const upd = await service.from("profiles").update({ avatar_url: key }).eq("id", auth.user.id);
  if (upd.error) {
    log("profile/avatar", { requestId, userId: auth.user.id, ok: false, err: upd.error.message });
    return apiError(502, "upstream_error", "Profil konnte nicht aktualisiert werden.", { requestId });
  }

  const signed = await service.storage.from("avatars").createSignedUrl(key, 3600);
  log("profile/avatar", { requestId, userId: auth.user.id, ok: true });
  return Response.json(
    { avatarKey: key, signedUrl: signed.data?.signedUrl ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Re-signiert den gespeicherten avatar_url-Schlüssel (signierte URLs verfallen nach ~1 h),
// damit der Client das Profilbild auch nach App-Neustarts anzeigen kann. Kein Body.
export async function GET(request: Request) {
  const requestId = newRequestId();
  let auth: Awaited<ReturnType<typeof requireUser>> = null;
  try {
    auth = await requireUser(request);
  } catch (e) {
    if (e instanceof RateLimitError) return apiError(429, "rate_limited", "Zu viele Anfragen.", { requestId, retryAfter: e.retryAfterSec });
    throw e;
  }
  if (!auth) return apiError(401, "unauthorized", "Nicht autorisiert.", { requestId });
  if (!supabaseServiceConfigured()) return apiError(503, "internal_error", "Nicht verfügbar.", { requestId });

  const service = supabaseService();
  const { data: prof } = await service.from("profiles").select("avatar_url").eq("id", auth.user.id).maybeSingle();
  const key = prof?.avatar_url ?? null;
  if (!key) return Response.json({ avatarKey: null, signedUrl: null }, { headers: { "Cache-Control": "no-store" } });

  const signed = await service.storage.from("avatars").createSignedUrl(key, 3600);
  return Response.json(
    { avatarKey: key, signedUrl: signed.data?.signedUrl ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
