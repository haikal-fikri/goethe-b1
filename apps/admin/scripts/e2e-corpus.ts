// E2E-Prüfung des Korpus-Schreibpfads gegen ein ECHTES Postgres.
//
// Deckt ab, was weder Typcheck noch Schema-Tests sehen: ob der sql()-Helfer
// gültiges SQL erzeugt, ob die advisory-lock-Transaktion das ID-Rennen
// wirklich schließt, ob die Audit-Zeile mit der Mutation committet UND mit ihr
// zurückrollt, und ob ein Ein-Feld-PATCH andere Spalten in Ruhe lässt.
//
// Läuft NIE gegen die Live-DB — immer gegen einen Wegwerf-Cluster:
//
//   export PATH=/opt/homebrew/opt/postgresql@16/bin:$PATH
//   initdb -D /tmp/pgtest -U postgres --auth=trust
//   pg_ctl -D /tmp/pgtest -o "-p 5433 -c listen_addresses=localhost" -l /tmp/pg.log start
//   createdb -h localhost -p 5433 -U postgres corpus_test
//   U="postgresql://postgres@localhost:5433/corpus_test"
//   psql "$U" -q -f ../web/supabase/tests/00_bootstrap_shim.sql
//   for f in ../web/supabase/migrations/*.sql; do psql "$U" -q -v ON_ERROR_STOP=1 -f "$f"; done
//
//   # Node löst erweiterungslose Importe (@repo/core-Barrel) nicht von selbst
//   # auf — dafür der Resolve-Hook daneben:
//   DATABASE_URL="$U" node --conditions=react-server --experimental-strip-types \
//     --import=./scripts/strip-resolve-hook.mjs ./scripts/e2e-corpus.ts
//
//   pg_ctl -D /tmp/pgtest stop -m fast && rm -rf /tmp/pgtest
//
// `--conditions=react-server` ist nötig, weil corpus.ts "server-only"
// importiert; ohne die Bedingung wirft dessen Standard-Export beim Import.
import postgres from "postgres";
import {
  createCorpus,
  updateCorpus,
  deleteCorpus,
  CorpusError,
} from "../src/lib/corpus.ts";

