/**
 * Inhalte aus `B1 Trainer Website.dc.html` — wörtlich übernommen.
 *
 * Nichts hier umformulieren, kürzen oder „verbessern": Das Design ist die
 * Spezifikation. Neue Beiträge und Artikel entstehen im Admin, nicht in dieser
 * Datei; sie bildet nur den Startbestand ab.
 */

export type SeedAuthor = { key: string; name: string; role: string; initials: string };

export const AUTHORS: SeedAuthor[] = [
  { key: "autor", name: "Marlene Köhler", role: "Didaktik & Bewertungsqualität", initials: "MK" },
  { key: "autorTech", name: "Jonas Reiter", role: "Produkt & Plattform", initials: "JR" },
  { key: "autorRecht", name: "Anneke Vogt", role: "Datenschutz & Compliance", initials: "AV" },
];

export type SeedPost = {
  category: string;
  date: string;
  readingTime: string;
  authorKey: string;
  title: string;
  excerpt: string;
  lead: string;
  sections: { h: string; p: string }[];
  quote: string;
  quoteBy: string;
  outro: string;
  featured?: boolean;
};

export const POSTS: SeedPost[] = [
  {
    featured: true,
    category: "praxis",
    date: "12. August 2026",
    readingTime: "7 Min",
    authorKey: "autor",
    title: "KI-Feedback im Prüfungstraining: was Lernende wirklich weiterbringt",
    // Der Aufmacher zeigt im Design diesen Text auf der großen Karte.
    excerpt:
      "Sofortige Rückmeldung motiviert — aber nur, wenn sie an das Bewertungsraster der Prüfung gebunden ist. Sechs Beobachtungen aus zwei Semestern B1-Kursen.",
    lead: "Sofortiges Feedback ist das stärkste Argument für KI im Sprachunterricht — und gleichzeitig das am schnellsten verbrannte. Wenn die Rückmeldung nicht dieselbe Sprache spricht wie die Prüfung, üben Lernende auf ein Ziel hin, das es am Prüfungstag nicht gibt.",
    sections: [
      {
        h: "Feedback braucht ein Raster, keine Meinung",
        p: "In den ersten Wochen haben wir Freitext-Feedback getestet: freundlich formulierte Hinweise, was am Text gut war und was fehlte. Die Lernenden fanden es hilfreich, die Ergebnisse veränderten sich aber kaum. Erst als jede Rückmeldung an die vier Kriterien der Prüfung gebunden war — mit den Stufen 10 / 7,5 / 5 / 2,5 / 0 — wurde erkennbar, woran ein Text scheitert.",
      },
      {
        h: "Was messbar geholfen hat",
        p: "Drei Dinge: erst die Punktzahl pro Kriterium zeigen und dann die Textstellen, nicht umgekehrt. Zum zweiten Versuch innerhalb von 24 Stunden auffordern, weil der Effekt danach steil abfällt. Und die Aufgabenerfüllung immer zuerst prüfen — ein sprachlich schöner Text, der die Aufgabe verfehlt, bekommt null Punkte, und das muss die KI unmissverständlich sagen.",
      },
      {
        h: "Wo die KI zurücktreten muss",
        p: "Bei Dialekt, ungewöhnlicher Argumentation und bei Lernenden mit sehr geringer Schreiberfahrung liegt das Modell regelmäßig zu streng. Genau deshalb bleibt jede Bewertung ein Vorschlag, bis eine Lehrkraft sie freigibt, und jede Abweichung wird protokolliert. Aus diesen Abweichungen lernt nicht das Modell, sondern wir.",
      },
    ],
    quote: "„Die Lernenden diskutieren jetzt über Kriterien statt über Noten. Das war vorher nie der Fall.“",
    quoteBy: "— Kursleitung, Integrationskurs B1, Ulm",
    outro:
      "KI-Feedback ersetzt keine Lehrkraft und beschleunigt auch nicht das Lernen an sich. Es verkürzt die Zeit zwischen Versuch und Rückmeldung — und diese Verkürzung ist der eigentliche Effekt.",
  },
  {
    category: "produkt",
    date: "29. Juli 2026",
    readingTime: "5 Min",
    authorKey: "autorTech",
    title: "Sprechen Teil 3: Rückfragen üben, auch ohne Partner",
    excerpt:
      "Warum der dialogische Teil der Prüfung der schwerste ist — und wie wir ihn in der App simulieren.",
    lead: "Lesen und Hören lassen sich alleine trainieren. Sprechen Teil 3 nicht: dort muss auf eine Nachfrage reagiert werden, die niemand vorhersagen kann. Genau daran scheitern Kurse, in denen zu Hause geübt wird.",
    sections: [
      {
        h: "Das Problem ist nicht die Aussprache",
        p: "In unseren Auswertungen verlieren Lernende in Teil 3 kaum Punkte für Aussprache. Punkte gehen bei der Interaktion verloren: eine Rückfrage wird überhört, ein Vorschlag nicht begründet, ein Kompromiss nicht formuliert. Wer nur Monologe übt, trainiert die falsche Fähigkeit.",
      },
      {
        h: "Wie die Simulation aufgebaut ist",
        p: "Die App gibt eine Planungsaufgabe vor, nimmt die Antwort auf und stellt danach eine Rückfrage, die zur konkreten Antwort passt — etwa zum Zeitpunkt oder zu den Kosten. Erst die Reaktion darauf wird bewertet, weil sie zeigt, ob wirklich zugehört wurde.",
      },
      {
        h: "Was die Lehrkraft weiter macht",
        p: "Die Simulation ersetzt die Partnerübung im Kurs nicht, sie bereitet sie vor. Lernende kommen mit dem dritten oder vierten Versuch in den Unterricht, und die Kurszeit geht in Argumentation statt in Warmlaufen.",
      },
    ],
    quote:
      "„Die Rückfrage ist das, wovor alle Angst haben. Wenn sie zwanzig Mal geübt wurde, ist die Prüfung halb gewonnen.“",
    quoteBy: "— Prüferin, Goethe-Zertifikat B1",
    outro:
      "Sprechen bleibt der Prüfungsteil mit dem größten Trainingseffekt pro Minute — vorausgesetzt, geübt wird der Dialog und nicht der Vortrag.",
  },
  {
    category: "bewertung",
    date: "18. Juli 2026",
    readingTime: "6 Min",
    authorKey: "autor",
    title: "Wie wir das Bewertungsraster der Prüfung abbilden",
    excerpt: "Vier Kriterien, fünf Stufen, eine Null-Regel. Was das für die KI-Vorbewertung bedeutet.",
    lead: "Ein Bewertungsraster ist kein Formular, sondern eine Entscheidungsfolge. Wir haben es bewusst nicht vereinfacht, obwohl das die KI-Bewertung leichter gemacht hätte.",
    sections: [
      {
        h: "Vier Kriterien, fünf Stufen",
        p: "Schreiben wird über vier Kriterien mit je 10 Punkten bewertet, jeweils in den Stufen 10 / 7,5 / 5 / 2,5 / 0. Zwischenwerte gibt es nicht. Das wirkt grob, erzwingt aber eine Entscheidung — und genau diese Entscheidung ist es, die Lernende nachvollziehen können.",
      },
      {
        h: "Die Null-Regel",
        p: "Wird die Aufgabenstellung nicht erfüllt, ist das Ergebnis null Punkte, unabhängig von der sprachlichen Qualität. Für die KI ist das der schwierigste Teil: sie muss Thema und Adressatenbezug prüfen, bevor sie über Grammatik urteilt. Wir zeigen diesen Schritt darum separat an.",
      },
      {
        h: "Warum Punkte statt Prosa",
        p: "Freitext-Feedback klingt hilfreicher, ist aber schwer vergleichbar. Punkte pro Kriterium machen Fortschritt über Wochen sichtbar und zeigen der Lehrkraft in Sekunden, wo sie widersprechen will.",
      },
    ],
    quote: "„Ich korrigiere nicht mehr den ganzen Text. Ich prüfe vier Zahlen und schreibe einen Satz dazu.“",
    quoteBy: "— Lehrkraft, Sprachschule Leipzig",
    outro:
      "Ein Raster, das der Prüfung entspricht, ist unbequemer als ein eigenes — und der einzige Weg, dass Übungspunkte am Prüfungstag etwas bedeuten.",
  },
  {
    category: "datenschutz",
    date: "3. Juli 2026",
    readingTime: "8 Min",
    authorKey: "autorRecht",
    title: "DSGVO im Sprachunterricht: sechs Fragen vor dem Tool-Kauf",
    excerpt:
      "Auftragsverarbeitung, Löschfristen, Modelltraining — die Punkte, die Träger wirklich prüfen sollten.",
    lead: "Sprachaufnahmen und Prüfungstexte sind personenbezogene Daten, oft von Menschen in prekären Situationen. Wer ein KI-Tool einkauft, sollte weniger auf Zertifikatslogos schauen und mehr auf sechs konkrete Punkte.",
    sections: [
      {
        h: "Wer ist verantwortlich, wer verarbeitet?",
        p: "Für Kursdaten ist die Einrichtung Verantwortliche, der Anbieter Auftragsverarbeiter. Das muss in einem Vertrag nach Art. 28 DSGVO stehen, mit Liste der Subunternehmer und Verarbeitungsorten. Fehlt diese Liste, ist die Prüfung an dieser Stelle beendet.",
      },
      {
        h: "Wird auf Kursdaten trainiert?",
        p: "Die Antwort muss vertraglich und nicht nur im Marketingtext stehen. Bei uns lautet sie: nein. Aufnahmen und Texte werden zur Bewertung verarbeitet, nicht zum Modelltraining, und Abweichungen der Lehrkraft bleiben intern.",
      },
      {
        h: "Wie lange bleiben Daten liegen?",
        p: "Löschfristen sollten im Produkt sichtbar sein, nicht nur in der Erklärung: Lern- und Prüfungsdaten bei uns spätestens 24 Monate nach Kursende, Protokolle nach 90 Tagen, Export jederzeit. Wer keine Frist nennen kann, hat keine.",
      },
    ],
    quote:
      "„Uns hat nicht das Zertifikat überzeugt, sondern dass wir eine Löschfrist im Produkt anklicken konnten.“",
    quoteBy: "— Datenschutzkoordination, Bildungsträger NRW",
    outro:
      "Datenschutz entscheidet sich nicht am Serverstandort allein, sondern an Verträgen, Fristen und der Frage, wer die Bewertung am Ende verantwortet.",
  },
  {
    category: "fallstudie",
    date: "20. Juni 2026",
    readingTime: "6 Min",
    authorKey: "autor",
    title: "Aus sechs Stunden Korrektur werden vierzig Minuten",
    excerpt:
      "Eine Volkshochschule mit vier B1-Kursen hat ihre Korrekturpraxis zwei Monate lang protokolliert.",
    lead: "Vier Kurse, 68 Teilnehmende, zwei Lehrkräfte in Teilzeit. Vor der Umstellung wurden Schreibaufgaben alle zwei Wochen korrigiert — nicht aus Prinzip, sondern weil mehr nicht ging.",
    sections: [
      {
        h: "Vorher: der Stapel am Wochenende",
        p: "Pro Kurs kamen rund 17 Texte zusammen, jeweils gut zwanzig Minuten Korrektur inklusive Feedback. Das ergab knapp sechs Stunden pro Woche und Lehrkraft, verteilt auf Sonntagabende. Sprechen wurde faktisch nicht bewertet, weil Sprachnachrichten per Messenger kamen.",
      },
      {
        h: "Nachher: prüfen statt anfangen",
        p: "Mit KI-Vorbewertung sank die Zeit pro Text auf durchschnittlich zwei bis drei Minuten: Punkte prüfen, ein Kriterium korrigieren, einen Satz ergänzen, freigeben. In Summe rund 40 Minuten pro Kurs und Woche. Schreibaufgaben laufen jetzt wöchentlich statt zweiwöchentlich.",
      },
      {
        h: "Was sich nicht verbessert hat",
        p: "Die Bewertungen wurden nicht milder und nicht strenger — die Lehrkräfte korrigierten in etwa jeder fünften Einreichung mindestens ein Kriterium. Auffällig häufig bei Aufgabenerfüllung, was uns zu einer klareren Beschreibung dieses Kriteriums geführt hat.",
      },
    ],
    quote: "„Wir haben nicht weniger gearbeitet. Wir haben zum ersten Mal jede Woche korrigieren können.“",
    quoteBy: "— Fachbereichsleitung Deutsch, VHS",
    outro:
      "Der Gewinn lag nicht in gesparten Stunden, sondern in mehr Durchläufen pro Kurs — und mehr Durchläufe sind das, was Prüfungsergebnisse bewegt.",
  },
  {
    category: "didaktik",
    date: "11. Juni 2026",
    readingTime: "4 Min",
    authorKey: "autor",
    title: "Warum der zweite Versuch am selben Tag zählt",
    excerpt: "Der Abstand zwischen Rückmeldung und Wiederholung entscheidet über den Lerneffekt.",
    lead: "Die naheliegende Erklärung für bessere Ergebnisse ist mehr Übung. Unsere Daten sagen etwas anderes: entscheidend ist, wie schnell nach der Rückmeldung erneut versucht wird.",
    sections: [
      {
        h: "Was wir beobachtet haben",
        p: "Lernende, die innerhalb von 24 Stunden nach dem Feedback erneut einreichen, verbessern sich über sechs Wochen deutlich stärker als jene, die erst nach mehreren Tagen zurückkommen — bei gleicher Gesamtzahl an Einreichungen.",
      },
      {
        h: "Die Erklärung ist unspektakulär",
        p: "Kurz nach dem Feedback ist der eigene Text noch im Kopf. Nach fünf Tagen wird nicht die Rückmeldung umgesetzt, sondern ein neuer Text geschrieben. Der Lerneffekt verschiebt sich damit von „korrigieren“ zu „nochmal machen“.",
      },
      {
        h: "Was das für Kurse bedeutet",
        p: "Zwei kürzere Aufgaben mit engem Wiederholungsfenster bringen mehr als eine lange Aufgabe pro Woche. In der App weisen wir Wiederholungen deshalb aktiv am Folgetag aus, statt sie im Verlauf zu verstecken.",
      },
    ],
    quote: "„Der zweite Versuch ist der eigentliche Unterricht. Der erste ist nur die Diagnose.“",
    quoteBy: "— Kursleitung, Abendkurs B1",
    outro: "Wer nur eine Sache ändern will: kürzere Aufgaben, schnelleres Feedback, Wiederholung am nächsten Tag.",
  },
  {
    category: "changelog",
    date: "2. Juni 2026",
    readingTime: "3 Min",
    authorKey: "autorTech",
    title: "Release Juni 2026: schnellere Queue, Offline-Sets",
    excerpt: "Bewertungs-Queue mit Sammelfreigabe, Übungssets ohne Netz und ein neuer Klassenexport.",
    lead: "Dieses Release räumt vor allem dort auf, wo Lehrkräfte am häufigsten klicken: in der Bewertungs-Queue.",
    sections: [
      {
        h: "Sammelfreigabe in der Queue",
        p: "Einreichungen lassen sich jetzt filtern und gemeinsam freigeben, solange die KI-Vorbewertung nicht angefasst wurde. Jede Freigabe bleibt einzeln protokolliert, inklusive Lehrkraft und Zeitstempel.",
      },
      {
        h: "Offline-Übungssets",
        p: "Lernende können Sets vorab laden und ohne Netz bearbeiten. Aufnahmen bleiben lokal verschlüsselt und werden beim nächsten Start übertragen — relevant für Kurse in Gebäuden mit schwachem Empfang.",
      },
      {
        h: "Klassenexport",
        p: "Neuer CSV-Export pro Klasse mit Punkten je Kriterium und Prüfungsteil, für Zwischenberichte an Träger. Personenbezug lässt sich beim Export pseudonymisieren.",
      },
    ],
    quote:
      "„Sammelfreigabe war unser häufigster Wunsch — und der, bei dem wir am längsten über das Protokoll diskutiert haben.“",
    quoteBy: "— Produktteam, Digital Sprache Institut",
    outro:
      "Als Nächstes: Anwesenheiten im Stundenplan und eine Queue-Ansicht für mehrere Klassen gleichzeitig.",
  },
];

