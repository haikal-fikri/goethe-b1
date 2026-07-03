import React from "react";
import { View, Pressable } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme/ThemeProvider";
import { useSession } from "../lib/session";
import { useFeatureFlags } from "../lib/featureFlags";
import { useProfile, useActiveTimeTracker } from "../lib/hooks";
import { Screen, Loading } from "../components/ui";
import { BackIcon } from "../components/icons";
import { IslandTabBar } from "./IslandTabBar";

import { LoginScreen } from "../features/auth/LoginScreen";
import { OnboardingScreen } from "../features/onboarding/OnboardingScreen";
import { HomeScreen } from "../features/home/HomeScreen";
import { SettingsScreen } from "../features/home/SettingsScreen";
import { LernenScreen, LernenAreaScreen, LernenCategoryScreen } from "../features/lernen/LernenScreens";
import { UebenBereicheScreen, UebenAreaScreen } from "../features/ueben/UebenScreens";
import { ExercisePlayer } from "../features/ueben/ExercisePlayer";
import { SpeakingScreen } from "../features/ueben/SpeakingScreen";
import { UebungAbgeschlossenScreen } from "../features/ueben/UebungAbgeschlossen";
import { PruefenLandingScreen, ExamScreen, ExamResultScreen } from "../features/pruefen/PruefenScreens";
import { FortschrittScreen, ProbeScreen } from "../features/fortschritt/FortschrittScreens";
import { KlasseScreen, KlasseJoinScreen, SprechenTaskScreen, SprechenRecordScreen, SprechenReviewScreen } from "../features/klasse/KlasseScreens";

// Fragment-Screens in <Screen> wrappen + optionaler Zurück-Header (kein Native-
// Header → volle Layout-Kontrolle, SafeAreaView top).
function BackHeader() {
  const nav = useNavigation<any>();
  const { c } = useTheme();
  return (
    <Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ paddingVertical: 4, marginBottom: 4, alignSelf: "flex-start" }}>
      <BackIcon color={c.textMuted} />
    </Pressable>
  );
}
const wrap = (Comp: React.ComponentType, opts: { scroll?: boolean; back?: boolean } = {}) => () =>
  (
    <Screen scroll={opts.scroll ?? true}>
      {opts.back ? <BackHeader /> : null}
      <Comp />
    </Screen>
  );

const S = createNativeStackNavigator();
const stackOpts = { headerShown: false, contentStyle: { backgroundColor: "transparent" } } as const;

function HeuteStack() {
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="HeuteHome" component={wrap(HomeScreen)} />
      <S.Screen name="Settings" component={wrap(SettingsScreen, { back: true })} />
      <S.Screen name="Lernen" component={wrap(LernenScreen, { back: true })} />
      <S.Screen name="LernenArea" component={wrap(LernenAreaScreen, { back: true })} />
      <S.Screen name="LernenCategory" component={wrap(LernenCategoryScreen, { back: true })} />
    </S.Navigator>
  );
}
function UebenStack() {
  // BUG-8: Exercise/Speaking leben NICHT mehr hier, sondern auf dem Root-Stack
  // ÜBER den Tabs → Island wird während der Übung ausgeblendet (Fixed-Layout).
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="UebenBereiche" component={wrap(UebenBereicheScreen)} />
      <S.Screen name="UebenArea" component={wrap(UebenAreaScreen, { back: true })} />
    </S.Navigator>
  );
}
function PruefenStack() {
  // BUG-8: Exam/ExamResult sind auf den Root-Stack verschoben (kein Island).
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="PruefenLanding" component={wrap(PruefenLandingScreen)} />
    </S.Navigator>
  );
}
function FortschrittStack() {
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="FortschrittHome" component={wrap(FortschrittScreen)} />
      <S.Screen name="Probe" component={wrap(ProbeScreen, { back: true })} />
      <S.Screen name="Settings" component={wrap(SettingsScreen, { back: true })} />
    </S.Navigator>
  );
}
function KlasseStack() {
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="KlasseHome" component={wrap(KlasseScreen, { scroll: false })} />
      <S.Screen name="KlasseJoin" component={KlasseJoinScreen} />
      <S.Screen name="SprechenTask" component={SprechenTaskScreen} />
      <S.Screen name="SprechenRecord" component={SprechenRecordScreen} />
      <S.Screen name="SprechenReview" component={wrap(SprechenReviewScreen, { scroll: false })} />
    </S.Navigator>
  );
}

const Tab = createBottomTabNavigator();
function Tabs() {
  const { classEnabled } = useFeatureFlags();
  return (
    <Tab.Navigator tabBar={(props) => <IslandTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Heute" component={HeuteStack} />
      <Tab.Screen name="Ueben" component={UebenStack} />
      <Tab.Screen name="Pruefen" component={PruefenStack} />
      <Tab.Screen name="Fortschritt" component={FortschrittStack} />
      {classEnabled ? <Tab.Screen name="Klasse" component={KlasseStack} /> : null}
    </Tab.Navigator>
  );
}

// BUG-8: Root-Stack ÜBER den Tabs. Vollbild-Flows (Übung 16/18, Sprechen 20–22,
// Exam 24, Bewertung 25, Übung-abgeschlossen) sind Geschwister von <Tabs/> → sie
// pushen über die Tab-Leiste, sodass das Island NICHT gezeichnet wird. navigate()
// aus einem Tab-Screen findet diese Namen durch Hochlaufen im Navigator-Baum.
const Root = createNativeStackNavigator();
function AppNavigator() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
      <Root.Screen name="Tabs" component={Tabs} />
      <Root.Screen name="Exercise" component={ExercisePlayer} />
      <Root.Screen name="Speaking" component={SpeakingScreen} />
      <Root.Screen name="Exam" component={ExamScreen} />
      <Root.Screen name="ExamResult" component={ExamResultScreen} />
      <Root.Screen name="UebungAbgeschlossen" component={UebungAbgeschlossenScreen} />
    </Root.Navigator>
  );
}

const AuthStack = createNativeStackNavigator();
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// Root: entscheidet Auth / Onboarding / Tabs.
export function RootNavigator() {
  const { scheme, c } = useTheme();
  const { session, loading } = useSession();
  const profile = useProfile();
  useActiveTimeTracker(); // BUG-4: Vordergrundzeit → active_seconds (Woche-Statistik)

  const navTheme = scheme === "dark"
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: c.bg } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: c.bg } };

  let content: React.ReactNode;
  if (loading) content = <Loading />;
  else if (!session) content = <AuthNavigator />;
  else if (profile.isLoading) content = <Loading />;
  else if (!profile.data?.onboardedAt) content = <OnboardingScreen />;
  else content = <AppNavigator />;

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>{content}</View>
    </NavigationContainer>
  );
}
