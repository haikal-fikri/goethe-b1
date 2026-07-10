import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Nur relative Same-Origin-Pfade zulassen (Open-Redirect-Schutz). Der WHATWG-
// URL-Parser faltet "\" UND C0-Steuerzeichen (Tab/LF/CR) zu "/", d.h.
// "/\evil.com" oder "/<TAB>/evil.com" würden gegen die Origin cross-origin
// auflösen — daher zusätzlich zu "//" auch Backslash + Steuerzeichen ablehnen.
function safeNext(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\x00-\x1f\\]/.test(raw)) return "/";
  return raw;
}

// Magic-Link-Landung (teacher-lms Q4). GoTrue mailt einen Link auf
// /auth/confirm?token_hash=…&type=…&next=… — verifyOtp auf dem Server-Client
// tauscht ihn gegen eine Session (Set-Cookie) und leitet weiter. Der
// 8-stellige-Code-Pfad verifiziert client-seitig (Login-Seite) → keine Route.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const dest = safeNext(searchParams.get("next") ?? "/");

  if (tokenHash && type) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(dest, origin));
  }
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
