# Redemittel-Trainer · Goethe B1 (Schreiben & Sprechen)

Eine Duolingo-artige Web-App zum Üben deutscher **Redemittel** für die
Goethe-B1-Prüfung. Kernmechanik: Zu einer **englischen Übersetzung** baust du
aus einer **Wortbank** den richtigen deutschen Satz zusammen. Inhalte von
**B1 bis C2**, Oberfläche auf Deutsch, mobile-first.

Stack: **Next.js 16 (App Router, TS) · Tailwind v4 · Supabase (Content-DB) · Vercel**.

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:3000 (oder nächster freier Port)
```

Die App läuft **ohne Datenbank**: Inhalte kommen aus dem gebündelten Snapshot
`src/content/corpus.json` (414 validierte Redemittel).

## Seiten

| Route | Inhalt |
|-------|--------|
| `/` | Übungsauswahl: Tabs Schreiben/Sprechen/Konnektoren, Niveau-Filter, Karten je Funktion |
| `/uebung/[lessonId]` | Übungs-Player mit Wortbank (Wörter zuordnen), Feedback, Tastatursteuerung |
| `/nachschlagen` | Read-only Referenz aller Wendungen mit Übersetzung + Suche |
| `/schreiben` | Freies Schreiben mit Redemittel-Checkliste (Selbstabgleich, ohne KI) |

Tastatur im Player: Ziffern **1–9** wählen Bank-Kacheln, **Enter** prüft/weiter,
**Backspace** entfernt die letzte Kachel.

## Korpus (Inhalte)

Die Rohdaten liegen pro Bereich in `data/corpus/*.json` (von Research-Subagenten
erzeugt). Der Merge konsolidiert, validiert und dedupliziert sie:

```bash
npm run corpus     # data/corpus/*.json → src/content/corpus.json
```

Validierte Invariante: `tokens.join(" ") === phrase` für 100 % der Items.

Aktuell: **414 Items** — Schreiben 222 · Sprechen 118 · Konnektoren 74;
Niveaus B1 125 · B2 123 · C1 110 · C2 56.

## Supabase (optional, „Source of Truth")

Schema und idempotenter Seed liegen unter `supabase/`:

```bash
npm run seed:sql   # src/content/corpus.json → supabase/seed.sql

# Schema + Daten einspielen:
psql "$DATABASE_URL" -f supabase/migrations/0001_content_schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

**Welcher Connection-String?** Für Migration + Seed (DDL + Bulk-Insert via psql)
den **Session-Pooler**- oder **Direct-Connection**-String verwenden — *nicht*
den Transaction-Pooler (Port 6543), da dieser keine Session-Features/DDL
zuverlässig unterstützt. Setze ihn als `DATABASE_URL` (siehe `.env.example`).

Alle Content-Tabellen sind `public read` (RLS); Schreibzugriff nur Service-Role.

## Deployment (Vercel)

`npm run build` ist grün; das Repo lässt sich direkt auf Vercel deployen. Da der
Korpus-Snapshot mitgebaut wird, sind für den MVP keine Env-Variablen nötig.