/* ── Dokumentation ────────────────────────────────────────────── */

export type SeedDocGroup = {
  label: string;
  order: number;
  /** Ohne Beschreibung erscheint das Kapitel nicht als Karte auf der Doku-Startseite (wie im Design). */
  description?: string;
  items: string[];
};

export const DOC_GROUPS: SeedDocGroup[] = [
  {
    label: "Erste Schritte",
    order: 1,
    description: "Konto, Rollen und die erste Klasse in unter zwanzig Minuten.",
    items: ["Überblick", "Konto & Rollen", "Klasse anlegen", "Klassencode teilen"],
  },
  {
    label: "Unterricht",
    order: 2,
    description: "Aufgaben aus dem Korpus zuweisen, Fristen und Anwesenheit führen.",
    items: ["Aufgaben zuweisen", "Prüfungs-Korpus", "Fristen & Anwesenheit"],
  },
  {
    label: "Bewertung",
    order: 3,
    description: "Wie die KI vorbewertet, wie Sie freigeben und was protokolliert wird.",
    items: ["KI-Vorbewertung verstehen", "Bewertungsraster", "Freigabe & Protokoll"],
  },
  // Im Design ohne Beschreibung und ohne Karte auf der Startseite — nur in der
  // Seitenleiste. Eine Beschreibung im Admin ergänzen genügt für die Karte.
  { label: "Verwaltung", order: 4, items: ["Standorte & Rollen", "Abrechnung"] },
  {
    label: "Daten & Sicherheit",
    order: 5,
    description: "Auftragsverarbeitung, Löschfristen und Export Ihrer Kursdaten.",
    items: ["DSGVO-Grundlagen", "Löschfristen", "Export & Migration"],
  },
];

