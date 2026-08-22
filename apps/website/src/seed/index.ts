/**
 * Startbestand aus dem Design einspielen.
 *
 *   npm run seed --workspace website
 *
 * Idempotent: Alles wird über einen natürlichen Schlüssel (Slug bzw. Name)
 * gesucht und aktualisiert, sonst angelegt. Ein zweiter Lauf ändert nichts.
 *
 * Alle Schreibvorgänge tragen `context: { seeding: true }` — sonst würde jeder
 * einzelne Datensatz eine Revalidierung auslösen.
 */
import { getPayload } from "payload";
import config from "../payload.config";
import { slugify } from "../fields/slug";
import { parseGermanDate } from "../lib/dates";
import {
  AUTHORS,
  DOC_APPLIES_TO,
  DOC_GROUPS,
  DOC_UPDATED_ON,
  POPULAR_DOCS,
  POSTS,
  PRICING,
  SITE_SETTINGS,
} from "./data";
import { bold, callout, code, h3, h4, link, list, paragraph, pullQuote, resetIds, root } from "./lexical";

const seeding = { seeding: true } as const;

/** Aufbau jedes Artikels im Design: Vorspann → Abschnitte → Zitat → Fazit. */
function postBody(post: (typeof POSTS)[number]) {
  return root(
    ...post.sections.flatMap((section) => [h3(section.h), paragraph(section.p)]),
    pullQuote(post.quote, post.quoteBy),
    h3("Fazit"),
    paragraph(post.outro)
  );
}

/** Der einzige im Design vollständig ausgeschriebene Doku-Artikel. */
function aufgabenZuweisenBody() {
  return root(
    paragraph(
      "Aufgaben sind die Verbindung zwischen Kurs und App: Sie wählen eine Aufgabe aus dem Prüfungs-Korpus, setzen Klasse und Frist, und die Lernenden sehen sie sofort auf ihrem Gerät. Eingereichte Texte und Aufnahmen laufen anschließend in Ihre Bewertungs-Queue."
    ),
    h3("Voraussetzungen"),
    list([
      [
        "Eine Klasse mit mindestens einer teilnehmenden Person (siehe ",
        link("Klasse anlegen", "/dokumentation/erste-schritte/klasse-anlegen"),
        ").",
      ],
      ["Rolle ", code("Lehrkraft"), " oder ", code("Admin"), " in der jeweiligen Einrichtung."],
    ]),
    h3("Aufgabe zuweisen"),
    h4("1. Aufgabe auswählen"),
    paragraph(
      "Öffnen Sie ",
      bold("Aufgaben › Korpus"),
      " und filtern Sie nach Prüfungsteil und Niveau. Jede Aufgabe zeigt das zugehörige Bewertungsraster — bei Schreiben vier Kriterien à 10 Punkte, bei Sprechen die drei Teile der mündlichen Prüfung."
    ),
    h4("2. Klasse und Frist setzen"),
    paragraph(
      "Wählen Sie eine oder mehrere Klassen. Die Frist bestimmt, bis wann eingereicht werden kann; nach Ablauf bleibt die Aufgabe sichtbar, wird aber als ",
      code("verspätet"),
      " markiert statt gesperrt."
    ),
    h4("3. Freigeben"),
    paragraph(
      "Mit ",
      bold("Zuweisen"),
      " erscheint die Aufgabe in der App und in der Wochenübersicht der Klasse. Push-Benachrichtigungen gehen nur an Teilnehmende, die sie aktiviert haben."
    ),
    callout(
      "note",
      "Sprechaufgaben brauchen Mikrofonrechte auf dem Gerät. Bei Kursen mit geteilten Tablets weisen Sie Sprechen besser als Hausaufgabe zu — parallele Aufnahmen im selben Raum senken die Bewertungsqualität deutlich."
    ),
    h3("Was Lernende sehen"),
    paragraph(
      "In der App erscheint die Aufgabe unter ",
      bold("Heute"),
      " mit Prüfungsteil, geschätzter Dauer und Frist. Nach dem Einreichen erhalten Lernende innerhalb einer Minute eine KI-Einschätzung; die verbindliche Bewertung erscheint erst, wenn Sie sie freigegeben haben."
    ),
    h3("Fehlerbehebung"),
    list([
      [bold("Aufgabe erscheint nicht:"), " Prüfen Sie, ob die Person der Klasse zugeordnet und ihr Konto aktiv ist."],
      [bold("Frist falsch:"), " Fristen folgen der Zeitzone der Einrichtung, nicht der des Geräts."],
      [
        bold("Aufnahme fehlt:"),
        " Bei Netzabbruch bleibt die Aufnahme lokal gespeichert und wird beim nächsten Start übertragen.",
      ],
    ])
  );
}

/** Platzhalter für die noch nicht geschriebenen Artikel. */
function stubBody(title: string) {
  return root(
    paragraph(
      `Dieser Artikel entsteht gerade. Wenn Sie zu „${title}“ schon jetzt Unterstützung brauchen, schreiben Sie uns — wir schicken Ihnen die Unterlagen direkt.`
    )
  );
}

