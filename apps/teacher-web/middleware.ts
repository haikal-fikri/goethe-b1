import { NextResponse, type NextRequest } from "next/server";

// TODO Phase 4: @supabase/ssr session refresh (getUser + cookie sync) so the
// teacher JWT is kept fresh + attached to the /api routes. For now a pass-through
// — the security headers come from next.config.ts and routing is unaffected.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