export const POPULAR_DOCS = [
  "Aufgaben zuweisen",
  "KI-Vorbewertung verstehen",
  "Klassencode teilen",
  "Löschfristen",
  "Export & Migration",
];

export const DOC_UPDATED_ON = "4. August 2026";
export const DOC_APPLIES_TO = "LMS 2.4 und App 3.1";

/* ── Globals ──────────────────────────────────────────────────── */

export const SITE_SETTINGS = {
  lernenUrl: "https://lernen.digi-s.institute",
  contactEmail: "hallo@digi-s.institute",
  privacyEmail: "datenschutz@digi-s.institute",
  // Platzhalter aus dem Design — vor dem Launch durch die echten Links ersetzen.
  appStoreUrl: "https://apps.apple.com/de/app/digital-sprache-institut/id0000000000",
  playStoreUrl: "https://play.google.com/store/apps/details?id=institute.digis.lernen",
};

export const PRICING = {
  note: "Alle Preise zzgl. USt. Die App ist für Teilnehmende der gebuchten Klassen inklusive.",
  tiers: [
    {
      eyebrow: "Solo",
      name: "Einzelne Lehrkraft",
      tagline: "Für freiberufliche Kursleitungen.",
      monthly: 19,
      yearly: 15,
      ctaLabel: "Testzugang anfragen",
      highlighted: false,
      features: [
        "3 Klassen, 60 Teilnehmende",
        "KI-Vorbewertung Schreiben & Sprechen",
        "Prüfungs-Korpus",
        "E-Mail-Support",
      ],
    },
    {
      eyebrow: "Institut",
      name: "Sprachschule",
      tagline: "Ein Standort, mehrere Lehrkräfte.",
      monthly: 89,
      yearly: 71,
      ctaLabel: "Demo buchen",
      highlighted: true,
      features: [
        "Bis 15 Lehrkräfte, 400 Teilnehmende",
        "Unbegrenzte Klassen & Aufgaben",
        "Rollen & Rechte, Standortverwaltung",
        "Auswertungen & CSV-Export",
        "AV-Vertrag nach Art. 28 DSGVO",
      ],
    },
    {
      eyebrow: "Campus",
      name: "Träger & Verbünde",
      tagline: "Mehrere Standorte, eigene Anforderungen.",
      customLabel: "Individuell",
      ctaLabel: "Angebot anfordern",
      highlighted: false,
      features: [
        "Unbegrenzte Standorte & Lehrkräfte",
        "Eigene Aufgaben-Korpora",
        "Superadmin-Konsole & QA-Berichte",
        "SLA & feste Ansprechperson",
      ],
    },
  ],
};
