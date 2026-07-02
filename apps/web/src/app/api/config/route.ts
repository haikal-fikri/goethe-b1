import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Öffentliche Feature-Flags (ferngesteuert via app_config). Der Mobile-Client
// liest das beim Start (gecacht) → class_enabled ohne App-Store-Release umlegen.
export async function GET() {
  try {
    const rows = await sql<{ key: string; value: unknown }[]>`select key, value from app_config`;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return Response.json(
      { classEnabled: map.get("class_enabled") === true },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch {
    // Fail-safe: Flag AUS, wenn die Config nicht lesbar ist.
    return Response.json({ classEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
