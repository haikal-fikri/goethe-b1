import React, { useState } from "react";
import { View, TextInput, Pressable, Alert, Platform, KeyboardAvoidingView } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText, Eyebrow, Screen, PrimaryButton, SecondaryButton } from "../../components/ui";
import { sendEmailOtp, verifyEmailOtp, signInWithGoogle, signInWithApple, AuthError } from "../../lib/auth";
import { googleConfigured } from "../../lib/env";
import { useSession } from "../../lib/session";

// 01 · Anmelden. Primär: Google/Apple + Magic-Link; Fallback: 8-stellige OTP.
// v1: der „Mit Klassencode beitreten"-Link ist ausgeblendet (class_enabled aus).
export function LoginScreen() {
  const { c, accent, fonts, radius } = useTheme();
  const { configured } = useSession();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const notConfigured = () =>
    Alert.alert("Noch nicht eingerichtet", "Die Anmeldung ist verfügbar, sobald Supabase Auth konfiguriert ist.");

  const send = async () => {
    if (!configured) return notConfigured();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Alert.alert("E-Mail", "Bitte gib eine gültige E-Mail-Adresse ein.");
    setBusy(true);
    try {
      await sendEmailOtp(email.trim());
      setStep("code");
    } catch (e) {
      Alert.alert("Fehler", e instanceof AuthError ? e.message : "Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await verifyEmailOtp(email.trim(), code.trim());
      // Session-Listener übernimmt die Navigation.
    } catch (e) {
      Alert.alert("Code ungültig", e instanceof AuthError ? e.message : "Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  const withBusy = (fn: () => Promise<void>) => async () => {
    if (!configured) return notConfigured();
    setBusy(true);
    try { await fn(); } catch (e) {
      if (!(e as { code?: string })?.code?.includes("CANCEL"))
        Alert.alert("Anmeldung", e instanceof AuthError ? e.message : "Bitte erneut versuchen.");
    } finally { setBusy(false); }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", gap: 18 }}>
        {/* Logo-Lockup */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: accent.gruen, alignItems: "center", justifyContent: "center" }}>
            <AppText role="uiBold" size={18} color="#fff">B1</AppText>
          </View>
          <AppText role="uiSemi" size={18} color={c.textHi}>B1+Trainer</AppText>
        </View>

        <AppText role="serif" size={28} color={c.textHi} lh={32}>
          {step === "email" ? "Willkommen zurück" : "Code eingeben"}
        </AppText>

        {step === "email" ? (
          <>
            <View>
              <Eyebrow>E-Mail</Eyebrow>
              <TextInput
                value={email} onChangeText={setEmail} placeholder="du@beispiel.de" placeholderTextColor={c.textFaint}
                autoCapitalize="none" keyboardType="email-address" autoComplete="email" inputMode="email"
                style={{ marginTop: 8, height: 52, borderRadius: radius.input, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 14, color: c.textHi, fontFamily: fonts.ui, fontSize: 16, backgroundColor: c.surface }}
              />
            </View>
            <PrimaryButton label="Weiter" onPress={send} loading={busy} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 2 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <AppText size={12} color={c.textFaint}>oder</AppText>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>
            {googleConfigured() && <SecondaryButton label="Weiter mit Google" onPress={withBusy(signInWithGoogle)} />}
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={radius.input} style={{ height: 54 }}
                onPress={withBusy(signInWithApple)}
              />
            )}
          </>
        ) : (
          <>
            <AppText size={14} color={c.textMuted} lh={20}>
              Wir haben dir einen Code (und einen Anmelde-Link) an {email} geschickt.
            </AppText>
            <TextInput
              value={code} onChangeText={setCode} placeholder="12345678" placeholderTextColor={c.textFaint}
              keyboardType="number-pad" maxLength={8} textAlign="center"
              style={{ height: 60, borderRadius: radius.input, borderWidth: 1.5, borderColor: accent.gruen, color: c.textHi, fontFamily: fonts.mono, fontSize: 26, letterSpacing: 6, backgroundColor: c.surface }}
            />
            <PrimaryButton label="Anmelden" onPress={verify} loading={busy} disabled={code.length < 8} />
            <Pressable onPress={() => setStep("email")}>
              <AppText size={13} color={accent.gruen} align="center">Andere E-Mail verwenden</AppText>
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
