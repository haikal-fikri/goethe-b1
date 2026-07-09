#!/usr/bin/env node
/**
 * DEV-Seed für die mobile Schüler-Klasse (Phase 1) — es gibt (noch) keine Lehrkraft-App.
 *
 * Legt reale, login-fähige Fixtures an, damit das Klasse-Dashboard/Rangliste/
 * Aufgaben mit echten Daten getestet werden können:
 *   • Lehrkraft + 2 Mitschüler:innen als Auth-User (Supabase Admin-API, service_role) —
 *     per Gmail-Plus-Adressierung von SEED_EMAIL_BASE (alle Codes landen in EINEM Postfach,
 *     passwortlos, email_confirm → später per E-Mail-OTP/Magic-Link einloggbar).
 *   • Klasse, Einschreibungen (DEIN Test-Schüler via STUDENT_EMAIL + die Mitschüler),
 *     1 Schreib- + 1 Sprech-Aufgabe, points_events der laufenden ISO-Woche.
 * Daten-Rows via postgres.js über DATABASE_URL (Owner → umgeht RLS/Grants).
 * Seed-Punkte sind mit ref_id='seed-class-dev' getaggt → Re-Seed/Teardown fasst NIE
 * die echten Punkte deines Test-Schülers an.
 *
 * Läuft gegen die LIVE-Supabase (die Arbeits-DB).
 *
 *   SEED_EMAIL_BASE=du@gmail.com STUDENT_EMAIL=du@gmail.com \
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
 *   node scripts/seed-class-dev.mjs            # anlegen/aktualisieren (idempotent)
 *   node scripts/seed-class-dev.mjs --teardown # Fixtures + Fake-User entfernen
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const JOIN_CODE = "DEVKURS7"; // stabiler Konflikt-Key für die Seed-Klasse
const CLASS_NAME = "B1 Abendkurs (Dev)";
const POINTS_TAG = "seed-class-dev"; // ref_id-Tag → trennt Seed-Punkte von echten
const TEARDOWN = process.argv.includes("--teardown");

const CLASSMATES = [
  { tag: "mateo", name: "Mateo Alvarez", role: "student", points: 505 },
  { tag: "yuki", name: "Yuki Kimura", role: "student", points: 432 },
];
const STUDENT_SEED_POINTS = 300; // wird ZUSÄTZLICH zu echten Punkten gezählt

// --- env: process.env, sonst .env.local / .env parsen ----------------
function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(ROOT, f), "utf8");
      const m = txt.match(new RegExp(`^${key}\\s*=\\s*["']?([^"'\\n]+)`, "m"));
      if (m) return m[1];
    } catch { /* Datei fehlt → nächste probieren */ }
  }
  return undefined;
}
function requireEnv(key) {
  const v = loadEnv(key);
  if (!v) throw new Error(`${key} fehlt (process.env oder apps/web/.env.local).`);
  return v;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const STUDENT_EMAIL = requireEnv("STUDENT_EMAIL");
const EMAIL_BASE = requireEnv("SEED_EMAIL_BASE");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(requireEnv("DATABASE_URL"), { ssl: "require" });

const [emailLocal, emailDomain] = EMAIL_BASE.split("@");
if (!emailDomain) throw new Error("SEED_EMAIL_BASE muss eine E-Mail sein (z.B. du@gmail.com).");
const plusEmail = (tag) => `${emailLocal}+${tag}@${emailDomain}`;

// --- Auth-User-Helfer (Admin-API) ------------------------------------
async function findUserByEmail(email) {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) break; // letzte Seite
  }
  return null;
}
async function ensureUser(email, fullName, role) {
  const { data } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role },
  });
  if (data?.user) return data.user.id; // neu angelegt (Trigger legt profiles an)
  const existing = await findUserByEmail(email); // bereits vorhanden → id holen
  if (existing) return existing.id;
  throw new Error(`Konnte ${email} weder anlegen noch finden.`);
}

