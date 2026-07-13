"use client";

import { useRef, useState } from "react";
import type { ExamGrade, ExaminerResult, ExamTask } from "@/types";
import {
  TurnstileGate,
  turnstileEnabledClient,
  type TurnstileGateHandle,
} from "./TurnstileGate";
import { Card } from "@/components/ui/primitives";
import { Button, TextInput, FieldLabel, buttonClass, buttonStyle } from "@/components/ui/controls";
import { ACCENT, isEmail, type Status } from "./examUi";

/**
 * Sendet Aufgabe + Aufsatz + Bewertung per E-Mail an Lernende:n und Lehrkraft.
 * Die Bewertungsdaten liegen bereits im Client (MVP, siehe Plan).
 */
export function SendResultByEmail({
  task,
  essay,
  grade,
  examiners,
  thirdUsed,
}: {
  task: ExamTask;
  essay: string;
  grade: ExamGrade;
  examiners: ExaminerResult[];
  thirdUsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [studentEmail, setStudentEmail] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Eigenes Turnstile-Token für den E-Mail-Versand — getrennt vom Bewertungs-Flow,
  // dessen Token bereits verbraucht/zurückgesetzt wurde. Ohne Site-Key inert.
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileGateHandle>(null);

  const canSend =
    isEmail(studentEmail) &&
    isEmail(teacherEmail) &&
    status !== "loading" &&
    (!turnstileEnabledClient || !!token);

  async function send() {
    if (!isEmail(studentEmail) || !isEmail(teacherEmail)) {
      setStatus("error");
      setErrorMsg("Bitte gib zwei gültige E-Mail-Adressen ein.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    const payload = {
      recipients: {
        studentEmail: studentEmail.trim(),
        teacherEmail: teacherEmail.trim(),
        ...(studentName.trim() ? { studentName: studentName.trim() } : {}),
        ...(teacherName.trim() ? { teacherName: teacherName.trim() } : {}),
      },
      task: {
        titleDe: task.titleDe,
        taskType: task.taskType,
        aufgabe: task.aufgabe,
        promptDe: task.promptDe,
        ...(task.bulletPointsDe ? { bulletPointsDe: task.bulletPointsDe } : {}),
        minWords: task.minWords,
      },
      essay,
      grade,
      examiners,
      thirdUsed,
      turnstileToken: token ?? undefined,
    };

    try {
      const res = await fetch("/api/exam/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = "Die E-Mail konnte nicht versendet werden.";
        try {
          const d = await res.json();
          msg = d?.error ?? msg;
        } catch {
          /* leer */
        }
        setStatus("error");
        setErrorMsg(msg);
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Verbindung fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      // Turnstile-Tokens sind Einweg — nach jedem Versuch ein frisches holen.
      turnstileRef.current?.reset();
    }
  }

  if (status === "done") {
    const sameRecipient =
      studentEmail.trim().toLowerCase() === teacherEmail.trim().toLowerCase();
    return (
      <div
        className="mt-4 animate-fade-in rounded-card p-4 text-sm"
        style={{
          border: "1px solid color-mix(in oklab, var(--gruen) 45%, transparent)",
          background: "var(--gruen-tint)",
          color: "var(--text-1)",
        }}
      >
        <span style={{ color: "var(--gruen)", fontWeight: 600 }}>
          Ergebnis versendet.
        </span>{" "}
        An {teacherEmail.trim()}
        {sameRecipient ? "" : ` (Kopie an ${studentEmail.trim()})`}.
        <button
          onClick={() => setStatus("idle")}
          className="ml-2 underline underline-offset-2"
          style={{ color: "var(--text-2)" }}
        >
          An andere Adresse senden
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`mt-4 ${buttonClass("outline")}`}
        style={{ ...buttonStyle("outline"), borderColor: ACCENT, color: ACCENT }}
      >
        Ergebnis per E-Mail senden
      </button>
    );
  }

  return (
    <div className="mt-4 animate-fade-in">
      <Card radius={16}>
        <h3 className="text-sm font-semibold text-ink">
          Ergebnis per E-Mail senden
        </h3>
        <p className="mt-1 text-xs text-faint">
          Aufgabe, dein Text und die Bewertung gehen an dich und deine Lehrkraft.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Deine E-Mail</FieldLabel>
            <TextInput
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="du@beispiel.de"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <FieldLabel>E-Mail der Lehrkraft</FieldLabel>
            <TextInput
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="lehrkraft@schule.de"
            />
          </label>
          <label className="block">
            <FieldLabel>Dein Name (optional)</FieldLabel>
            <TextInput
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </label>
          <label className="block">
            <FieldLabel>Name der Lehrkraft (optional)</FieldLabel>
            <TextInput
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
            />
          </label>
        </div>

        {status === "error" && (
          <p
            className="mt-3 rounded-tile px-3 py-2.5 text-sm"
            role="alert"
            style={{ background: "var(--rot-tint)", color: "var(--rot-text)" }}
          >
            {errorMsg}
          </p>
        )}

        <TurnstileGate ref={turnstileRef} onToken={setToken} />

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="accent"
            onClick={send}
            disabled={!canSend}
            style={{
              opacity: canSend ? 1 : 0.4,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {status === "loading" ? "Wird gesendet …" : "Senden"}
          </Button>
          <button
            onClick={() => {
              setOpen(false);
              setStatus("idle");
              setErrorMsg("");
            }}
            className="text-sm text-muted underline-offset-2 hover:underline"
          >
            Abbrechen
          </button>
        </div>
      </Card>
    </div>
  );
}
