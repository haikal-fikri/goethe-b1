import React from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, AccentButton, Card } from "../../components/ui";
import { CheckCircle, FlameIcon } from "../../components/icons";

// ★ Übung abgeschlossen (neu, nicht im 34-Screen-Set). Set-Abschluss-Feier:
// Erstversuch X/Y, Herzen übrig, Punkte, „Makellos"-Badge, Readiness-Δ.
// Läuft auf dem Root-Stack ÜBER den Tabs (kein Island) — Fixed-Layout.
export function UebungAbgeschlossenScreen() {
  const { c, accent, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const p = route.params ?? {};
  const firstTryOk: number = p.firstTryOk ?? 0;
  const total: number = p.total ?? 0;
  const heartsLeft: number = p.heartsLeft ?? 0;
  const heartsStart: number = p.heartsStart ?? 3;
  const points: number = p.points ?? 0;
  const flawless: boolean = p.flawless ?? false;
  const deltaReadiness: number | null = p.deltaReadiness ?? null;
  const dailyMixBonus: number = p.dailyMixBonus ?? 0;

  const Stat = ({ value, label }: { value: string; label: string }) => (
    <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
      <AppText role="serif" size={24} color={c.textHi}>{value}</AppText>
      <AppText size={11.5} color={c.textMuted}>{label}</AppText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 22, paddingTop: 90, alignItems: "center" }}>
      <View style={{ width: 84, height: 84, borderRadius: 999, backgroundColor: accent.gruen + "1A", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle size={52} color={accent.gruen} />
      </View>
      <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 18 }}>Übung abgeschlossen!</AppText>
      <AppText size={14} color={c.textMuted} style={{ marginTop: 4 }}>+{points} Punkte</AppText>
      {dailyMixBonus > 0 && (
        <AppText role="uiSemi" size={13.5} color={accent.goldText} style={{ marginTop: 2 }}>+{dailyMixBonus} · Tagesmix</AppText>
      )}

      {flawless && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: accent.goldTintLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
          <FlameIcon size={15} />
          <AppText role="uiSemi" size={13} color={accent.goldText}>Makellos — keine Herzen verloren</AppText>
        </View>
      )}

      <Card style={{ marginTop: 22, alignSelf: "stretch", flexDirection: "row", paddingVertical: 16 }}>
        <Stat value={`${firstTryOk}/${total}`} label="Erstversuch" />
        <View style={{ width: 1, backgroundColor: c.border }} />
        <Stat value={`${heartsLeft}/${heartsStart}`} label="Herzen" />
        <View style={{ width: 1, backgroundColor: c.border }} />
        <Stat value={deltaReadiness != null ? `+${deltaReadiness}%` : "—"} label="Bereitschaft" />
      </Card>

      <View style={{ flex: 1 }} />
      <AccentButton label="Weiter" onPress={() => nav.goBack()} style={{ alignSelf: "stretch", marginBottom: 40 }} />
    </View>
  );
}
