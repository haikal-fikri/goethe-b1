import React from "react";
import { View, Pressable } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme/ThemeProvider";
import { useSession } from "../lib/session";
import { useFeatureFlags } from "../lib/featureFlags";
import { useProfile } from "../lib/hooks";
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
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="UebenBereiche" component={wrap(UebenBereicheScreen)} />
      <S.Screen name="UebenArea" component={wrap(UebenAreaScreen, { back: true })} />
      <S.Screen name="Exercise" component={ExercisePlayer} />
      <S.Screen name="Speaking" component={SpeakingScreen} />
    </S.Navigator>
  );
}
function PruefenStack() {
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="PruefenLanding" component={wrap(PruefenLandingScreen)} />
      <S.Screen name="Exam" component={ExamScreen} />
      <S.Screen name="ExamResult" component={ExamResultScreen} />
    </S.Navigator>
  );
}
function FortschrittStack() {
  return (
    <S.Navigator screenOptions={stackOpts}>
      <S.Screen name="FortschrittHome" component={wrap(FortschrittScreen)} />
      <S.Screen name="Probe" component={wrap(ProbeScreen, { back: true })} />
      <S.Screen name="ExamResult" component={ExamResultScreen} />
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

  const navTheme = scheme === "dark"
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: c.bg } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: c.bg } };

  let content: React.ReactNode;
  if (loading) content = <Loading />;
  else if (!session) content = <AuthNavigator />;
  else if (profile.isLoading) content = <Loading />;
  else if (!profile.data?.onboardedAt) content = <OnboardingScreen />;
  else content = <Tabs />;

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>{content}</View>
    </NavigationContainer>
  );
}
