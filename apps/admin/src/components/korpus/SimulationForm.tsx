"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { Button } from "@/components/ui/controls";
import { Card } from "@/components/ui/primitives";
import { Field, TextInput, TextArea, NumberInput } from "@/components/ui/form";

// Portiert die bewährte Eingabe-Ergonomie des Legacy-Panels (apps/web
// /admin): drei vorbelegte Aufgaben, Leitpunkte als Zeilen-Textfeld,
// Musterlösung optional. Neu: Bearer-Auth über authedFetch und das
// Fehlerformat der Konsolen-API.

interface TaskDraft {
  aufgabe: 1 | 2 | 3;
  taskType: string;
  titleDe: string;
  promptDe: string;
  bulletPoints: string; // eine Zeile = ein Leitpunkt
  minWords: number;
  recommendedMinutes: number;
  sampleAnswerDe: string;
}

const DEFAULT_TASKS: TaskDraft[] = [
  { aufgabe: 1, taskType: "Persönliche E-Mail", titleDe: "", promptDe: "", bulletPoints: "", minWords: 80, recommendedMinutes: 20, sampleAnswerDe: "" },
  { aufgabe: 2, taskType: "Meinungsäußerung", titleDe: "", promptDe: "", bulletPoints: "", minWords: 80, recommendedMinutes: 25, sampleAnswerDe: "" },
  { aufgabe: 3, taskType: "Formelle E-Mail", titleDe: "", promptDe: "", bulletPoints: "", minWords: 40, recommendedMinutes: 15, sampleAnswerDe: "" },
];

type Status = "idle" | "saving" | "done" | "error";

export function SimulationForm() {
  const router = useRouter();
  const [titleDe, setTitleDe] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>(() => DEFAULT_TASKS.map((t) => ({ ...t })));
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [neueId, setNeueId] = useState<string | null>(null);

  function updateTask(i: number, patch: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function reset() {
    setTitleDe("");
    setTasks(DEFAULT_TASKS.map((t) => ({ ...t })));
    setStatus("idle");
    setMessage("");
    setNeueId(null);
  }

  async function submit() {
    setStatus("saving");
    setMessage("");
    const payload = {
      titleDe: titleDe.trim(),
      tasks: tasks.map((t) => ({
        aufgabe: t.aufgabe,
        taskType: t.taskType.trim(),
        titleDe: t.titleDe.trim(),
        promptDe: t.promptDe.trim(),
        bulletPointsDe: t.bulletPoints
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        minWords: Number(t.minWords),
        recommendedMinutes: Number(t.recommendedMinutes),
        ...(t.sampleAnswerDe.trim() ? { sampleAnswerDe: t.sampleAnswerDe.trim() } : {}),
      })),
    };

    try {
      const res = await authedFetch("/api/admin/corpus/exam-simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { id?: string; error?: { message?: string } }
        | null;
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error?.message ?? "Speichern fehlgeschlagen.");
        return;
      }
      setStatus("done");
      setNeueId(data?.id ?? null);
      setMessage(`Simulation ${data?.id ?? ""} angelegt.`);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Verbindung fehlgeschlagen.");
    }
  }

  const canSubmit =
    titleDe.trim().length > 0 &&
    tasks.every((t) => t.titleDe.trim() && t.promptDe.trim() && t.taskType.trim()) &&
    tasks.every((t) => t.minWords > 0 && t.recommendedMinutes > 0) &&
    status !== "saving";

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <Field label="Titel der Simulation" required>
          <TextInput value={titleDe} onChange={setTitleDe} placeholder="z. B. Simulation 5" />
        </Field>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tasks.map((t, i) => (
          <Card key={t.aufgabe}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--lila)",
                marginBottom: 14,
              }}
            >
              Aufgabe {t.aufgabe}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Textsorte" required>
                <TextInput value={t.taskType} onChange={(v) => updateTask(i, { taskType: v })} />
              </Field>
              <Field label="Titel" required>
                <TextInput
                  value={t.titleDe}
                  onChange={(v) => updateTask(i, { titleDe: v })}
                  placeholder="z. B. E-Mail über einen Ausflug"
                />
              </Field>
            </div>

            <Field label="Aufgabenstellung" required>
              <TextArea value={t.promptDe} onChange={(v) => updateTask(i, { promptDe: v })} rows={3} />
            </Field>

            <Field label="Leitpunkte" hint="Eine pro Zeile, optional.">
              <TextArea
                value={t.bulletPoints}
                onChange={(v) => updateTask(i, { bulletPoints: v })}
                rows={3}
                placeholder={"Beschreiben Sie …\nBegründen Sie …\nSchlagen Sie … vor"}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Wörter (Richtwert)" required>
                <NumberInput value={t.minWords} onChange={(v) => updateTask(i, { minWords: v })} min={1} />
              </Field>
              <Field label="Minuten" required>
                <NumberInput
                  value={t.recommendedMinutes}
                  onChange={(v) => updateTask(i, { recommendedMinutes: v })}
                  min={1}
                />
              </Field>
            </div>

            <Field label="Beispieltext / Musterlösung" hint="Optional.">
              <TextArea
                value={t.sampleAnswerDe}
                onChange={(v) => updateTask(i, { sampleAnswerDe: v })}
                rows={3}
              />
            </Field>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
        <Button variant="accent" onClick={submit} disabled={!canSubmit}>
          {status === "saving" ? "Wird gespeichert …" : "Simulation anlegen"}
        </Button>
        {status === "done" ? (
          <>
            <span style={{ fontSize: 13.5, color: "var(--gruen)" }}>{message}</span>
            {neueId ? (
              <Button variant="outline" onClick={() => router.push(`/korpus/${neueId}`)}>
                Ansehen
              </Button>
            ) : null}
            <Button variant="ghost" onClick={reset}>
              Weitere anlegen
            </Button>
          </>
        ) : null}
        {status === "error" ? (
          <span style={{ fontSize: 13.5, color: "var(--rot-text)" }}>{message}</span>
        ) : null}
      </div>
    </div>
  );
}
