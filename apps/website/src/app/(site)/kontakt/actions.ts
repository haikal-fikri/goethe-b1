"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { CONTACT_TOPICS, TEAM_SIZES } from "@/collections/ContactSubmissions";
import { getPayloadClient } from "@/lib/payload";
import { clientIpFromHeaders, enforce, enforceAll, hkey } from "@/lib/ratelimit";
import { getSiteSettings } from "@/lib/queries";
import { getResend, RESEND_FROM_HEADER, resendConfigured } from "@/lib/resend";

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "consent" | "message" | "organisation", string>>;
};

const schema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen an.").max(120),
  email: z.string().trim().email("Bitte prüfen Sie die E-Mail-Adresse.").max(200),
  organisation: z.string().trim().max(160, "Bitte kürzen Sie den Namen der Einrichtung.").optional(),
  teamsize: z.enum(TEAM_SIZES).optional(),
  topic: z.enum(CONTACT_TOPICS).optional(),
  message: z.string().trim().max(4000, "Bitte fassen Sie sich etwas kürzer.").optional(),
  consent: z.literal("on", {
    message: "Ohne Ihre Einwilligung können wir die Anfrage nicht bearbeiten.",
  }),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Betreffzeile aus Nutzereingaben: Zeilenumbrüche raus und kürzen. Resend
 * überträgt per JSON-API, klassische Header-Injection ist damit nicht möglich —
 * ein CR/LF im Betreff erzeugt aber trotzdem kaputte Kopfzeilen bei manchen
 * Empfängern, und ein 120-Zeichen-Name macht die Postfachliste unlesbar.
 */
function sanitizeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 80);
}

/**
 * Demo-Anfrage aus dem Kontaktformular.
 *
 * Reihenfolge: Honeypot → Validierung → Rate-Limit → Speichern → E-Mail.
 * Gespeichert wird über die Local API; die REST-Schnittstelle der Collection
 * ist geschlossen (`create: () => false`), damit dieser Weg der einzige bleibt.
 */
export async function submitContact(
  _previous: ContactState,
  formData: FormData
): Promise<ContactState> {
  // 1. Honeypot: ein für Menschen unsichtbares Feld. Ist es gefüllt, war es ein
  //    Bot — wir melden Erfolg, speichern aber nichts.
  const honeypot = formData.get("firma_website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { status: "success" };
  }

  // 2. Validierung
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    organisation: formData.get("organisation") || undefined,
    teamsize: formData.get("teamsize") || undefined,
    topic: formData.get("topic") || undefined,
    message: formData.get("message") || undefined,
    consent: formData.get("consent") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: ContactState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        field === "name" ||
        field === "email" ||
        field === "consent" ||
        field === "message" ||
        field === "organisation"
      ) {
        fieldErrors[field] ??= issue.message;
      }
    }
    return {
      status: "error",
      message: "Bitte prüfen Sie die markierten Felder.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  // 3. Rate-Limit — günstigster Schlüssel zuerst.
  const headerList = await headers();
  const ip = hkey(clientIpFromHeaders(headerList));
  const emailKey = hkey(data.email);
  // failClosed=true: Fällt Upstash aus, wird abgelehnt statt durchgelassen.
  // Sonst wären bei einer Störung sowohl die Datenbank als auch das
  // (kostenpflichtige) Mailkontingent unbegrenzt offen.
  // ACHTUNG: Ohne UPSTASH_*-Variablen ist die Begrenzung komplett aus (die
  // Engine steigt vorher aus) — in der Produktion also zwingend setzen.
  const limited = await enforceAll([
    () => enforce("contactIpBurst", ip, true),
    () => enforce("contactIpDay", ip, true),
    () => enforce("contactEmailDay", emailKey, true),
  ]);
  if (!limited.ok) {
    return {
      status: "error",
      message:
        "Es sind bereits mehrere Anfragen von hier eingegangen. Bitte versuchen Sie es später erneut oder schreiben Sie uns direkt.",
    };
  }

  // 4. Speichern. Schlägt das fehl, ist die Anfrage verloren — also der Punkt,
  //    an dem wir dem Formular einen Fehler zurückgeben.
  const submittedAt = new Date().toISOString();
  try {
    const payload = await getPayloadClient();
    await payload.create({
      collection: "contact-submissions",
      data: {
        name: data.name,
        email: data.email,
        organisation: data.organisation,
        teamsize: data.teamsize,
        topic: data.topic,
        message: data.message,
        consent: true,
        submittedAt,
      },
      context: { internal: true },
    });
  } catch (error) {
    console.error("[kontakt] Anfrage konnte nicht gespeichert werden:", error);
    return {
      status: "error",
      message:
        "Die Anfrage konnte gerade nicht entgegengenommen werden. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt.",
    };
  }

  // 5. Benachrichtigung. Ab hier gilt die Anfrage als angenommen — sie liegt
  //    bereits in der Datenbank, ein Mailfehler darf sie nicht entwerten.
  if (resendConfigured()) {
    try {
      const settings = await getSiteSettings();
      const rows: [string, string | undefined][] = [
        ["Name", data.name],
        ["E-Mail", data.email],
        ["Einrichtung", data.organisation],
        ["Lehrkräfte", data.teamsize],
        ["Anliegen", data.topic],
      ];
      await getResend().emails.send({
        from: RESEND_FROM_HEADER,
        to: settings.contactEmail,
        replyTo: data.email,
        subject: sanitizeSubject(
          `Demo-Anfrage: ${data.name}${data.organisation ? ` · ${data.organisation}` : ""}`
        ),
        html: [
          "<h2>Neue Demo-Anfrage</h2>",
          "<table cellpadding='6' style='border-collapse:collapse'>",
          ...rows
            .filter(([, value]) => Boolean(value))
            .map(
              ([label, value]) =>
                `<tr><td style='color:#75695C'>${label}</td><td><strong>${escapeHtml(
                  value as string
                )}</strong></td></tr>`
            ),
          "</table>",
          data.message ? `<p style='white-space:pre-wrap'>${escapeHtml(data.message)}</p>` : "",
        ].join(""),
      });
    } catch (error) {
      console.error("[kontakt] Benachrichtigung konnte nicht gesendet werden:", error);
    }
  } else {
    console.warn(
      "[kontakt] RESEND_API_KEY fehlt — Anfrage gespeichert, aber keine E-Mail versendet."
    );
  }

  return { status: "success" };
}
