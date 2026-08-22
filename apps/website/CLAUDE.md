# apps/website — Marketing-Website (Next.js 16 + Payload CMS 3)

Öffentliche Marketing-Website des **Digital Sprache Institut** plus das darin
eingebettete Payload-Admin. Vercel-Projekt D, Dev-Port **3003**.

Kein Teil des Produkts: LMS, Mobile-App und Superadmin-Konsole leben in
`apps/teacher-web`, `apps/mobile`, `apps/admin`. Diese App verlinkt sie nur
(`https://lernen.digi-s.institute`).

```bash
npm run dev   --workspace website   # localhost:3003
npm run build --workspace website   # einzige automatisierte Prüfung im Repo
npm run seed  --workspace website   # Inhalte aus dem Design einspielen (idempotent)
```

## Design ist die Spezifikation

Quelle ist `B1 Trainer Website.dc.html` im Claude-Design-Projekt
**„German B1 exam trainer"** (`5c4c08b1-d220-4a9d-a68d-962a5962bcc5`), zusammen
mit `styles.css` → `tokens/*.css`. Lesen über das `DesignSync`-Tool
(`method: "get_file"`).

- **Alle Texte sind deutsch und wörtlich übernommen.** Ein englischer String im
  UI ist ein Bug, keine Verbesserung. Copy nicht umformulieren, kürzen oder
  „glätten" — auch nicht die juristischen Entwürfe.
- **`src/app/(site)/globals.css` ist ein wörtlicher Port.** Farben, Radien,
  Schriftgrößen und besonders die beiden Media-Query-Stufen (`max-width:1060px`,
  `max-width:900px`, inklusive aller `!important`) stammen 1:1 aus dem Design.
  Nicht aufräumen, nicht in Utilities übersetzen, keine Werte „per Auge"
  nachziehen.
- **Kein Tailwind in dieser App** — bewusste Abweichung vom Repo-Standard. Das
  Design besteht aus Inline-Styles mit Einzelwerten (13.5px, `22px 0` …) und
  klassenbasierten `!important`-Breakpoints; eine Tailwind-Übersetzung wäre
  reines Übersetzungsrisiko ohne Gewinn. Element-Styles bleiben inline
  (`style={{…}}`), Klassen tragen nur Breakpoint- und Hover-Verhalten.
- **Theme**: nur `prefers-color-scheme`. Kein Umschalter, kein `data-theme`,
  kein Init-Skript. Die Dark-Tokens stehen in einem Media-Block in
  `globals.css`.
- **Schriften**: `next/font/google` (Jost, Source Serif 4) — zur Build-Zeit
  geladen und selbst ausgeliefert. Zur Laufzeit darf die Seite **keine**
  Drittanbieter-Requests machen (DSGVO-Aussage der Copy). Kein Mono-Webfont.

### Bildplätze (`data-image-slot`)

Acht Plätze aus dem Design, exakt in Position, Seitenverhältnis und Größe:
`hero-lms` (16:10) · `hero-app` (9:19) · `home-ablauf` · `sol-app` · `sol-lms` ·
`about-hero` · `blog-featured` · `article-hero`.

Regeln: nicht zusammenlegen, weglassen, umsortieren oder ergänzen. Ohne Bild
zeigt `<ImageSlot>` einen beschrifteten Platzhalter in `--surface-alt` — das
Layout steht bereits final, es entsteht nie ein Sprung oder Loch. **Keine
generierten, illustrierten oder Stock-Bilder einsetzen.** Das Einsetzen eines
echten Assets ist eine reine Inhaltsänderung (Upload im Admin), nie eine
Layout-Änderung: Die sechs Marketing-Plätze hängen am Global `siteSettings`,
`blog-featured`/`article-hero` an `posts.heroImage`.

## Payload

- Config: `src/payload.config.ts`, Admin unter `/admin`, REST unter `/api`
  (Route-Gruppe `src/app/(payload)`).
