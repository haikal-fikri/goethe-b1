import "server-only";

// Phase 6: S3-compatible presign (PUT/GET) + DeleteObject against the private
// Cloudflare R2 speaking-audio bucket (teacher-lms/02 §11, /04 §4).
// Key = speaking/{class_id}/{submission_id}/{uuid}.m4a — server-generated.
// Presign ≤300s; PUT pins Content-Length-Range (≤20MB) + Content-Type. URLs never logged.

export function presignPut(
  _key: string,
  _opts?: { maxBytes?: number; contentType?: string }
): Promise<string> {
  throw new Error("presignPut(): not implemented (Phase 6)");
}

export function presignGet(_key: string): Promise<string> {
  throw new Error("presignGet(): not implemented (Phase 6)");
}

export function deleteObject(_key: string): Promise<void> {
  throw new Error("deleteObject(): not implemented (Phase 6)");
}