const URL_ = process.env.DATABASE_URL!;
const raw = postgres(URL_, { max: 4, prepare: false });
const ACTOR = "00000000-0000-0000-0000-0000000000ad";

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}   ${detail}`); }
};
const auditCount = async (target: string) =>
  Number((await raw`select count(*)::int as n from audit_log where target = ${target}`)[0].n);

async function main() {
  // audit_log.actor -> auth.users(id); ein Akteur muss existieren.
  await raw`insert into auth.users (id) values (${ACTOR}) on conflict do nothing`;

  console.log("\n--- Kategorien anlegen (Fremdschlüssel für redemittel) ---");
  await createCorpus("skills", { code: "schreiben", nameDe: "Schreiben", sortOrder: 1 }, ACTOR)
    .catch(() => console.log("  (skills existierte bereits aus dem Seed)"));
  await createCorpus("tasks", { code: "t_e2e", skillCode: "schreiben", labelDe: "E2E", labelEn: "E2E" }, ACTOR);
  await createCorpus("functions", { code: "f_e2e", nameDe: "E2E", nameEn: "E2E" }, ACTOR);
  check("tasks/functions angelegt",
    Number((await raw`select count(*)::int as n from tasks where code='t_e2e'`)[0].n) === 1);

  console.log("\n--- Redemittel: Anlegen + auditierte Transaktion ---");
  const R = "e2e-w-001";
  await createCorpus("redemittel", {
    id: R, phraseDe: "Ich bin dafür", translationEn: "I am in favour",
    level: "B1", skillCode: "schreiben", taskCode: "t_e2e", functionCode: "f_e2e",
    tokens: ["Ich", "bin", "dafür"], distractors: ["Ich bin dafuer"], tags: ["meinung"], difficulty: 3,
  }, ACTOR);
  const row0 = (await raw`select * from redemittel where id = ${R}`)[0];
  check("Zeile geschrieben", row0?.phrase_de === "Ich bin dafür");
  check("distractors erhalten", row0?.distractors?.length === 1);
  check("difficulty erhalten", row0?.difficulty === 3);
  check("Audit-Zeile in derselben Transaktion", (await auditCount(`redemittel:${R}`)) === 1);

  console.log("\n--- DER GEMELDETE FEHLER: Ein-Feld-PATCH darf nichts löschen ---");
  await updateCorpus("redemittel", { id: R, notes: "Tippfehler korrigiert" }, ACTOR);
  const row1 = (await raw`select * from redemittel where id = ${R}`)[0];
  check("distractors NICHT geleert", row1.distractors.length === 1, JSON.stringify(row1.distractors));
  check("tags NICHT geleert", row1.tags.length === 1, JSON.stringify(row1.tags));
  check("difficulty NICHT zurückgesetzt", row1.difficulty === 3, String(row1.difficulty));
  check("notes gesetzt", row1.notes === "Tippfehler korrigiert");

  console.log("\n--- Invariante: phrase_de und tokens nur gemeinsam ---");
  let abgelehnt = false;
  await updateCorpus("redemittel", { id: R, phraseDe: "Ich bin dagegen" }, ACTOR).catch(() => { abgelehnt = true; });
  check("Phrase ohne tokens abgelehnt", abgelehnt);
  await updateCorpus("redemittel",
    { id: R, phraseDe: "Ich bin dagegen", tokens: ["Ich", "bin", "dagegen"], clozeTemplate: "" }, ACTOR);
  const row2 = (await raw`select phrase_de, tokens from redemittel where id = ${R}`)[0];
  check("gemeinsames Ändern greift", row2.tokens.join(" ") === row2.phrase_de, JSON.stringify(row2));

  console.log("\n--- parent_id ist nicht änderbar (Löschsperre bleibt) ---");
  await updateCorpus("redemittel", { id: R, parentId: "irgendwas" } as never, ACTOR).catch(() => {});
  check("parent_id unverändert null",
    (await raw`select parent_id from redemittel where id = ${R}`)[0].parent_id === null);
  let sperre = false;
  await deleteCorpus("redemittel", { id: R }, ACTOR)
    .catch((e) => { sperre = e instanceof CorpusError && e.status === 409; });
  check("kanonische Zeile nicht löschbar (409)", sperre);

  console.log("\n--- Beispiel-Kindzeile: anlegen und löschen ---");
  const KID = `${R}#ex1`;
  await createCorpus("redemittel", {
    id: KID, parentId: R, phraseDe: "Ich bin dagegen, weil es zu teuer ist.",
    translationEn: "I am against it because it is too expensive.",
    level: "B1", skillCode: "schreiben", taskCode: "t_e2e", functionCode: "f_e2e", tokens: [],
  }, ACTOR);
  check("Kindzeile mit leeren tokens angelegt",
    (await raw`select parent_id from redemittel where id = ${KID}`)[0]?.parent_id === R);
  await deleteCorpus("redemittel", { id: KID }, ACTOR);
  check("Kindzeile löschbar",
    Number((await raw`select count(*)::int as n from redemittel where id = ${KID}`)[0].n) === 0);

  console.log("\n--- Übersetzung: Upsert darf translator nicht nullen ---");
  await createCorpus("redemittel-translation",
    { rowId: R, lang: "en", translation: "I am against it", translator: "Haikal", status: "draft" }, ACTOR);
  await updateCorpus("redemittel-translation", { rowId: R, lang: "en", translation: "I disagree" }, ACTOR);
  const tr = (await raw`select * from redemittel_translation where row_id=${R} and lang='en'`)[0];
  check("translator erhalten", tr.translator === "Haikal", String(tr.translator));
  check("status NICHT auf reviewed gesetzt", tr.status === "draft", String(tr.status));

  console.log("\n--- Leerer PATCH wird abgelehnt (requireFields greift) ---");
  let leer = false;
  await updateCorpus("redemittel", { id: R }, ACTOR)
    .catch((e) => { leer = e instanceof CorpusError && e.status === 400; });
  check("PATCH ohne Änderung -> 400", leer);

  console.log("\n--- §4.3: gleichzeitige Simulationsanlagen ---");
  const mk = (n: number) => createCorpus("exam-simulations", {
    titleDe: `Parallel ${n}`,
    tasks: [1, 2, 3].map((a) => ({
      aufgabe: a, taskType: "E-Mail", titleDe: `A${a}`, promptDe: "Schreiben Sie.",
      bulletPointsDe: ["Punkt eins"], minWords: 80, recommendedMinutes: 20,
    })),
  }, ACTOR);
  const ergebnisse = await Promise.all([mk(1), mk(2), mk(3), mk(4)]);
  const ids = ergebnisse.map((r) => Number(r.id));
  check("vier gleichzeitige Anlagen, vier verschiedene IDs",
    new Set(ids).size === 4, JSON.stringify(ids));
  const aufgaben = Number((await raw`
    select count(*)::int as n from exam_tasks where simulation_id = any(${ids})`)[0].n);
  check("je Simulation drei Aufgaben", aufgaben === 12, String(aufgaben));
  check("Leitpunkte gespeichert",
    (await raw`select bullet_points_de from exam_tasks where simulation_id=${ids[0]} limit 1`)[0]
      .bullet_points_de.length === 1);

  console.log("\n--- exam-tasks PATCH darf Leitpunkte nicht löschen ---");
  const taskId = `s${ids[0]}-a1`;
  await updateCorpus("exam-tasks", { id: taskId, promptDe: "Neu formuliert." }, ACTOR);
  const et = (await raw`select prompt_de, bullet_points_de from exam_tasks where id=${taskId}`)[0];
  check("bullet_points_de erhalten", et.bullet_points_de.length === 1, JSON.stringify(et.bullet_points_de));
  check("prompt_de geändert", et.prompt_de === "Neu formuliert.");

  console.log("\n--- Rollback: schlägt die Mutation fehl, bleibt keine Audit-Zeile ---");
  const vorher = Number((await raw`select count(*)::int as n from audit_log`)[0].n);
  await createCorpus("redemittel", {
    id: "e2e-fk-fail", phraseDe: "Test", translationEn: "Test", level: "B1",
    skillCode: "schreiben", taskCode: "GIBT_ES_NICHT", functionCode: "f_e2e", tokens: ["Test"],
  }, ACTOR).catch(() => {});
  const nachher = Number((await raw`select count(*)::int as n from audit_log`)[0].n);
  check("kein Audit-Eintrag nach Fehlschlag", vorher === nachher, `${vorher} -> ${nachher}`);

  console.log(`\n=== ${pass} bestanden, ${fail} fehlgeschlagen ===`);
  await raw.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("\nABBRUCH:", e);
  await raw.end();
  process.exit(1);
});
