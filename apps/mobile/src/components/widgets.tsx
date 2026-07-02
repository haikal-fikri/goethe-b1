import React from "react";
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
