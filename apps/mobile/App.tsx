import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
// Smoke test: import shared, platform-agnostic domain code from the monorepo
// packages. This is the same logic the web app uses — proof that code sharing
// works across apps/web and apps/mobile.
import { shuffle, PASS_RATIO } from "@repo/core";
import type { CEFRLevel } from "@repo/types";

const level: CEFRLevel = "B1";
const demo = shuffle(["Ich", "lerne", "Deutsch", "mit", "B1+Trainer"]).join(" ");

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>B1+Trainer · Mobile</Text>
      <Text style={styles.row}>Shared types — level: {level}</Text>
      <Text style={styles.row}>@repo/core shuffle(): {demo}</Text>
      <Text style={styles.row}>@repo/core PASS_RATIO: {PASS_RATIO}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  row: { fontSize: 14, textAlign: "center" },
});
