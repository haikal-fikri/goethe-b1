import { isAdmin } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { createSimulationSchema } from "@/lib/adminSchema";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = createSimulationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validierung fehlgeschlagen.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { titleDe, tasks } = parsed.data;

  try {
    const id = await sql.begin(async (tx) => {
      const [{ id: simId }] = await tx<{ id: number }[]>`
        select coalesce(max(id), 0) + 1 as id from exam_simulations
      `;
      await tx`
        insert into exam_simulations (id, title_de, sort_order)
        values (${simId}, ${titleDe}, ${simId})
      `;
      for (const t of tasks) {
        await tx`
          insert into exam_tasks
            (id, simulation_id, aufgabe, task_type, title_de, prompt_de,
             bullet_points_de, min_words, recommended_minutes, sample_answer_de, sort_order)
          values
            (${`s${simId}-a${t.aufgabe}`}, ${simId}, ${t.aufgabe}, ${t.taskType},
             ${t.titleDe}, ${t.promptDe}, ${t.bulletPointsDe}, ${t.minWords},
             ${t.recommendedMinutes ?? null}, ${t.sampleAnswerDe ?? null}, ${t.aufgabe - 1})
        `;
      }
      return simId;
    });

    return Response.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[admin/simulations] insert failed:", err);
    return Response.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}
