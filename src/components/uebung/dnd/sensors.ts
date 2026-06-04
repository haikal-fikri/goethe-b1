import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

/**
 * Sensoren für die Übungen. Die Aktivierungs-Schwellen sorgen dafür, dass ein
 * kurzer Tipp NICHT als Ziehen interpretiert wird — so funktionieren Tippen
 * (überall) und Ziehen (Maus/Finger) auf demselben Element nebeneinander.
 *  - Maus/Stift: erst nach 5 px Bewegung
 *  - Finger: erst nach 150 ms Halten (Tippen bleibt also ein Tippen, Scrollen frei)
 *  - Tastatur: für Barrierefreiheit
 */
export function useExerciseSensors({ keyboard = true }: { keyboard?: boolean } = {}) {
  const pointer = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touch = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  // Bei der Wortbank ist die Tastatur dem globalen Enter/Ziffern-Handler
  // vorbehalten, daher dort ohne KeyboardSensor.
  return useSensors(
    ...(keyboard ? [pointer, touch, keyboardSensor] : [pointer, touch])
  );
}
