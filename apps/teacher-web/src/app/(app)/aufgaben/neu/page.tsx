import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { classesData } from "@/lib/data";
import { NeueAufgabeForm, type KlasseOpt, type KorpusSim } from "@/components/aufgaben/NeueAufgabeForm";
import { IconChevronLeft } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function NeueAufgabePage() {
  await requireAuth("/aufgaben/neu");
  const sb = await supabaseServer();

  // Zielklassen: nur aktive (nicht archivierte) — Inserts in gesperrte Klassen
  // blockt die RLS ohnehin (NOT is_class_locked).
  const { data: classRows } = await classesData.listClasses(sb);
  const classes: KlasseOpt[] = ((classRows ?? []) as Array<{ id: string; name: string; archived_at: string | null }>)
    .filter((c) => !c.archived_at)
    .map((c) => ({ id: c.id, name: c.name }));

  // Korpus (public read): Simulationen + Aufgaben für den Aufgaben-Picker.
  const [{ data: simRows }, { data: taskRows }] = await Promise.all([
    sb.from("exam_simulations").select("id, title_de, sort_order").order("sort_order", { ascending: true }).order("id", { ascending: true }),
    sb
      .from("exam_tasks")
      .select("id, simulation_id, aufgabe, task_type, title_de, min_words, recommended_minutes, sort_order")
      .order("sort_order", { ascending: true }),
  ]);

  const tasks = (taskRows ?? []) as Array<{
    id: string;
    simulation_id: number;
    aufgabe: number;
    task_type: string;
    title_de: string;
    min_words: number;
    recommended_minutes: number | null;
  }>;
  const bySim: Record<number, KorpusSim["tasks"]> = {};
  for (const t of tasks) {
    (bySim[t.simulation_id] ??= []).push({
      id: t.id,
      aufgabe: t.aufgabe,
      taskType: t.task_type,
      titleDe: t.title_de,
      minWords: t.min_words,
      recommendedMinutes: t.recommended_minutes,
    });
  }
  const simulations: KorpusSim[] = ((simRows ?? []) as Array<{ id: number; title_de: string }>)
    .map((s) => ({ id: s.id, titleDe: s.title_de, tasks: bySim[s.id] ?? [] }))
    .filter((s) => s.tasks.length > 0);

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 34px 60px" }}>
      <Link
        href="/aufgaben"
        className="hover-strong"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          color: "var(--text-2)",
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <IconChevronLeft size={15} />
        Alle Aufgaben
      </Link>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 27, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 22px", letterSpacing: "-.01em" }}>
        Neue Aufgabe
      </h1>
      <NeueAufgabeForm classes={classes} simulations={simulations} />
    </div>
  );
}
