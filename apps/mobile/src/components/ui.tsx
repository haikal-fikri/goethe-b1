import React from "react";
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet,
  type ViewStyle, type TextStyle, type StyleProp,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { HeartIcon } from "./icons";
import { cefr as CEFR } from "../theme/tokens";
import type { LevelScope } from "@repo/core";

// Reusable-Primitives-Schicht (README "Reusable components"). Nie Hex/px direkt
// in Screens — hier zentralisiert und aus dem Theme gelesen.

type FontRole = "serif" | "serifMed" | "ui" | "uiMed" | "uiSemi" | "uiBold" | "mono";

export function AppText({
  children, role = "ui", size = 15, color, lh, style, numberOfLines, align, onPress,
}: {
  children: React.ReactNode; role?: FontRole; size?: number; color?: string;
  lh?: number; style?: StyleProp<TextStyle>; numberOfLines?: number; align?: TextStyle["textAlign"];
  onPress?: () => void; // R5: inline-tappbare Textteile (verschachtelter Text — Pressable geht dort nicht)
}) {
  const { c, fonts } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={onPress}
      style={[
        { fontFamily: fonts[role], fontSize: size, color: color ?? c.textBody, ...(lh ? { lineHeight: lh } : {}), ...(align ? { textAlign: align } : {}) },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const { c, fonts } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.uiSemi, fontSize: 10.5, letterSpacing: 1.3, textTransform: "uppercase", color: color ?? c.textMuted }}>
      {children}
    </Text>
  );
}

export function Screen({
  children, scroll = true, pad = true, style, contentStyle,
}: {
  children: React.ReactNode; scroll?: boolean; pad?: boolean;
  style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c, space } = useTheme();
  const inner: StyleProp<ViewStyle> = [pad ? { paddingHorizontal: space.screenH } : null, contentStyle];
  return (
    <SafeAreaView edges={["top"]} style={[{ flex: 1, backgroundColor: c.bg }, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ paddingBottom: space.scrollBottom }, inner]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c, radius, shadow } = useTheme();
  const s: StyleProp<ViewStyle> = [
    { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, padding: 16 },
    shadow.card, style,
  ];
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }]}>{children}</Pressable>
  ) : (
    <View style={s}>{children}</View>
  );
}

export function PrimaryButton({ label, onPress, disabled, loading, style }: {
  label: string; onPress?: () => void; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { c, radius, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [
        { height: 54, borderRadius: radius.input, alignItems: "center", justifyContent: "center", backgroundColor: c.primaryBtnBg, opacity: disabled ? 0.45 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.primaryBtnFg} /> : <Text style={{ color: c.primaryBtnFg, fontFamily: fonts.uiSemi, fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

export function AccentButton({ label, onPress, disabled, loading, color, style }: {
  label: string; onPress?: () => void; disabled?: boolean; loading?: boolean; color?: string; style?: StyleProp<ViewStyle>;
}) {
  const { accent, radius, fonts } = useTheme();
  const bg = color ?? accent.gruen;
  return (
    <Pressable
      onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [
        { height: 54, borderRadius: radius.input, alignItems: "center", justifyContent: "center", backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: fonts.uiSemi, fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, style }: {
  label: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { c, radius, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress} disabled={disabled}
      style={({ pressed }) => [
        { height: 54, borderRadius: radius.input, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderColor: c.borderStrong, borderWidth: StyleSheet.hairlineWidth, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      <Text style={{ color: c.textHi, fontFamily: fonts.uiSemi, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function LevelBadge({ level, style }: { level: keyof typeof CEFR | string; style?: StyleProp<ViewStyle> }) {
  const { radius, fonts } = useTheme();
  const bg = (CEFR as Record<string, string>)[level] ?? CEFR.B1;
  return (
    <View style={[{ backgroundColor: bg, borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2 }, style]}>
      <Text style={{ color: "#fff", fontFamily: fonts.uiBold, fontSize: 11 }}>{level}</Text>
    </View>
  );
}

/** Herzen-Reihe (Übung + Sprechen): verbleibende grün, verlorene ausgegraut. */
export function Hearts({ start, left }: { start: number; left: number }) {
  const { accent, c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {Array.from({ length: start }).map((_, i) => (
        <HeartIcon key={i} size={18} strokeWidth={1.9} color={i < left ? accent.gruen : c.textFaint} />
      ))}
    </View>
  );
}

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const { c, accent } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, backgroundColor: c.track, borderRadius: height / 2, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: color ?? accent.gruen, borderRadius: height / 2 }} />
    </View>
  );
}

export function Chip({ label, active, color, onPress }: { label: string; active?: boolean; color?: string; onPress?: () => void }) {
  const { c, radius, fonts } = useTheme();
  const ac = color ?? c.textHi;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.chip,
        backgroundColor: active ? ac : c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth,
      }}
    >
      <Text style={{ color: active ? "#fff" : c.textMuted, fontFamily: fonts.uiMed, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

// R2-3 · Niveau-Filter (opt-in „push yourself"). Default = Prüfungsniveau; chips widen upward.
export function NiveauChips({ value, onChange, examLevel }: {
  value: LevelScope; onChange: (v: LevelScope) => void; examLevel: string;
}) {
  const { accent } = useTheme();
  const opts: { label: string; value: LevelScope }[] = [
    { label: `Mein Niveau · ${examLevel}`, value: "exam" },
    { label: "ab B2", value: "b2plus" },
    { label: "ab C1", value: "c1plus" },
    { label: "Alle", value: "all" },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {opts.map((o) => (
        <Chip key={o.value} label={o.label} active={value === o.value} color={accent.gold} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

export function ListRow({ title, subtitle, right, onPress, danger }: {
  title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean;
}) {
  const { c, fonts, accent } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? accent.rotText : c.textHi, fontFamily: fonts.uiSemi, fontSize: 15 }}>{title}</Text>
        {subtitle ? <Text style={{ color: c.textMuted, fontFamily: fonts.ui, fontSize: 12.5, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && !right ? <Chevron /> : null}
    </Pressable>
  );
}

export function Chevron() {
  const { c } = useTheme();
  return (
    <Text style={{ color: c.textFaint, fontSize: 18 }}>›</Text>
  );
}

export function Center({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  const { c } = useTheme();
  return (
    <Center>
      <ActivityIndicator color={c.textMuted} />
      {label ? <AppText color={c.textMuted} size={13} style={{ marginTop: 10 }}>{label}</AppText> : null}
    </Center>
  );
}
