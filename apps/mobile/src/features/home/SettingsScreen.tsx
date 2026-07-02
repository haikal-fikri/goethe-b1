import React, { useState } from "react";
import { View, Alert } from "react-native";
import { useTheme, type ThemeMode } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, ListRow, Loading } from "../../components/ui";
import { Segmented } from "../../components/widgets";
import { useProfile } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { authedFetch } from "../../lib/api";
import { upsertProfile } from "../../lib/db";
import { useQueryClient } from "@tanstack/react-query";

const LANGS: { code: string; label: string }[] = [
  { code: "en", label: "🇬🇧 English" }, { code: "tr", label: "🇹🇷 Türkçe" },
  { code: "ar", label: "🇸🇦 العربية" }, { code: "uk", label: "🇺🇦 Українська" },
  { code: "ru", label: "🇷🇺 Русский" }, { code: "es", label: "🇪🇸 Español" },
];

// 10 · Einstellungen — Profil, Prüfung, Anmeldung, Erscheinungsbild, Sprache, Daten.
export function SettingsScreen() {
  const { c, mode, setMode, accent } = useTheme();
  const { session, signOut } = useSession();
  const profile = useProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const uid = session?.user.id;

  if (profile.isLoading) return <Loading />;
  const p = profile.data;

  const setLang = async (code: string) => {
    if (!uid) return;
    await upsertProfile(uid, { nativeLanguage: code });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const resetProgress = () =>
    Alert.alert("Fortschritt zurücksetzen?", "Deine Übungsstatistik wird gelöscht. Der Notenverlauf bleibt erhalten.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Zurücksetzen", style: "destructive", onPress: async () => {
        setBusy(true);
        try {
          const res = await authedFetch("/api/profile/reset-progress", { method: "POST", body: JSON.stringify({}) });
          if (!res.ok) throw new Error();
          qc.invalidateQueries();
          Alert.alert("Erledigt", "Dein Übungsfortschritt wurde zurückgesetzt.");
        } catch { Alert.alert("Fehler", "Bitte später erneut versuchen."); }
        finally { setBusy(false); }
      } },
    ]);

  const deleteAccount = () =>
    Alert.alert("Konto löschen?", "Alle deine Daten werden unwiderruflich gelöscht.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Konto löschen", style: "destructive", onPress: async () => {
        setBusy(true);
        try {
          const res = await authedFetch("/api/account/delete", { method: "POST", body: JSON.stringify({}) });
          if (!res.ok) throw new Error();
          await signOut();
        } catch { Alert.alert("Fehler", "Bitte später erneut versuchen."); }
        finally { setBusy(false); }
      } },
    ]);

  return (
    <>
      <AppText role="serif" size={26} color={c.textHi} style={{ marginTop: 8, marginBottom: 16 }}>Einstellungen</AppText>

      <Card>
        <AppText role="uiSemi" size={16} color={c.textHi}>{p?.displayName ?? "Profil"}</AppText>
        <AppText size={13} color={c.textMuted} style={{ marginTop: 2 }}>{session?.user.email}</AppText>
      </Card>

      <Eyebrow>Erscheinungsbild</Eyebrow>
      <View style={{ marginTop: 8, marginBottom: 18 }}>
        <Segmented
          options={[{ label: "System", value: "system" }, { label: "Hell", value: "light" }, { label: "Dunkel", value: "dark" }] as { label: string; value: ThemeMode }[]}
          value={mode} onChange={setMode}
        />
      </View>

      <Eyebrow>Muttersprache</Eyebrow>
      <AppText size={12.5} color={c.textMuted} style={{ marginTop: 4, marginBottom: 8 }}>Bestimmt die Übersetzung der Redemittel.</AppText>
      <Card style={{ paddingVertical: 4 }}>
        {LANGS.map((l, i) => (
          <View key={l.code}>
            {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
            <ListRow title={l.label} right={p?.nativeLanguage === l.code ? <AppText color={accent.gruen}>✓</AppText> : undefined} onPress={() => setLang(l.code)} />
          </View>
        ))}
      </Card>

      <View style={{ height: 18 }} />
      <Eyebrow>Daten</Eyebrow>
      <Card style={{ marginTop: 8, paddingVertical: 4 }}>
        <ListRow title="Fortschritt zurücksetzen" danger onPress={resetProgress} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <ListRow title="Abmelden" danger onPress={() => signOut()} />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <ListRow title="Konto löschen" danger onPress={deleteAccount} />
      </Card>
      {busy ? <AppText size={12} color={c.textMuted} align="center" style={{ marginTop: 12 }}>Bitte warten…</AppText> : null}
    </>
  );
}
