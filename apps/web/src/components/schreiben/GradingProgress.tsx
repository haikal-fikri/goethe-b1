import { Card } from "@/components/ui/primitives";
import { IconCheck } from "@/components/icons";
import { ON_ACCENT } from "@/lib/ui";
import { ACCENT } from "./examUi";

// Fortschritt der Bewertung (Vier-Augen-Prinzip), gestreamt vom Server.

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2"
      style={{ borderColor: "var(--border-1)", borderTopColor: ACCENT }}
      aria-hidden
    />
  );
}

function StepRow({
  state,
  label,
}: {
  state: "pending" | "active" | "done";
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {state === "done" ? (
        <span
          className="grid h-[18px] w-[18px] place-items-center rounded-full"
          style={{ background: "var(--gruen)", color: ON_ACCENT }}
        >
          <IconCheck size={11} strokeWidth={3} />
        </span>
      ) : state === "active" ? (
        <Spinner />
      ) : (
        <span className="h-[18px] w-[18px] rounded-full border border-line-strong" />
      )}
      <span className={state === "pending" ? "text-faint" : "text-body"}>
        {label}
      </span>
    </li>
  );
}

export function GradingProgress({
  doneExaminers,
  thirdActive,
}: {
  doneExaminers: string[];
  thirdActive: boolean;
}) {
  return (
    <div aria-busy="true" className="animate-fade-in mt-5">
      <Card radius={18}>
        <div className="text-sm font-semibold text-ink">
          Vier-Augen-Prinzip — Bewertung läuft
        </div>
        <ul className="mt-3 flex flex-col gap-2.5">
          <StepRow state="done" label="Antwort gesendet" />
          <StepRow
            state={doneExaminers.includes("mild") ? "done" : "active"}
            label="Prüfer A · mild bewertet"
          />
          <StepRow
            state={doneExaminers.includes("streng") ? "done" : "active"}
            label="Prüfer B · streng bewertet"
          />
          {thirdActive && (
            <StepRow state="active" label="Drittprüfer entscheidet" />
          )}
          <StepRow
            state={doneExaminers.length >= 2 ? "active" : "pending"}
            label="Ergebnis wird zusammengeführt"
          />
        </ul>
      </Card>
    </div>
  );
}
