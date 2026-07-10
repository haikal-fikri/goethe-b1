import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Nur relative Same-Origin-Pfade zulassen. Der WHATWG-URL-Parser faltet "\" UND
// C0-Steuerzeichen (Tab/LF/CR) zu "/" ("/\evil.com" → cross-origin) — daher
// zusätzlich zu "//" auch Backslash + Steuerzeichen ablehnen.
function safeNext(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/[\x00-\x1f\\]/.test(raw)) return "/";
  return raw;
}

// Magic-Link-Landung. verifyOtp auf dem Server-Client tauscht token_hash gegen
// eine Session (Set-Cookie) und leitet weiter (Same-Origin-Guard).
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