- **Das Frontend liest ausschließlich über die Local API** (`src/lib/payload.ts`
  → `getPayload`). Kein `fetch` auf die eigene REST-Schnittstelle. Die
  REST-Routen existieren nur für das Admin-UI.
- **Datenbank**: dasselbe Supabase-Postgres wie die übrigen Apps, aber eigenes
  Schema **`payload`** (`schemaName`). Payload-Migrationen fassen App-Tabellen
  nicht an.
  - `DATABASE_URL` muss auf den **Session-Pooler (5432)** zeigen. Der
    Transaction-Pooler (6543) blockiert DDL — Migrationen scheitern dort.
  - Vor jedem Migrations- oder Seed-Lauf prüfen, ob `DATABASE_URL` auf Dev oder
    Produktion zeigt (Repo-Regel; es gibt keine Tracking-Tabelle).
  - Für Produktion echte Migrationen committen: `npm run payload --workspace
    website migrate:create`. Dev-Push nie gegen die Produktions-DB.
- **Medien** liegen in einem eigenen Cloudflare-R2-Bucket
  (`@payloadcms/storage-s3`). Ohne `R2_*`-Variablen speichert Payload lokal —
  nur für Dev brauchbar, überlebt kein Vercel-Deploy.
- Nach Änderungen an Collections: `npm run generate:types --workspace website`
  (schreibt `src/payload-types.ts`). Nach neuen Admin-Komponenten:
  `npm run generate:importmap --workspace website`.

## Rendering und Revalidierung

Statisch zuerst: Marketing- und Rechtstexte sind hart im Code, Blog und
Dokumentation kommen aus Payload und werden zur Build-Zeit generiert
(`generateStaticParams`). `cacheComponents`/PPR ist **aus** — Payloads Admin
unterstützt es nicht, und das klassische Modell genügt hier.

Invalidiert wird ausschließlich pfadbasiert über `src/lib/revalidate.ts`, das
die `afterChange`/`afterDelete`-Hooks der Collections aufrufen. Wichtig:

- Jeder Hook steigt bei `context.seeding` früh aus — sonst löst der Seed
  hunderte Revalidierungen aus.
- Revalidierung greift nur bei Änderungen **durch das eingebettete Admin bzw.
  die Local API**. Wer direkt auf der Datenbank schreibt, sieht die Änderung
  erst beim nächsten Deploy.

## Kontaktformular

Server Action (`src/app/(site)/kontakt/actions.ts`), kein öffentlicher
Endpunkt. Reihenfolge: Honeypot → Zod-Validierung → Rate-Limit → Persistenz →
E-Mail. Details:

- Rate-Limit über die geteilte Engine aus `@repo/server` mit **eigenem Präfix
  `rl:site:*`** (neben `rl:api:*` Web, `tb:*` Lehrkraft, `tc:*` Admin) — ein
  Upstash-Konto für alle Apps.
- Aus `@repo/server` nutzt diese App ausschließlich die Rate-Limit-Funktionen.
  Das Paket exportiert auch `db`/`supabaseServer` für die anderen Apps; beides
  ist hier fehl am Platz — die Website spricht die Datenbank nur über Payload
  an. (Der Import ist ungefährlich: `db.ts` baut die Verbindung faul auf, ein
  Build ohne `DATABASE_URL` scheitert daran nicht.)
- **Cloudflare Turnstile** (`src/lib/turnstile.ts`, Widget in `ContactForm`).
  Aktiv nur, wenn `NEXT_PUBLIC_TURNSTILE_SITE_KEY` **und**
  `TURNSTILE_SECRET_KEY` gesetzt sind — beide gehören zusammen. Nur das Secret
  zu setzen weist jede Anfrage ab (der Client sendet dann kein Token), nur den
  Site-Key zu setzen zeigt das Widget, ohne es zu prüfen. Ohne beide läuft die
  lokale Entwicklung unverändert. Fehlt das Token, wird abgewiesen
  (fail-closed); ist Cloudflare nicht erreichbar, wird durchgelassen — in dem
  seltenen Fenster deckelt das Rate-Limit. Ein Token gilt nur einmal, deshalb
  lädt das Formular das Widget nach jeder Fehlerantwort neu (`resetTurnstile`).
