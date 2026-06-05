"use client";

import { useState } from "react";
import type { AufgabeNr } from "@/types";

const ACCENT = "var(--accent-write)";

interface TaskDraft {
  aufgabe: AufgabeNr;
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

const inputCls =
  "rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--border)]";

export function SimulationForm() {
  const [titleDe, setTitleDe] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>(() =>
    DEFAULT_TASKS.map((t) => ({ ...t }))
  );
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  function updateTask(i: number, patch: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function reset() {
    setTitleDe("");
    setTasks(DEFAULT_TASKS.map((t) => ({ ...t })));
    setStatus("idle");
    setMessage("");
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
        ...(t.sampleAnswerDe.trim()
          ? { sampleAnswerDe: t.sampleAnswerDe.trim() }
          : {}),
      })),
    };

    try {
      const res = await fetch("/api/admin/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setStatus("done");
      setMessage(`Simulation #${data.id} angelegt.`);
    } catch {
      setStatus("error");
      setMessage("Verbindung fehlgeschlagen.");
    }
  }

  const canSubmit =
    titleDe.trim().length > 0 &&
    tasks.every((t) => t.titleDe.trim() && t.promptDe.trim()) &&
    status !== "saving";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-5">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--fg-dim)]">
          Titel der Simulation
        </span>
        <input
          value={titleDe}
          onChange={(e) => setTitleDe(e.target.value)}
          placeholder="z.B. Simulation 5"
          className={inputCls}
        />
      </label>

      <div className="mt-5 flex flex-col gap-5">
        {tasks.map((t, i) => (
          <fieldset
            key={t.aufgabe}
            className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--bg-elev)] p-4"
          >
            <legend className="px-1 text-sm font-semibold" style={{ color: ACCENT }}>
              Aufgabe {t.aufgabe}
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--fg-dim)]">Textsorte</span>
                <input
                  value={t.taskType}
                  onChange={(e) => updateTask(i, { taskType: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--fg-dim)]">Titel</span>
                <input
                  value={t.titleDe}
                  onChange={(e) => updateTask(i, { titleDe: e.target.value })}
                  placeholder="z.B. E-Mail über einen Ausflug"
                  className={inputCls}
                />
              </label>
            </div>

            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs text-[var(--fg-dim)]">Aufgabenstellung</span>
              <textarea
                value={t.promptDe}
                onChange={(e) => updateTask(i, { promptDe: e.target.value })}
                rows={3}
                className={`${inputCls} resize-y`}
              />
            </label>

            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs text-[var(--fg-dim)]">
                Leitpunkte (eine pro Zeile, optional)
              </span>
              <textarea
                value={t.bulletPoints}
                onChange={(e) => updateTask(i, { bulletPoints: e.target.value })}
                rows={3}
                placeholder={"Beschreiben Sie …\nBegründen Sie …\nSchlagen Sie … vor"}
                className={`${inputCls} resize-y`}
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--fg-dim)]">Wörter (Richtwert)</span>
                <input
                  type="number"
                  value={t.minWords}
                  onChange={(e) => updateTask(i, { minWords: Number(e.target.value) })}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--fg-dim)]">Minuten</span>
                <input
                  type="number"
                  value={t.recommendedMinutes}
                  onChange={(e) =>
                    updateTask(i, { recommendedMinutes: Number(e.target.value) })
                  }
                  className={inputCls}
                />
              </label>
            </div>

            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs text-[var(--fg-dim)]">
                Beispieltext / Musterlösung (optional)
              </span>
              <textarea
                value={t.sampleAnswerDe}
                onChange={(e) => updateTask(i, { sampleAnswerDe: e.target.value })}
                rows={3}
                className={`${inputCls} resize-y`}
              />
            </label>
          </fieldset>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: "var(--bg)", backgroundColor: ACCENT }}
        >
          {status === "saving" ? "Wird gespeichert …" : "Simulation anlegen"}
        </button>
        {status === "done" && (
          <span className="text-sm" style={{ color: "var(--ok)" }}>
            {message}
          </span>
        )}
        {status === "error" && (
          <span className="text-sm" style={{ color: "var(--bad)" }}>
            {message}
          </span>
        )}
        {status === "done" && (
          <button
            onClick={reset}
            className="text-sm text-[var(--fg-muted)] underline-offset-2 hover:underline"
          >
            Weitere anlegen
          </button>
        )}
      </div>
    </div>
  );
}
