import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Jost_400Regular, Jost_500Medium, Jost_600SemiBold, Jost_700Bold } from "@expo-google-fonts/jost";
import { SourceSerif4_400Regular, SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { View } from "react-native";

import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { SessionProvider } from "./src/lib/session";
import { FeatureFlagsProvider } from "./src/lib/featureFlags";
import { queryClient } from "./src/lib/queryClient";
import { RootNavigator } from "./src/navigation";

function StatusBarThemed() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Jost: Jost_400Regular,
    "Jost-Med": Jost_500Medium,
    "Jost-Semi": Jost_600SemiBold,
    "Jost-Bold": Jost_700Bold,
    SourceSerif4: SourceSerif4_400Regular,
    "SourceSerif4-Med": SourceSerif4_600SemiBold,
    IBMPlexMono: IBMPlexMono_400Regular,
    "IBMPlexMono-Med": IBMPlexMono_500Medium,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: "#FDFBF6" }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <FeatureFlagsProvider>
              <StatusBarThemed />
              <RootNavigator />
            </FeatureFlagsProvider>
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