- Versand über Resend (`src/lib/resend.ts`, gleiche Lazy-Singleton-Konvention
  wie `apps/web`). Schlägt der Versand fehl, gilt die Anfrage trotzdem als
  angenommen — sie liegt bereits in `contactSubmissions`.
- Das Attribut `data-crm-form="demo-request"` am `<form>` ist ein
  CRM-Integrationshaken und muss erhalten bleiben.

## Bewusste Abweichungen vom Design

Alles andere ist 1:1 übernommen. Diese Punkte sind abgestimmt:

1. **„War dieser Artikel hilfreich?"** auf Doc-Seiten wurde ersatzlos entfernt
   (Entscheidung des Auftraggebers).
2. **Suche in der Dokumentation** ist funktionsfähig (clientseitig über einen
   zur Build-Zeit erzeugten Index) statt dekorativ.
3. Klickbare `div`s des Mocks sind echte `<a>`/`<button>`; Trefferflächen
   erreichen auf Touch-Geräten 44px (unsichtbar vergrößert, Optik unverändert).
4. **Das Burger-Symbol wird bei offenem Menü zum X** (im Entwurf blieb es
   unverändert). Nachträglich gewünscht.
6. **Kein Milchglas auf der Kopfzeile** — der Entwurf hatte `--tabbar-bg`
   (halbtransparent) + `backdrop-filter: blur(14px)`; jetzt deckend
   `var(--surface-1)`. Nachträglich gewünscht. Die Notch-Farben (html/body in
   globals.css, themeColor in layout.tsx) sind daran gekoppelt.
5. **Turnstile im Kontaktformular** — im Entwurf nicht vorgesehen, nachträglich
   gewünscht. Siehe den Datenschutz-Hinweis weiter unten.

## Fallstricke, die uns schon getroffen haben

Alles hier ist einmal schiefgegangen und wurde nachgeprüft — bitte nicht
„vereinfachen".

- **Diese App ist ESM** (`"type": "module"` in der package.json). Ohne das lädt
  Payloads CLI die Config als CommonJS und scheitert am Top-Level-await von
  `@payloadcms/richtext-lexical`. Deshalb auch kein `__dirname` in
  `next.config.ts`, sondern `fileURLToPath(import.meta.url)`.
- **`payload run` beendet den Prozess, sobald das Modul ausgewertet ist.** Ein
  `main().catch(...)` am Dateiende liefe nie — das Skript endet mit Code 0, ohne
  irgendetwas getan zu haben. Skripte deshalb mit Top-Level-await schreiben
  (siehe `src/seed/index.ts`).
- **Der `@/`-Alias funktioniert unter `payload run` nicht.** Im Seed relative
  Importe verwenden.
