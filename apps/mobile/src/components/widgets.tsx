import React, { useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

// RingGauge (r=40, stroke 10, serif % in der Mitte).
export function RingGauge({ value, size = 92, color, label }: { value: number; size?: number; color?: string; label?: string }) {
  const { c, accent, fonts } = useTheme();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const ac = color ?? accent.gruen;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={ac} strokeWidth={stroke} fill="none"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontFamily: fonts.serifMed, fontSize: size * 0.26, color: c.textHi }}>
        {label ?? `${Math.round(pct * 100)}%`}
      </Text>
    </View>
  );
}

// Drei konzentrische Readiness-Ringe (Apple-Stil), LEERE Mitte — je Modul ein Arc.
// Reihenfolge außen→innen entspricht `values` (Schreiben grün · Sprechen blau · Konnektoren lila).
export function ReadinessRings({ values, size = 96 }: { values: { color: string; value: number }[]; size?: number }) {
  const { c } = useTheme();
  const stroke = 8;
  const gap = 3;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        {values.map((v, i) => {
          const r = (size - stroke) / 2 - i * (stroke + gap);
          const circ = 2 * Math.PI * r;
          const pct = Math.max(0, Math.min(1, v.value));
          return (
            <React.Fragment key={i}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
              <Circle
                cx={size / 2} cy={size / 2} r={r} stroke={v.color} strokeWidth={stroke} fill="none"
                strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function Segmented<T extends string | number>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  const { c, fonts, radius } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: c.surfaceAlt, borderRadius: radius.tile, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)} onPress={() => onChange(o.value)}
            style={{
              flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: radius.tile - 3,
              backgroundColor: active ? c.surface : "transparent",
              ...(active ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : {}),
            }}
          >
            <Text style={{ fontFamily: active ? fonts.uiSemi : fonts.uiMed, fontSize: 13.5, color: active ? c.textHi : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StepDots({ total, current }: { total: number; current: number }) {
  const { accent, c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <View
            key={i}
            style={{
              height: 6, borderRadius: 3,
              width: active ? 24 : 6,
              backgroundColor: active || done ? accent.gruen : c.track,
            }}
          />
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { accent, c } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{ width: 48, height: 28, borderRadius: 999, backgroundColor: value ? accent.gruen : c.track, padding: 3, justifyContent: "center" }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: "#fff", alignSelf: value ? "flex-end" : "flex-start", ...styles.knob }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  knob: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});

// ── Inline-Monatskalender (Zukunft-only): Prüfungstermin in Onboarding + Einstellungen ──
const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`; // m 0-basiert; aus Datumsteilen (kein toISOString → keine TZ-Verschiebung)
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function Calendar({ value, onChange, minDate }: {
  value: string | null; onChange: (iso: string) => void; minDate?: Date;
}) {
  const { c, accent, fonts, radius } = useTheme();
  const min = startOfDay(minDate ?? new Date());
  const initial = value ? new Date(`${value}T00:00:00`) : new Date(); // lokal, damit der Startmonat stimmt
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const y = view.getFullYear();
  const m = view.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Montag zuerst
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const atMinMonth = y < min.getFullYear() || (y === min.getFullYear() && m <= min.getMonth());
  const shift = (delta: number) => setView(new Date(y, m + delta, 1));

  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.card, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Pressable onPress={() => !atMinMonth && shift(-1)} hitSlop={10} disabled={atMinMonth} accessibilityRole="button" accessibilityLabel="Vorheriger Monat">
          <Text style={{ fontSize: 22, color: atMinMonth ? c.textFaint : c.textMuted, paddingHorizontal: 6 }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.serifMed, fontSize: 16, color: c.textHi }}>
          {view.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Nächster Monat">
          <Text style={{ fontSize: 22, color: c.textMuted, paddingHorizontal: 6 }}>›</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS_DE.map((w) => (
          <Text key={w} style={{ flex: 1, textAlign: "center", fontFamily: fonts.uiMed, fontSize: 11, color: c.textFaint }}>{w}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
        {cells.map((day, i) => {
          if (day == null) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />;
          const iso = isoOf(y, m, day);
          const past = new Date(y, m, day) < min;
          const sel = iso === value;
          return (
            <View key={iso} style={{ width: `${100 / 7}%`, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Pressable disabled={past} onPress={() => onChange(iso)} accessibilityRole="button"
                style={{ width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: sel ? accent.gruen : "transparent" }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 14, color: sel ? "#fff" : past ? c.textFaint : c.textBody }}>{day}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
