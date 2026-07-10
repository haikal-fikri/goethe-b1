import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next-16 Proxy (früher „middleware"). Refresht das @supabase/ssr-Session-Cookie,
// damit Server-Components + der Browser-Client ein gültiges Token behalten.
// Das ist ein OPTIMISTISCHER Refresh — jede /api-B-Route verifiziert den
// Bearer-JWT unabhängig (requireUser); der Proxy ist KEINE Autz-Grenze.
// Proxy läuft in Next 16 standardmäßig auf der Node.js-Runtime.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response; // Auth noch nicht provisioniert → pass-through

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // v0.12: no-store-Header verhindern, dass CDNs die Set-Cookie-Antwort
        // cachen (sonst könnte eine Session an einen anderen Nutzer geraten).
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        }
      },
    },
  });

  // getUser() (verifiziert) sofort aufrufen, damit ein Token-Refresh in die
  // Antwort-Cookies geschrieben wird, BEVOR die Antwort committet ist.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // /api (zustandsloser Bearer) + /auth (eigenes Cookie-Handling) + statische
  // Assets ausschließen — nur Seiten-Routen refreshen.
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico).*)"],
};
