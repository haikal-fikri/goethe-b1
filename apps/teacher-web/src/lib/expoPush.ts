import "server-only";

// Phase 6: Expo push fan-out (EXPO_ACCESS_TOKEN, teacher-lms/02 §4). Best-effort —
// the in-app notifications row is always the source of truth.
export interface PushMessage {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export function sendPush(_messages: PushMessage[]): Promise<void> {
  throw new Error("sendPush(): not implemented (Phase 6)");
}