async function main() {
  resetIds();
  const payload = await getPayload({ config });
  payload.logger.info("Seed startet …");

  /* ── Autorinnen und Autoren ── */
  const authorIds = new Map<string, number>();
  for (const author of AUTHORS) {
    const existing = await payload.find({
      collection: "authors",
      where: { name: { equals: author.name } },
      limit: 1,
      pagination: false,
    });
    const data = { name: author.name, role: author.role, initials: author.initials };
    const saved = existing.docs[0]
      ? await payload.update({ collection: "authors", id: existing.docs[0].id, data, context: seeding })
      : await payload.create({ collection: "authors", data, context: seeding });
    authorIds.set(author.key, saved.id);
  }
  payload.logger.info(`${authorIds.size} Autor/innen`);

  /* ── Beiträge ── */
  for (const post of POSTS) {
    const slug = slugify(post.title);
    const authorId = authorIds.get(post.authorKey);
    if (!authorId) throw new Error(`Unbekannte Autor-Kennung: ${post.authorKey}`);

    const data = {
      title: post.title,
      slug,
      category: post.category as "praxis",
      readingTime: post.readingTime,
      publishedAt: parseGermanDate(post.date),
      featured: Boolean(post.featured),
      author: authorId,
      excerpt: post.excerpt,
      lead: post.lead,
      body: postBody(post) as never,
    };

    const existing = await payload.find({
      collection: "posts",
      where: { slug: { equals: slug } },
      limit: 1,
      pagination: false,
    });
    if (existing.docs[0]) {
      await payload.update({ collection: "posts", id: existing.docs[0].id, data, context: seeding });
    } else {
      await payload.create({ collection: "posts", data, context: seeding });
    }
  }
  payload.logger.info(`${POSTS.length} Beiträge`);

  /* ── Doku-Kapitel und -Artikel ── */
  let docCount = 0;
  for (const group of DOC_GROUPS) {
    const groupSlug = slugify(group.label);
    const groupData = {
      label: group.label,
      slug: groupSlug,
      order: group.order,
      description: group.description,
    };
    const existingGroup = await payload.find({
      collection: "doc-groups",
      where: { slug: { equals: groupSlug } },
      limit: 1,
      pagination: false,
    });
    const savedGroup = existingGroup.docs[0]
      ? await payload.update({
          collection: "doc-groups",
          id: existingGroup.docs[0].id,
          data: groupData,
          context: seeding,
        })
      : await payload.create({ collection: "doc-groups", data: groupData, context: seeding });

    for (const [index, title] of group.items.entries()) {
      const docSlug = slugify(title);
      const data = {
        title,
        slug: docSlug,
        group: savedGroup.id,
        order: index + 1,
        popular: POPULAR_DOCS.includes(title),
        // Reihenfolge der kuratierten Liste aus dem Design (1-basiert).
        popularOrder: POPULAR_DOCS.includes(title) ? POPULAR_DOCS.indexOf(title) + 1 : null,
        updatedOn: parseGermanDate(DOC_UPDATED_ON),
        appliesTo: DOC_APPLIES_TO,
        body: (title === "Aufgaben zuweisen" ? aufgabenZuweisenBody() : stubBody(title)) as never,
      };

      const existing = await payload.find({
        collection: "docs",
        where: { and: [{ slug: { equals: docSlug } }, { group: { equals: savedGroup.id } }] },
        limit: 1,
        pagination: false,
      });
      if (existing.docs[0]) {
        await payload.update({ collection: "docs", id: existing.docs[0].id, data, context: seeding });
      } else {
        await payload.create({ collection: "docs", data, context: seeding });
      }
      docCount += 1;
    }
  }
  payload.logger.info(`${DOC_GROUPS.length} Kapitel, ${docCount} Doku-Artikel`);

  /* ── Globals ── */
  await payload.updateGlobal({
    slug: "site-settings",
    data: SITE_SETTINGS,
    context: seeding,
  });
  await payload.updateGlobal({
    slug: "pricing",
    data: {
      note: PRICING.note,
      tiers: PRICING.tiers.map((tier) => ({
        ...tier,
        features: tier.features.map((entry) => ({ text: entry })),
      })),
    },
    context: seeding,
  });
  payload.logger.info("Globals gesetzt (Website-Einstellungen, Preise)");

  payload.logger.info("Seed fertig.");
}

// Bewusst Top-Level-await statt `main().catch(...)`:
// `payload run` beendet den Prozess, sobald die Auswertung des Moduls fertig
// ist. Eine frei laufende Promise käme nie zum Zug — das Skript liefe ohne
// Fehlermeldung mit Exit-Code 0 durch, ohne irgendetwas zu schreiben.
try {
  await main();
} catch (error) {
  console.error("Seed fehlgeschlagen:", error);
  process.exit(1);
}
