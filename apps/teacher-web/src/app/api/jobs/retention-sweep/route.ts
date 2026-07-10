import { ok, requireCron } from "@/lib/guard";
import { supabaseService } from "@/lib/supabaseServer";
import { sql } from "@/lib/db";
import { newRequestId, log } from "@/lib/log";
import { audit } from "@/lib/audit";

// POST /api/jobs/retention-sweep — nächtlich (06 §3.5a, Storage-Limitation
// Art. 5(1)(e)). Verbatim-Text (transcript, answer_text) wird NACH dem Ceiling
// (Standard 12 Monate nach classes.archived_at) genullt. Audio hat seinen eigenen
// 72h/24h-Zyklus; alles bleibt bis zum Ceiling DSAR-löschbar.
export const runtime = "nodejs";

// ⚠️ OWNER-CONFIRM: das Ceiling ist controller-konfigurierbar (Schule darf kürzen).
const RETENTION_MONTHS = 12;

export async function POST(req: Request) {
  const requestId = newRequestId();
  const denied = requireCron(req, requestId);
  if (denied) return denied;

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  const cutoffIso = cutoff.toISOString();

  // Transkripte archivierter Klassen jenseits des Ceilings nullen.
  const t = await sql`
    update speaking_submissions s set transcript = null
    from speaking_assignments a join classes c on c.id = a.class_id
    where s.assignment_id = a.id and s.transcript is not null
      and c.archived_at is not null and c.archived_at < ${cutoffIso}
  `;
  // Aufsatztexte archivierter Klassen jenseits des Ceilings nullen.
  const w = await sql`
    update assignment_submissions s set answer_text = null
    from assignments a join classes c on c.id = a.class_id
    where s.assignment_id = a.id and s.answer_text is not null
      and c.archived_at is not null and c.archived_at < ${cutoffIso}
  `;
  // Follow-up (flag): der enrollment-'removed'-Pfad und das Nullen der grade-jsonb
  // sind hier noch nicht abgedeckt (nur der class-archived-Pfad).

  const transcripts = t.count ?? 0;
  const answers = w.count ?? 0;
  const svc = supabaseService();
  await audit(svc, {
    action: "retention.sweep",
    meta: { cutoff: cutoffIso, transcripts, answers },
  });

  log("jobs/retention-sweep", { requestId, transcripts, answers });
  return ok({ transcripts, answers }, requestId);
}
