import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Abmelden: server-seitiges signOut() löscht die Session-Cookies (Set-Cookie),
// dann 303-Redirect auf /login.
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
