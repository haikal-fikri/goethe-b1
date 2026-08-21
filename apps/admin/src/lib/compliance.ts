/**
 * Aktuelle AVV-Version (Auftragsverarbeitungsvertrag).
 *
 * ⚠️ MUSS mit `apps/teacher-web/src/lib/compliance.ts` übereinstimmen. Dort ist
 * sie die Autorität: `teacher_dpa_ok(teacher, CURRENT_DPA_VERSION)` gated dort
 * Klassenanlage und Einladungen. Hier zählt sie nur, WER noch zustimmen muss.
 *
 * Läuft der Wert auseinander, meldet die Konsole stillschweigend falsche
 * Compliance-Zahlen (die Lehrkräfte haben zugestimmt, nur eben einer anderen
 * Version). Beim Erhöhen der Version also beide Dateien anfassen — oder die
 * Konstante nach @repo/core ziehen.
 */
export const CURRENT_DPA_VERSION = "2026-01";
