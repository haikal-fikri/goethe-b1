import "server-only";
import { experimental_transcribe as transcribe } from "ai";
import { groq } from "@ai-sdk/groq";

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

// v1 impl = @ai-sdk/groq whisper-large-v3 (D11 — reuses the existing Groq
// sub-processor + GROQ_API_KEY). Gated upstream by TRANSCRIBE_ENABLED +
// transcribe_budget_hit() (the finalize route owns both breakers).
const MODEL = "whisper-large-v3";

export const transcriber: Transcriber = {
  async transcribe(audio, hints) {
    // Die finalize-Route reicht immer einen ArrayBuffer (R2-GET → arrayBuffer);
    // ReadableStream wird der Vollständigkeit halber gepuffert.
    const buffer = audio instanceof ArrayBuffer ? audio : await new Response(audio).arrayBuffer();

    const result = await transcribe({
      model: groq.transcription(MODEL),
      audio: new Uint8Array(buffer),
      providerOptions: {
        groq: {
          // verbose_json ist PFLICHT: sonst liefert Groq kein `duration`, d. h.
          // durationInSeconds bleibt undefined → weder der 5-Minuten-Guard noch
          // das Audio-Metering (bump_usage) in /api/speaking/finalize greifen.
          responseFormat: "verbose_json",
          // Sprache fixieren spart eine Erkennungsrunde und stabilisiert dt. Text.
          ...(hints?.languageDe ? { language: "de" } : {}),
        },
      },
    });

    return {
      text: result.text,
      durationSec: result.durationInSeconds,
      model: MODEL,
    };
  },
};
