import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme/ThemeProvider";
import { HomeIcon, GridIcon, ClipboardIcon, ChartIcon, PeopleIcon } from "../components/icons";

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  Heute: HomeIcon, Ueben: GridIcon, Pruefen: ClipboardIcon, Fortschritt: ChartIcon, Klasse: PeopleIcon,
};
const LABELS: Record<string, string> = { Heute: "Heute", Ueben: "Üben", Pruefen: "Prüfen", Fortschritt: "Fortschritt", Klasse: "Klasse" };

// Custom "island" — schwebende Pille mit Blur; aktiver Tab = grünes Quadrat +
// weißes Glyph. v1: 4 Items (Klasse-Tab per class_enabled ausgeblendet).
// R4: iOS clippt Layer-Schatten bei overflow:hidden auf demselben View → Schatten
// auf einen Wrapper (eigener BG = Schattenpfad + Android-Elevation), Blur bleibt geclippt.
export function IslandTabBar({ state, navigation }: BottomTabBarProps) {
  const { scheme, c, accent, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View style={[styles.shadow, shadow.island, { backgroundColor: c.islandBg }]}>
      <BlurView intensity={28} tint={scheme === "dark" ? "dark" : "light"} style={[styles.bar, { borderColor: c.islandBorder }]}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const Icon = ICONS[route.name] ?? HomeIcon;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key} onPress={onPress} accessibilityRole="button"
              accessibilityLabel={LABELS[route.name] ?? route.name}
              style={[styles.item, focused && { backgroundColor: accent.gruen }]}
            >
              <Icon size={22} color={focused ? "#fff" : scheme === "dark" ? "#9C9182" : "#8A8175"} strokeWidth={1.85} />
            </Pressable>
          );
        })}
      </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  shadow: { borderRadius: 999 }, // Pillenform = Schattenpfad (Schatten-Props aus shadow.island)
  bar: {
    flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth, overflow: "hidden",
  },
  item: { width: 52, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
void Text;
