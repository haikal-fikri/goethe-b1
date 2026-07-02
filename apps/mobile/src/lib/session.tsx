import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

// Session-Kontext: Cold-Start-Session + Live-Updates via onAuthStateChange.
interface SessionCtx {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  configured: boolean;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
  }, [supabase]);

  return (
    <Ctx.Provider value={{ session, loading, signOut, configured: Boolean(supabase) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession muss innerhalb von SessionProvider verwendet werden.");
  return ctx;
}