async function seed() {
  console.log("→ Auth-User (Lehrkraft + Mitschüler:innen) anlegen/finden…");
  const teacherId = await ensureUser(plusEmail("teacher"), "Frau Schäfer", "teacher");
  const mates = [];
  for (const m of CLASSMATES) mates.push({ ...m, id: await ensureUser(plusEmail(m.tag), m.name, m.role) });

  const student = await findUserByEmail(STUDENT_EMAIL);
  if (!student) throw new Error(`Test-Schüler ${STUDENT_EMAIL} nicht gefunden — bitte zuerst in der App registrieren.`);
  const studentId = student.id;

  // display_name der Fixtures sicherstellen (Trigger setzt es nur beim ersten Insert).
  // ::uuid-Casts: postgres.js bindet String-Params ggf. als text → uuid-Spalten brauchen den Cast.
  await sql`update profiles set display_name = ${"Frau Schäfer"} where id = ${teacherId}::uuid`;
  for (const m of mates) await sql`update profiles set display_name = ${m.name} where id = ${m.id}::uuid`;

  console.log("→ Klasse upserten…");
  const [cls] = await sql`
    insert into classes (name, join_code, teacher_id)
    values (${CLASS_NAME}, ${JOIN_CODE}, ${teacherId}::uuid)
    on conflict (join_code) do update set name = excluded.name, teacher_id = excluded.teacher_id, archived_at = null
    returning id`;
  const classId = cls.id;

  console.log("→ Einschreibungen (Schüler + Mitschüler:innen)…");
  const memberIds = [studentId, ...mates.map((m) => m.id)];
  for (const uid of memberIds) {
    await sql`
      insert into class_enrollments (class_id, student_id, status)
      values (${classId}::uuid, ${uid}::uuid, 'active')
      on conflict (class_id, student_id) do update set status = 'active', joined_at = now()`;
  }

  console.log("→ Aufgaben…");
  const titles = ["Diskussionsbeitrag schreiben", "Ein Thema präsentieren: Reisen"];
  await sql`delete from assignments where class_id = ${classId}::uuid and title = any(${titles}::text[])`;
  await sql`insert into assignments (class_id, kind, title, due_at)
            values (${classId}::uuid, 'writing', ${titles[0]}, now() + interval '3 days')`;
  await sql`insert into assignments (class_id, kind, title, due_at)
            values (${classId}::uuid, 'speaking', ${titles[1]}, now() + interval '2 days')`;

  console.log("→ Punkte (laufende ISO-Woche, getaggt)…");
  await sql`delete from points_events where ref_id = ${POINTS_TAG}`; // nur Seed-Punkte
  const pts = [[studentId, STUDENT_SEED_POINTS], ...mates.map((m) => [m.id, m.points])];
  for (const [uid, amount] of pts) {
    await sql`
      insert into points_events (user_id, kind, points, ref_id, week_key)
      values (${uid}::uuid, 'set_complete', ${amount}, ${POINTS_TAG},
              to_char((now() at time zone 'utc'), 'IYYY"-W"IW'))`;
  }

  console.log(`\n✓ Seed fertig. Klasse „${CLASS_NAME}" (Code ${JOIN_CODE}) mit ${memberIds.length} Mitgliedern.`);
  console.log(`  Login als Lehrkraft/Mitschüler: E-Mail-OTP an ${plusEmail("teacher")} etc. (Postfach ${EMAIL_BASE}).`);
}

async function teardown() {
  console.log("→ Seed-Punkte entfernen…");
  await sql`delete from points_events where ref_id = ${POINTS_TAG}`;
  console.log("→ Seed-Klasse entfernen (kaskadiert Einschreibungen + Aufgaben)…");
  await sql`delete from classes where join_code = ${JOIN_CODE}`;
  console.log("→ Fake-Auth-User löschen (Lehrkraft + Mitschüler:innen; NICHT den Test-Schüler)…");
  for (const email of [plusEmail("teacher"), ...CLASSMATES.map((m) => plusEmail(m.tag))]) {
    const u = await findUserByEmail(email);
    if (u) { await admin.auth.admin.deleteUser(u.id); console.log(`  gelöscht: ${email}`); }
  }
  console.log("\n✓ Teardown fertig.");
}

(async () => {
  try {
    if (TEARDOWN) await teardown();
    else await seed();
  } catch (e) {
    console.error("✗ Fehler:", e.message);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
})();
