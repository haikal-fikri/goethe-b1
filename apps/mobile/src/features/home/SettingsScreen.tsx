import React, { useState, useEffect } from "react";
import { View, Alert, Image, TextInput, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme, type ThemeMode } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Card, ListRow, Loading } from "../../components/ui";
import { Segmented } from "../../components/widgets";
import { useProfile, useLanguages, useAvatarUrl } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { authedFetch, uploadAvatar } from "../../lib/api";
import { upsertProfile } from "../../lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { LEVELS } from "@repo/types";
import type { CEFRLevel } from "@repo/types";

// Flaggen-Emoji je Sprachcode (Labels selbst kommen aus der languages-Tabelle).
const FLAG: Record<string, string> = { en: "🇬🇧", id: "🇮🇩", tr: "🇹🇷", ar: "🇸🇦", uk: "🇺🇦", ru: "🇷🇺", es: "🇪🇸" };

// 10 · Einstellungen — Profil, Prüfung, Anmeldung, Erscheinungsbild, Sprache, Daten.
export function SettingsScreen() {
  const { c, mode, setMode, accent, fonts } = useTheme();
  const { session, signOut } = useSession();
  const profile = useProfile();
  const languages = useLanguages();
  const avatar = useAvatarUrl();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const uid = session?.user.id;

  // Namensentwurf mit dem geladenen Profil synchronisieren (useState-Init greift nur beim Loading-Render).
  useEffect(() => { setNameDraft(profile.data?.displayName ?? ""); }, [profile.data?.displayName]);

  if (profile.isLoading) return <Loading />;
  const p = profile.data;
  const initials = (p?.displayName || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  // Anzeigename ändern — Schreibpfad existiert (upsertProfile whitelistet display_name, ≤80).
  const saveName = async () => {
    const v = nameDraft.trim().slice(0, 80);
    if (!uid || v === (p?.displayName ?? "")) return;
    await upsertProfile(uid, { displayName: v || null });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  // Profilbild wählen → geroutet hochladen (resize/webp/EXIF-strip serverseitig) → signierte URL cachen.
  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Kein Zugriff", "Erlaube den Fotozugriff, um ein Profilbild zu wählen."); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
    });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    setBusy(true);
    try {
      const signed = await uploadAvatar(r.assets[0].base64);
      if (uid) qc.setQueryData(["avatarUrl", uid], signed);
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      const err = e as Error & { status?: number };
      Alert.alert("Fehler", err.status === 413 ? "Das Bild ist zu groß (max. 2 MB)." : "Bild konnte nicht hochgeladen werden.");
    } finally { setBusy(false); }
  };

  const setLang = async (code: string) => {
    if (!uid) return;
    await upsertProfile(uid, { nativeLanguage: code });
    // Profil + Redemittel neu laden → das Übersetzungs-Overlay greift sofort.
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["redemittel"] });
  };

  // R2-2: Prüfungsniveau ändern → „Gelernt"/Readiness richten sich neu aus; bereits
  // gemeisterte Items dieses Niveaus reflektieren sofort (kein Backfill).
  const setLevel = async (level: CEFRLevel) => {
    if (!uid) return;
    await upsertProfile(uid, { level });
    qc.invalidateQueries(); // Profil + Fortschritt + Readiness neu laden
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

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {avatar.data ? (
            <Image source={{ uri: avatar.data }} style={{ width: 56, height: 56, borderRadius: 999 }} />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: accent.lila + "26", alignItems: "center", justifyContent: "center" }}>
              <AppText role="uiSemi" size={18} color={accent.lila}>{initials}</AppText>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <AppText size={13} color={c.textMuted}>{session?.user.email}</AppText>
            <Pressable onPress={pickAvatar} hitSlop={6} disabled={busy} accessibilityRole="button" accessibilityLabel="Profilbild ändern" style={{ marginTop: 4 }}>
              <AppText size={13} color={accent.lila}>Profilbild ändern</AppText>
            </Pressable>
          </View>
        </View>
        <View>
          <Eyebrow>Anzeigename</Eyebrow>
          <TextInput
            value={nameDraft} onChangeText={setNameDraft} onBlur={saveName} onSubmitEditing={saveName}
            maxLength={80} placeholder="Dein Name" placeholderTextColor={c.textFaint} returnKeyType="done"
            style={{ marginTop: 6, color: c.textHi, fontFamily: fonts.uiSemi, fontSize: 16, paddingVertical: 4 }}
          />
        </View>
      </Card>

      <View style={{ height: 18 }} />
      <Eyebrow>Prüfung</Eyebrow>
      <AppText size={12.5} color={c.textMuted} style={{ marginTop: 4, marginBottom: 8 }}>Dein Zielniveau — bestimmt „Gelernt" und die Bereitschaft. Höhere Übungen bleiben verfügbar.</AppText>
      <Segmented
        options={LEVELS.map((l) => ({ label: l, value: l }))}
        value={(p?.level ?? "B1") as CEFRLevel} onChange={setLevel}
      />

      <View style={{ height: 18 }} />
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
        {(languages.data ?? []).map((l, i) => (
          <View key={l.code}>
            {i > 0 && <View style={{ height: 1, backgroundColor: c.border }} />}
            <ListRow
              title={`${FLAG[l.code] ?? "🌐"} ${l.nameNative}`}
              right={p?.nativeLanguage === l.code ? <AppText color={accent.gruen}>✓</AppText> : undefined}
              onPress={() => setLang(l.code)}
            />
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
