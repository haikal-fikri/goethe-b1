import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { encode as b64encode, decode as b64decode } from "base-64";
import { env, supabaseConfigured } from "./env";

// Gechunkter SecureStore-Adapter (MASVS STORAGE-1). Eine persistierte Session
// sprengt SecureStores 2048-Byte-Grenze → base64 + Chunking über ${key}.i
// (Anzahl) + ${key}.0..n. WHEN_UNLOCKED_THIS_DEVICE_ONLY schließt iCloud/Backup
// aus. Korrupt/teilweise gelesen → als abgemeldet behandeln (Re-Auth erzwingen).
const CHUNK = 1800;
const opts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const chunkedStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const countRaw = await SecureStore.getItemAsync(`${key}.i`, opts);
      if (countRaw == null) {
        // evtl. alter unchunked Wert
        return await SecureStore.getItemAsync(key, opts);
      }
      const count = parseInt(countRaw, 10);
      if (!Number.isFinite(count) || count < 0) return null;
      let b64 = "";
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`, opts);
        if (part == null) return null; // teilweise → als abgemeldet behandeln
        b64 += part;
      }
      return b64 ? b64decode(b64) : "";
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const b64 = b64encode(value);
    const count = Math.ceil(b64.length / CHUNK) || 1;
    // alte Chunks wegräumen (Best-effort), bevor neue geschrieben werden
    await this.removeItem(key);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, b64.slice(i * CHUNK, (i + 1) * CHUNK), opts);
    }
    await SecureStore.setItemAsync(`${key}.i`, String(count), opts);
  },
  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(`${key}.i`, opts).catch(() => null);
    const count = countRaw ? parseInt(countRaw, 10) : 0;
    for (let i = 0; i < (Number.isFinite(count) ? count : 0); i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`, opts).catch(() => {});
    }
    await SecureStore.deleteItemAsync(`${key}.i`, opts).catch(() => {});
    await SecureStore.deleteItemAsync(key, opts).catch(() => {}); // legacy
  },
};

let client: SupabaseClient | null = null;

/** Supabase-Client (anon key + JWT, RLS). Null, wenn nicht konfiguriert. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (client) return client;
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: chunkedStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  // autoRefresh nur im Vordergrund (sonst werden Sessions stale).
  AppState.addEventListener("change", (state) => {
    if (!client) return;
    if (state === "active") client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
  return client;
}
