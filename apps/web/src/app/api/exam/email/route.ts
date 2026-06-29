import { getResend, RESEND_FROM_HEADER } from "@/lib/resend";
import { siteUrl } from "@/lib/site";
import {
  buildSubject,
  examEmailSchema,
  renderExamResultEmail,
} from "@/lib/email/examResultEmail";

// Versendet das KI-Bewertungsergebnis (Aufgabe + Aufsatz + Bewertung) per E-Mail
// an die/den Lernende:n und die Lehrkraft. Die Bewertungsdaten kommen im MVP vom
// Client (siehe Plan). Kein Webhook, keine DB-Persistenz.
export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    return Response.json(
      { error: "RESEND_API_KEY ist nicht gesetzt." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = examEmailSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Die E-Mail-Daten sind unvollständig oder ungültig." },
      { status: 400 }
    );
  }
  const payload = parsed.data;
  const { studentEmail, teacherEmail } = payload.recipients;
  // Wenn beide Adressen identisch sind (z.B. beim Sandbox-Test), keine Kopie an
  // dieselbe Adresse senden — sonst dedupliziert der Client und es wirkt wie ein
  // verlorenes Duplikat.
  const sameRecipient = studentEmail.toLowerCase() === teacherEmail.toLowerCase();

  try {
    const { data, error } = await getResend().emails.send({
      from: RESEND_FROM_HEADER,
      to: teacherEmail,
      ...(sameRecipient ? {} : { cc: studentEmail }),
      replyTo: studentEmail,
      subject: buildSubject(payload),
      html: renderExamResultEmail(payload, siteUrl),
    });

    if (error) {
      console.error("[exam/email] Resend error:", error);
      return Response.json(
        { error: "Die E-Mail konnte nicht versendet werden." },
        { status: 502 }
      );
    }

    return Response.json({ success: true, id: data?.id });
  } catch (err) {
    // Unerwarteter Laufzeitfehler (z.B. Rendering) — 500, analog zu den anderen
    // Routen. Echte Resend-API-Fehler werden oben mit 502 behandelt.
    console.error("[exam/email] send failed:", err);
    return Response.json(
      { error: "Die E-Mail konnte nicht versendet werden." },
      { status: 500 }
    );
  }
}
