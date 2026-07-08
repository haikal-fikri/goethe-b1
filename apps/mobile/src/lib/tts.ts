import * as Speech from "expo-speech";
import { setAudioModeAsync } from "expo-audio";

// R1: iOS-Default-Session (soloAmbient) respektiert den Stummschalter → expo-speech-TTS ist
// lautlos, bis jemand die Session umkonfiguriert (z. B. expo-speech-recognition beim Mikro).
// Einmalig auf Playback umstellen (playsInSilentMode → Kategorie .playback, allowsRecording
// bleibt false — .playAndRecord wäre die leisere Route). Android: playsInSilentMode ist Default.
// In-Flight-Promise cachen (kein bloßes Flag) — sonst kehrt ein gleichzeitiger Aufrufer sofort
// zurück, während der Session-Wechsel noch läuft, und der erste Play spräche in der stummen
// Default-Session. Alle Aufrufer warten auf DIESELBE Promise.
let pending: Promise<void> | null = null;
export function ensureSpeechAudioMode(): Promise<void> {
  if (!pending) {
    pending = setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" })
      .catch(() => { pending = null; }); // Fehler → beim nächsten Aufruf erneut versuchen
  }
  return pending;
}

/** Nach STT aufrufen: expo-speech-recognition hinterlässt .playAndRecord + mode
 *  "measurement" (leiser) und stellt nichts zurück → nächste TTS setzt die Session neu. */
export function resetSpeechAudioMode(): void {
  pending = null;
}

/** TTS auf Deutsch — stellt vorher sicher, dass die Session hörbar ist. */
export async function speakDe(text: string, rate = 1): Promise<void> {
  await ensureSpeechAudioMode();
  Speech.speak(text, { language: "de-DE", rate });
}
