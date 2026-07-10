// Aktuelle DPA-Version (Auftragsverarbeitungsvertrag). Die Einladungs-/Klassen-
// Erstellung prüft teacher_dpa_ok(teacher, CURRENT_DPA_VERSION); accept-dpa
// schreibt teacher_agreements mit genau dieser Version. Beide MÜSSEN denselben
// Wert benutzen. ⚠️ OWNER-CONFIRM: Versionskennung an das reale DPA-Dokument
// koppeln (bei jeder materiellen DPA-Änderung erhöhen → erzwingt Re-Accept).
export const CURRENT_DPA_VERSION = "2026-01";
