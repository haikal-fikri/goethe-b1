import React, { useState } from "react";
import { View, TextInput, Pressable, ScrollView, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, PrimaryButton, AccentButton, Card, LevelBadge } from "../../components/ui";
import { StepDots, Toggle } from "../../components/widgets";
import { CheckCircle, LockIcon } from "../../components/icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../lib/session";
import { upsertProfile } from "../../lib/db";

// 03–08 Onboarding — 4 getrackte Schritte, umrahmt von Intro (03) und Erfolg (08).
// Schreibt profiles (client-direkt) und setzt onboarded_at am Ende → RootNavigator
// wechselt zu den Tabs. Klasse-bezogene Elemente sind in v1 ausgeblendet.
export function OnboardingScreen() {
  const { c, accent, fonts, radius } = useTheme();
  const { session } = useSession();
  const qc = useQueryClient();
  const [i, setI] = useState(0); // 0=intro,1..4 steps,5=done
  const [firstName, setFirstName] = useState("");
  const [level] = useState<"B1">("B1");
  const [examDate, setExamDate] = useState<string | null>(null);
  const [reminder, setReminder] = useState(true);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      if (reminder) {
        await Notifications.requestPermissionsAsync().catch(() => {});
      }
      await upsertProfile(session!.user.id, {
        displayName: firstName.trim() || null,
        level,
        examDate,
        reminderOptIn: reminder,
        reminderTime: reminder ? "18:30" : null,
        onboardedAt: new Date().toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      Alert.alert("Fehler", "Profil konnte nicht gespeichert werden.");
      setSaving(false);
    }
  };

  const Chrome = ({ children, cta, onCta, ctaAccent, ctaLoading }: {
    children: React.ReactNode; cta: string; onCta: () => void; ctaAccent?: boolean; ctaLoading?: boolean;
  }) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, height: 40, alignItems: "center", justifyContent: "center" }}>
        {i >= 1 && i <= 4 && <StepDots total={4} current={i - 1} />}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20, flexGrow: 1 }}>{children}</ScrollView>
      <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
        {ctaAccent ? <AccentButton label={cta} onPress={onCta} loading={ctaLoading} /> : <PrimaryButton label={cta} onPress={onCta} loading={ctaLoading} />}
      </View>
    </SafeAreaView>
  );

  if (i === 0)
    return (
      <Chrome cta="Los geht's" onCta={() => setI(1)}>
        <View style={{ marginTop: 30, gap: 16 }}>
          <View style={{ width: 62, height: 62, borderRadius: 16, backgroundColor: accent.gruen, alignItems: "center", justifyContent: "center" }}>
            <AppText role="uiBold" size={24} color="#fff">B1</AppText>
          </View>
          <Eyebrow>Konto erstellt</Eyebrow>
          <AppText role="serif" size={27} color={c.textHi} lh={32}>Schön, dass du da bist!</AppText>
          <AppText size={15} color={c.textMuted} lh={23}>Bereite dich gezielt auf die Goethe-B1-Prüfung vor — mit KI-Prüfer, Redemittel und Übungen.</AppText>
          {[
            ["KI-Prüfer", "Deine Schreibaufgaben nach den vier B1-Kriterien bewertet", accent.gruen],
            ["Redemittel & Übungen", "Baue Sätze, fülle Lücken, übe die Aussprache", accent.blau],
          ].map(([t, s, col]) => (
            <Card key={t as string} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (col as string) + "22", alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: col as string }} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText role="uiSemi" size={15} color={c.textHi}>{t as string}</AppText>
                <AppText size={13} color={c.textMuted} lh={18}>{s as string}</AppText>
              </View>
            </Card>
          ))}
        </View>
      </Chrome>
    );

  if (i === 1)
    return (
      <Chrome cta="Weiter" onCta={() => firstName.trim() ? setI(2) : Alert.alert("Name", "Bitte gib deinen Vornamen ein.")}>
        <AppText role="serif" size={25} color={c.textHi} style={{ marginTop: 20 }}>Wie heißen wir dich?</AppText>
        <View style={{ marginTop: 24, gap: 8 }}>
          <Eyebrow>Vorname</Eyebrow>
          <TextInput
            value={firstName} onChangeText={setFirstName} placeholder="Lena" placeholderTextColor={c.textFaint}
            style={{ height: 52, borderRadius: radius.input, borderWidth: 1.5, borderColor: accent.gruen, paddingHorizontal: 14, color: c.textHi, fontFamily: fonts.ui, fontSize: 16, backgroundColor: c.surface }}
          />
          <AppText size={12.5} color={c.textMuted}>Nur der Vorname ist für andere im Kurs sichtbar.</AppText>
        </View>
      </Chrome>
    );

  if (i === 2)
    return (
      <Chrome cta="Weiter" onCta={() => setI(3)}>
        <AppText role="serif" size={25} color={c.textHi} lh={30} style={{ marginTop: 20 }}>Welches Niveau möchtest du üben?</AppText>
        <View style={{ marginTop: 20, gap: 12 }}>
          <Card style={{ borderColor: accent.gruen, borderWidth: 2, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: accent.gruenTintLight }}>
            <LevelBadge level="B1" />
            <View style={{ flex: 1 }}>
              <AppText role="uiSemi" size={15} color={c.textHi}>Goethe-Zertifikat B1</AppText>
              <AppText size={12.5} color={c.textMuted}>Mittelstufe · alle Übungen freigeschaltet</AppText>
            </View>
            <CheckCircle />
          </Card>
          {["B2", "C1"].map((lv) => (
            <Card key={lv} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: 0.6 }}>
              <View style={{ width: 34, height: 24, borderRadius: 6, backgroundColor: c.surfaceAlt }} />
              <AppText role="uiSemi" size={15} color={c.textMuted} style={{ flex: 1 }}>{lv}</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                <LockIcon /><AppText size={11.5} color={c.textMuted}>Bald verfügbar</AppText>
              </View>
            </Card>
          ))}
        </View>
      </Chrome>
    );

  if (i === 3)
    return (
      <Chrome cta="Weiter" onCta={() => setI(4)}>
        <AppText role="serif" size={25} color={c.textHi} style={{ marginTop: 20 }}>Wann ist deine Prüfung?</AppText>
        <AppText size={14} color={c.textMuted} style={{ marginTop: 6 }}>Optional — hilft dir, dranzubleiben.</AppText>
        <View style={{ marginTop: 20, gap: 10 }}>
          <MiniDate value={examDate} onChange={setExamDate} />
          <Pressable onPress={() => { setExamDate(null); setI(4); }}>
            <AppText size={13.5} color={c.textMuted} align="center" style={{ marginTop: 8 }}>Später festlegen</AppText>
          </Pressable>
        </View>
      </Chrome>
    );

  if (i === 4)
    return (
      <Chrome cta="Erinnerungen aktivieren" ctaAccent onCta={finish} ctaLoading={saving}>
        <AppText role="serif" size={25} color={c.textHi} style={{ marginTop: 20 }}>Bleib dran</AppText>
        <AppText size={15} color={c.textMuted} lh={22} style={{ marginTop: 6 }}>Eine kurze tägliche Erinnerung hält deine Serie am Leben — 10 Minuten reichen.</AppText>
        <Card style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText role="uiSemi" size={15} color={c.textHi}>Tägliche Erinnerung</AppText>
            <AppText size={12.5} color={c.textMuted}>um 18:30 Uhr</AppText>
          </View>
          <Toggle value={reminder} onChange={setReminder} />
        </Card>
      </Chrome>
    );

  return null;
}

// Kompakter Monats-Picker (nächste 60 Tage als Grid).
function MiniDate({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const { c, accent, fonts } = useTheme();
  const today = new Date();
  const days = Array.from({ length: 42 }).map((_, k) => {
    const d = new Date(today); d.setDate(today.getDate() + k);
    return d;
  });
  return (
    <Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {days.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          const sel = iso === value;
          return (
            <Pressable key={iso} onPress={() => onChange(iso)}
              style={{ width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: sel ? accent.gruen : "transparent" }}>
              <AppText size={13} color={sel ? "#fff" : c.textBody} style={{ fontFamily: fonts.serif }}>{d.getDate()}</AppText>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
