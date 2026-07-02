import React from "react";
import { Modal, View, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../theme/ThemeProvider";
import { AppText } from "./ui";
import { CloseIcon } from "./icons";
import { env } from "../lib/env";

// Lädt die /turnstile-Seite des Trusted Servers in einer WebView und fängt das
// gelöste Token via postMessage ab (kein natives Turnstile-SDL für RN). Wird vor
// dem OTP-Versand gezeigt, wenn EXPO_PUBLIC_TURNSTILE_SITE_KEY gesetzt ist.
export function TurnstileModal({
  visible, onToken, onCancel,
}: { visible: boolean; onToken: (t: string) => void; onCancel: () => void }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} transparent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }}>
        <View style={{ height: 320, backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}>
            <AppText role="uiSemi" size={15} color={c.textHi}>Sicherheitsprüfung</AppText>
            <Pressable onPress={onCancel} hitSlop={10}><CloseIcon color={c.textMuted} /></Pressable>
          </View>
          <WebView
            source={{ uri: `${env.apiBase}/turnstile` }}
            style={{ flex: 1, backgroundColor: "transparent" }}
            javaScriptEnabled
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data) as { type: string; token?: string };
                if (msg.type === "token" && msg.token) onToken(msg.token);
              } catch {
                /* ignorieren */
              }
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
