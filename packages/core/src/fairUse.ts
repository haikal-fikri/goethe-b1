// Pro-Fair-Use (weiche Obergrenzen) — teacher-lms/05 §3.
// Pro hat KEINE harte Deckelung; das System ALARMIERT bei 100 % und DROSSELT
// NEUE Sprechen-Einreichungen bei 120 % der Audio-Grenze — es löscht/​blockiert
// niemals bestehende Arbeit. Reine Logik: die Zähl-Aggregation macht der
// Sweep-Cron / die Submit-Route (service-role), die ENTSCHEIDUNG fällt hier.
//
// ⚠️ ALLE ZAHLEN SIND VORGESCHLAGEN — owner-confirm vor dem Go-Live (05 §3, offen).
// Pro-Grenzen gelten pro ORGANISATION (nicht pro Sitz): der Sweep summiert über
// alle classes.org_id = <org>; diese Datei bekommt bereits die aggregierten Werte.

export interface FairUseCeilings {
  /** aktive Teilnehmende (live gezählt) */
  activeStudents: number;
  /** Klassen (live gezählt) */
  classes: number;
  /** bewertete Audiosekunden im Zeitraum (usage_counters.graded_audio_seconds) */
  gradedAudioSeconds: number;
}

/** Vorgeschlagene Pro-Obergrenzen pro Org/Monat (05 §3.1) — OWNER-CONFIRM. */
export const PRO_FAIR_USE_CEILINGS: FairUseCeilings = {
  activeStudents: 500,
  classes: 30,
  gradedAudioSeconds: 180_000, // 3000 min
};

/** ≥100 % einer Grenze ⇒ Owner alarmieren (Teilnehmende bleiben unberührt). */
export const ALERT_RATIO = 1.0;
/** ≥120 % der Audio-Grenze ⇒ NEUE Sprechen-Einreichungen drosseln (429). */
export const AUDIO_THROTTLE_RATIO = 1.2;

/** Gemessene Ist-Werte (gleiche Felder wie die Grenzen). */
export type FairUseUsage = FairUseCeilings;

export interface FairUseStatus {
  ratios: { activeStudents: number; classes: number; gradedAudioSeconds: number };
  /** irgendeine Grenze ≥100 % ⇒ Owner-Alarm (nightly sweep). */
  alert: boolean;
  /** Audio ≥120 % ⇒ neue Sprechen-Aufnahmen pausieren (live in der submit-Route). */
  throttleNewSpeaking: boolean;
  /** menschenlesbare Schlüssel der überschrittenen Grenzen (für audit_log 'fairuse.flag'). */
  breaches: Array<keyof FairUseCeilings>;
}

const ratio = (used: number, ceiling: number): number =>
  ceiling > 0 ? used / ceiling : used > 0 ? Infinity : 0;

/**
 * Wertet die Ist-Werte gegen die (owner-editierbaren) Grenzen aus. Rein — keine
 * I/O, keine Zeit: der Aufrufer liest usage_counters + Live-Zählungen und
 * übergibt sie. Der Throttle wird LIVE in der submit-Route neu bewertet (05 §3.3),
 * damit eine Lehrkraft, die Last freigibt, nicht bis zum nächsten Sweep hängt.
 */
export function fairUseStatus(
  usage: FairUseUsage,
  ceilings: FairUseCeilings = PRO_FAIR_USE_CEILINGS
): FairUseStatus {
  const ratios = {
    activeStudents: ratio(usage.activeStudents, ceilings.activeStudents),
    classes: ratio(usage.classes, ceilings.classes),
    gradedAudioSeconds: ratio(usage.gradedAudioSeconds, ceilings.gradedAudioSeconds),
  };
  const breaches = (Object.keys(ratios) as Array<keyof FairUseCeilings>).filter(
    (k) => ratios[k] >= ALERT_RATIO
  );
  return {
    ratios,
    alert: breaches.length > 0,
    throttleNewSpeaking: ratios.gradedAudioSeconds >= AUDIO_THROTTLE_RATIO,
    breaches,
  };
}
