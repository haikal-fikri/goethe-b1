import React, { useState } from "react";
import { View, TextInput, Alert, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, PrimaryButton, AccentButton, SecondaryButton, Center, LevelBadge } from "../../components/ui";
import { PeopleIcon, MicIcon, CloseIcon } from "../../components/icons";
import { getSupabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";

// 29–34 · Klasse + Sprechen Teil 2. In v1 hinter class_enabled AUSGEBLENDET
// (die Runtime kommt in der Lehrkraft-Phase). RLS/RPCs existieren bereits.

export function KlasseScreen() {
  const { c, accent, tint } = useTheme();
  const nav = useNavigation<any>();
  const [enrolled] = useState(false); // v1: nie erreichbar (Flag aus)
  if (enrolled) return <KlasseJoinedScreen />;
  return (
    <Center>
      <View style={{ width: 72, height: 72, borderRadius: 999, backgroundColor: tint("lila"), alignItems: "center", justifyContent: "center" }}>
        <PeopleIcon size={34} color={accent.lila} />
      </View>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 16 }}>Noch keine Klasse</AppText>
      <AppText size={14} color={c.textMuted} align="center" lh={20} style={{ marginTop: 6 }}>
        Tritt der Klasse deiner Lehrkraft bei, um Aufgaben und Feedback zu erhalten.
      </AppText>
      <PrimaryButton label="Klasse beitreten" onPress={() => nav.navigate("KlasseJoin")} style={{ marginTop: 20, alignSelf: "stretch" }} />
      <Pressable onPress={() => WebBrowser.openBrowserAsync("https://example.org/kurse")} style={{ marginTop: 12 }}>
        <AppText size={13} color={accent.gruen}>Kurse auf unserer Website ansehen ↗</AppText>
      </Pressable>
    </Center>
  );
}

export function KlasseJoinScreen() {
  const { c, accent, fonts, radius } = useTheme();
  const nav = useNavigation<any>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const s = getSupabase();
    if (!s) return;
    setBusy(true);
    try {
      const { error } = await s.rpc("join_class", { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      Alert.alert("Beigetreten", "Du bist der Klasse beigetreten.");
      nav.goBack();
    } catch {
      Alert.alert("Ungültiger Code", "Bitte prüfe den Code und versuche es erneut.");
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 22, paddingTop: 56 }}>
      <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
      <AppText role="serif" size={24} color={c.textHi} style={{ marginTop: 16 }}>Klasse beitreten</AppText>
      <AppText size={14} color={c.textMuted} style={{ marginTop: 6 }}>Gib den Code deiner Lehrkraft ein.</AppText>
      <TextInput
        value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="K73F9" placeholderTextColor={c.textFaint}
        autoCapitalize="characters" maxLength={8} textAlign="center"
        style={{ marginTop: 20, height: 60, borderRadius: radius.input, borderWidth: 1.5, borderColor: accent.gruen, color: c.textHi, fontFamily: fonts.mono, fontSize: 24, letterSpacing: 6, backgroundColor: c.surface }}
      />
      <PrimaryButton label="Klasse beitreten" onPress={join} loading={busy} disabled={code.length < 4} style={{ marginTop: 18 }} />
    </View>
  );
}

function KlasseJoinedScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  return (
    <>
      <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 8, marginBottom: 12 }}>Klasse</AppText>
      <Card style={{ backgroundColor: c.primaryBtnBg, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <LevelBadge level="B1" />
        <View style={{ flex: 1 }}>
          <AppText role="uiSemi" size={15} color={c.primaryBtnFg}>B1 Abendkurs</AppText>
          <AppText size={12.5} color={c.primaryBtnFg} style={{ opacity: 0.7 }}>Frau Schäfer · Lehrkraft</AppText>
        </View>
      </Card>
      <Card style={{ marginTop: 12 }} onPress={() => nav.navigate("SprechenTask")}>
        <Eyebrow color={accent.blau}>Sprechen · Teil 2</Eyebrow>
        <AppText role="uiSemi" size={15} color={c.textHi} style={{ marginTop: 6 }}>Ein Thema präsentieren</AppText>
        <AppText size={13} color={c.textMuted} style={{ marginTop: 4 }}>Nicht begonnen · Aufnahme starten ›</AppText>
      </Card>
    </>
  );
}

// 32–34 · Sprechen Teil 2 (Aufnahme). Runtime deferred; einfacher Ablauf.
export function SprechenTaskScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <Pressable onPress={() => nav.goBack()} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
      <AppText role="serif" size={22} color={c.textHi} style={{ marginTop: 16 }}>Ein Thema präsentieren: Reisen</AppText>
      <Card style={{ marginTop: 16 }}>
        <Eyebrow color={accent.blau}>Deine Aufgabe</Eyebrow>
        <AppText size={14} color={c.textBody} lh={20} style={{ marginTop: 6 }}>Präsentiere das Thema in ca. 3 Minuten anhand der Stichpunkte.</AppText>
      </Card>
      <View style={{ position: "absolute", left: 18, right: 18, bottom: 24 }}>
        <AccentButton label="Aufnahme starten" color={accent.blau} onPress={() => nav.navigate("SprechenRecord")} />
      </View>
    </View>
  );
}

export function SprechenRecordScreen() {
  const { c, accent, tint } = useTheme();
  const nav = useNavigation<any>();
  const [seconds, setSeconds] = useState(300);
  React.useEffect(() => {
    const iv = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : (nav.navigate("SprechenReview"), 0))), 1000);
    return () => clearInterval(iv);
  }, []);
  const mm = Math.floor(seconds / 60), ss = String(seconds % 60).padStart(2, "0");
  return (
    <Center>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: tint("rot"), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.rot }} />
        <AppText size={12} color={accent.rotText}>AUFNAHME LÄUFT</AppText>
      </View>
      <View style={{ width: 104, height: 104, borderRadius: 999, backgroundColor: accent.blau, alignItems: "center", justifyContent: "center", marginTop: 24 }}>
        <MicIcon size={40} color="#fff" strokeWidth={2} />
      </View>
      <AppText role="serif" size={40} color={c.textHi} style={{ marginTop: 20 }}>{mm}:{ss}</AppText>
      <AppText size={13} color={c.textMuted}>verbleibend · max. 5:00</AppText>
      <PrimaryButton label="Aufnahme stoppen" onPress={() => nav.navigate("SprechenReview")} style={{ marginTop: 24, alignSelf: "stretch" }} />
    </Center>
  );
}

export function SprechenReviewScreen() {
  const { c, accent } = useTheme();
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 18, paddingTop: 56 }}>
      <AppText role="serif" size={22} color={c.textHi}>Deine Aufnahme</AppText>
      <Card style={{ marginTop: 16 }}>
        <AppText size={14} color={c.textMuted}>Höre dir die Aufnahme an, bevor du sie einreichst.</AppText>
      </Card>
      <View style={{ position: "absolute", left: 18, right: 18, bottom: 24, flexDirection: "row", gap: 10 }}>
        <SecondaryButton label="Neu aufnehmen" onPress={() => nav.navigate("SprechenRecord")} style={{ flex: 1 }} />
        <PrimaryButton label="Absenden" onPress={() => { Alert.alert("Gesendet", "Deine Aufnahme wurde an die Lehrkraft gesendet."); nav.popToTop(); }} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
