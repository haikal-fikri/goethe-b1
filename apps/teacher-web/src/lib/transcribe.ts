import "server-only";

// Swappable STT seam (teacher-lms/04 §5.1). The finalize route depends only on
// the Transcriber interface, so replacing Groq Whisper (or adding a fallback)
// touches one module. Speechace (04 §7) is ADDITIVE, not a swap.
export interface TranscriptResult {
  text: string;
  durationSec?: number;
  model: string;
}
export interface Transcriber {
  transcribe(
    audio: ArrayBuffer | ReadableStream,
    hints?: { languageDe?: boolean }
  ): Promise<TranscriptResult>;
}

// Phase 6: v1 impl = @ai-sdk/groq whisper-large-v3 (D11 — reuses the existing
// Groq sub-processor). Gated by TRANSCRIBE_ENABLED + transcribe_budget_hit().
export const transcriber: Transcriber = {
  transcribe() {
    throw new Error("transcribe(): not implemented (Phase 6)");
  },
};
