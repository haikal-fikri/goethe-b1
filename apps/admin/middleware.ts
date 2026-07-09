import { NextResponse, type NextRequest } from "next/server";

// TODO Phase 4: @supabase/ssr session refresh so the admin JWT (role='admin')
// stays fresh + attached to /api/admin routes. Pass-through for now.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