- **Seed immer mit `NODE_ENV=production` laufen lassen:**
  `NODE_ENV=production npm run seed --workspace website`. Sonst schiebt Payload
  im Dev-Modus Schema-Änderungen direkt in die Datenbank („push"), und der
  nächste `payload migrate` fragt interaktiv nach, ob Datenverlust in Ordnung
  ist — im CI hängt der Befehl dann.
- **Payload erzeugt das Schema nicht selbst.** Bei gesetztem `schemaName` legt
  die generierte Migration Tabellen *im* Schema an, aber nie das Schema. Die
  erste Migration enthält deshalb ein handgefügtes
  `CREATE SCHEMA IF NOT EXISTS "payload"` — bei einer Neugenerierung wieder
  ergänzen, sonst scheitert jede frische Datenbank mit
  `schema "payload" does not exist`.
- **`revalidatePath(pfad, "layout")` braucht den Route-Gruppen-Pfad.** Next
  bildet die Layout-Cache-Tags aus dem unnormalisierten Pfad
  (`_N_T_/(site)/dokumentation/layout`), `revalidatePath("/dokumentation",
  "layout")` erzeugt aber `_N_T_/dokumentation/layout` — das passt auf nichts,
  die Invalidierung liefe ins Leere. `revalidateLayout()` in
  `src/lib/revalidate.ts` ruft beide Schreibweisen auf.
- **JSON-LD nie mit blankem `JSON.stringify` einbetten.** `JSON.stringify`
  maskiert `<` nicht; ein `</script>` in einem Titel bricht aus dem Element aus.
  Immer `jsonLdScript()` aus `src/lib/jsonld.ts` verwenden.
- **Die 404-Seite läuft ohne Kopf- und Fußzeile und ohne `lang`-Attribut.** Weil
  die App zwei Root-Layouts hat, rendert Next die not-found-Grenze in einer
  eingebauten Minimal-Hülle (`<html id="__next_error__">`). Nexts Lösung dafür
  ist `app/global-not-found.tsx` mit `experimental.globalNotFound` — in 16.2.7
  ist die Option nur im Webpack-Build verdrahtet und bleibt unter Turbopack
  wirkungslos (nachgeprüft: die Route taucht nicht im app-paths-manifest auf).
  Die Seite ist deutsch, korrekt mit Status 404 und gestylt; sobald die Option
  unter Turbopack greift, kann man auf `global-not-found.tsx` umstellen.

## Offen vor dem Launch

- **Datenschutz, AGB und Cookie-Richtlinie sind Entwürfe** („Entwurf zur
  juristischen Prüfung") mit Platzhaltern wie `[Straße]`, ebenso der
  Anbieter-Block auf `/ueber-uns`. Vor Launch juristisch prüfen lassen.
- Die Cookie-Richtlinie beschreibt ein `prefs`-Cookie und einen Link
  „Cookie-Einstellungen" im Fuß, die es auf dieser Website nicht gibt — die
  Seite setzt überhaupt keine Cookies. Vermutlich beschreibt der Text LMS/App.
- **Kontrast des Marken-Grüns.** `--gruen: #1C8A5B` aus dem Design-System
  erreicht die WCAG-AA-Schwelle knapp nicht: Weiß auf Grün **4,34:1** und Grün
  als Text auf Papier **4,20:1** (nötig sind 4,5:1); der Hover-Ton
  `--gruen-alt #2E9E6B` kommt auf 3,27:1. Das betrifft jeden grünen Button und
  jeden Fließtext-Link und kostet in Lighthouse den Punkt „color-contrast".
  Der Wert wurde NICHT eigenmächtig geändert: Dasselbe Token benutzen App, LMS
  und Admin — eine Änderung ist eine Marken-Entscheidung. Fix wäre eine Zeile in
  `globals.css`: `--gruen: #177A50` (Weiß/Grün 5,34:1, Grün/Papier 5,16:1) bei
  praktisch gleichem Farbeindruck. Bitte entscheiden.
- Ebenfalls unter der Schwelle, beides Design-Tokens: `--text-3` als
  Platzhalterfarbe in Eingabefeldern (2,10:1) und `--gruen` auf `--gruen-tint`
  im aktiven Seitenleisten-Eintrag (3,77:1).
- **Turnstile ist die einzige Drittanbieter-Verbindung der Website.** Ist es
  aktiv, lädt `/kontakt` ein Skript von `challenges.cloudflare.com`. Die
  Datenschutzerklärung nennt Cloudflare bisher nicht, und die Cookie-Richtlinie
  führt nur `session`, `csrf`, `prefs` und `stats` auf. Beides gehört in die
  juristische Prüfung — ohne Turnstile-Keys macht die Seite weiterhin keinen
  einzigen Drittanbieter-Request.
- Store-Links und Preise sind Design-Platzhalter und liegen in den Globals
  `siteSettings` / `pricing` — im Admin änderbar, ohne Deploy.
