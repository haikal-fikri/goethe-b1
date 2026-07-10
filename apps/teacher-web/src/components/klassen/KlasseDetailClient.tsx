"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { classesData } from "@/lib/data";
import { authedFetch } from "@/lib/api";
import type { ClassDetailVM, DetailAssignment, DetailSession, RosterEntry, PendingInvite } from "@/lib/klassen";
import { Avatar, Pill, SkillTile, type Tone } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/controls";
import {
  IconChevronLeft,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconMail,
  IconPencil,
  IconMic,
  IconGrid,
  IconX,
  IconDotsV,
  IconCalendar,
} from "@/components/icons";
import { shortDate, timeDe, whenShort } from "@/lib/format";
import { EinladenModal } from "./EinladenModal";
import { ConfirmModal } from "./ConfirmModal";

type Tab = "teilnehmende" | "aufgaben" | "anwesenheit";
type Action =
  | { type: "remove"; studentId: string; name: string }
  | { type: "archive" }
  | { type: "unarchive" }
  | { type: "delete" };

export function KlasseDetailClient({ vm }: { vm: ClassDetailVM }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("teilnehmende");
  const [code, setCode] = useState(vm.joinCode);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard nicht verfügbar */
    }
  }

  async function rotate() {
    setRotating(true);
    const { data, error } = await classesData.rotateJoinCode(supabaseBrowser(), vm.id);
    setRotating(false);
    if (!error && typeof data === "string" && data) setCode(data);
  }

  async function revokeInvite(id: string) {
    setRevoking(id);
    const { error } = await classesData.revokeInvite(supabaseBrowser(), id);
    setRevoking(null);
    if (!error) router.refresh();
  }

  async function runAction() {
    if (!action) return;
    setActionBusy(true);
    setActionErr(null);
    try {
      const sb = supabaseBrowser();
      if (action.type === "remove") {
        const res = await authedFetch("/api/class/remove-student", {
          method: "POST",
          body: JSON.stringify({ classId: vm.id, studentId: action.studentId }),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(b?.error?.message ?? "Entfernen fehlgeschlagen.");
        }
        router.refresh();
      } else if (action.type === "archive") {
        const { error } = await classesData.archiveClass(sb, vm.id);
        if (error) throw new Error(error.message);
        router.refresh();
      } else if (action.type === "unarchive") {
        const { error } = await classesData.unarchiveClass(sb, vm.id);
        if (error) throw new Error(error.message);
        router.refresh();
      } else if (action.type === "delete") {
        const { error } = await classesData.deleteClass(sb, vm.id);
        if (error) throw new Error(error.message);
        router.push("/klassen");
        return;
      }
      setAction(null);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setActionBusy(false);
    }
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: "teilnehmende", label: "Teilnehmende" },
    { value: "aufgaben", label: "Aufgaben & Prüfungen" },
    { value: "anwesenheit", label: "Anwesenheit" },
  ];

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 34px 60px" }}>
      <Link href="/klassen" className="press" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, textDecoration: "none", marginBottom: 16 }}>
        <IconChevronLeft size={15} strokeWidth={1.9} />
        Alle Klassen
      </Link>

      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 22 }}>
        <span style={{ width: 52, height: 52, borderRadius: 14, flex: "0 0 52px", background: "var(--cefr-b1)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600, color: "#fff" }}>
          B1
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 27, fontWeight: 600, color: "var(--text-hi)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{vm.name}</span>
            {vm.archived ? <Pill tone="neutral" style={{ fontSize: 11 }}>archiviert</Pill> : null}
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>
            {[vm.org, vm.termLabel].filter(Boolean).join(" · ") || "Ohne Träger · kein Kurszeitraum"} ·{" "}
            <span style={{ fontFamily: "var(--font-serif)", color: "var(--text-1)" }}>{vm.members}</span> Teilnehmende
          </div>
        </div>

        {/* Code-Chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 13, padding: "9px 9px 9px 14px" }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-2)" }}>Code</span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, letterSpacing: ".1em", color: "var(--text-hi)" }}>{code}</span>
          <button onClick={copyCode} title="Code kopieren" className="hover-strong press" style={chipBtn}>
            {copied ? <IconCheck size={16} strokeWidth={2.1} style={{ color: "var(--gruen)" }} /> : <IconCopy size={15} />}
          </button>
          <button onClick={rotate} disabled={rotating} title="Code erneuern" className="hover-strong press" style={{ ...chipBtn, opacity: rotating ? 0.6 : 1 }}>
            <IconRefresh size={15} />
          </button>
        </div>

        {/* Verwalten-Menü */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen((o) => !o)} title="Verwalten" className="hover-strong press" style={{ ...chipBtn, width: 40, height: 40, background: "var(--surface-1)", border: "1px solid var(--border-1)" }}>
            <IconDotsV size={18} />
          </button>
          {menuOpen ? (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
              <div style={{ position: "absolute", top: 46, right: 0, width: 210, background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 14, boxShadow: "var(--shadow-island)", padding: 6, zIndex: 21 }}>
                <MenuItem
                  label={vm.archived ? "Klasse reaktivieren" : "Klasse archivieren"}
                  onClick={() => {
                    setMenuOpen(false);
                    setActionErr(null);
                    setAction(vm.archived ? { type: "unarchive" } : { type: "archive" });
                  }}
                />
                <MenuItem
                  label="Klasse löschen"
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    setActionErr(null);
                    setAction({ type: "delete" });
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 22 }}>
        <Segmented<Tab> options={tabs} value={tab} onChange={setTab} />
      </div>

      {tab === "teilnehmende" ? (
        <TeilnehmendeTab
          vm={vm}
          onInvite={() => setInviteOpen(true)}
          onRemove={(s) => {
            setActionErr(null);
            setAction({ type: "remove", studentId: s.studentId, name: s.name });
          }}
          onRevoke={revokeInvite}
          revoking={revoking}
        />
      ) : null}
      {tab === "aufgaben" ? <AufgabenTab assignments={vm.assignments} /> : null}
      {tab === "anwesenheit" ? <AnwesenheitTab sessions={vm.sessions} /> : null}

      {inviteOpen ? <EinladenModal classId={vm.id} joinCode={code} onClose={() => setInviteOpen(false)} /> : null}

      {action ? (
        <ConfirmModal
          title={confirmCopy(action, vm).title}
          body={confirmCopy(action, vm).body}
          confirmLabel={confirmCopy(action, vm).confirmLabel}
          danger={action.type === "delete" || action.type === "remove"}
          busy={actionBusy}
          error={actionErr}
          onCancel={() => (actionBusy ? undefined : setAction(null))}
          onConfirm={runAction}
        />
      ) : null}
    </div>
  );
}

/* ── Teilnehmende ──────────────────────────────────────────────────────── */

function TeilnehmendeTab({
  vm,
  onInvite,
  onRemove,
  onRevoke,
  revoking,
}: {
  vm: ClassDetailVM;
  onInvite: () => void;
  onRemove: (s: RosterEntry) => void;
  onRevoke: (id: string) => void;
  revoking: string | null;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>
          <span style={{ fontFamily: "var(--font-serif)", color: "var(--text-hi)", fontSize: 15 }}>{vm.members}</span> Teilnehmende
        </div>
        <button onClick={onInvite} className="btn-primary press" style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 15px", borderRadius: 11, border: "none", background: "var(--primary-btn-bg)", color: "var(--primary-btn-fg)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <IconMail size={16} />
          Per E-Mail einladen
        </button>
      </div>

      {vm.roster.length > 0 ? (
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 18, boxShadow: "var(--shadow-card-now)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr 1fr 1fr 44px", gap: 14, padding: "13px 20px", borderBottom: "1px solid var(--border-1)" }}>
            {["Name", "Status", "Beigetreten", "Offene Arbeit", ""].map((h, i) => (
              <span key={i} style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--text-2)" }}>{h}</span>
            ))}
          </div>
          {vm.roster.map((s) => (
            <div key={s.studentId} style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr 1fr 1fr 44px", gap: 14, alignItems: "center", padding: "12px 20px", borderTop: "1px solid var(--border-1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar name={s.name} size={34} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              </div>
              <div>
                <Pill tone="gruen" style={{ fontSize: 11.5 }}>Aktiv</Pill>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{shortDate(s.joinedAt)}</span>
              <div>
                {s.offen > 0 ? (
                  <Pill tone="gold" style={{ fontSize: 12 }}>{s.offen} offen</Pill>
                ) : (
                  <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>—</span>
                )}
              </div>
              <button onClick={() => onRemove(s)} title="Teilnehmende:n entfernen" className="hover-strong press" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border-1)", background: "var(--bg)", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconX size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty>Noch keine Teilnehmenden — laden Sie per E-Mail ein oder teilen Sie den Beitritts-Code.</Empty>
      )}

      {/* Offene Einladungen */}
      {vm.invites.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-2)", marginBottom: 12 }}>
            Offene Einladungen ({vm.invites.length})
          </div>
          <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 18, boxShadow: "var(--shadow-card-now)", overflow: "hidden" }}>
            {vm.invites.map((inv: PendingInvite) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderTop: "1px solid var(--border-1)" }}>
                <span style={{ width: 34, height: 34, borderRadius: 999, flex: "0 0 34px", background: "var(--surface-alt)", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconMail size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                    eingeladen {shortDate(inv.createdAt)}
                    {inv.expiresAt ? ` · gültig bis ${shortDate(inv.expiresAt)}` : ""}
                  </div>
                </div>
                <Pill tone="gold" style={{ fontSize: 11 }}>ausstehend</Pill>
                <button onClick={() => onRevoke(inv.id)} disabled={revoking === inv.id} className="hover-strong press" style={{ height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--bg)", color: "var(--text-1)", fontSize: 12.5, fontWeight: 600, cursor: revoking === inv.id ? "default" : "pointer", opacity: revoking === inv.id ? 0.6 : 1 }}>
                  {revoking === inv.id ? "…" : "Zurückziehen"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ── Aufgaben & Prüfungen ──────────────────────────────────────────────── */

function AufgabenTab({ assignments }: { assignments: DetailAssignment[] }) {
  if (assignments.length === 0) {
    return <Empty>Noch keine Aufgaben oder Prüfungen für diese Klasse.</Empty>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {assignments.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 15, background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 16, boxShadow: "var(--shadow-card-now)", padding: "16px 20px" }}>
          <KindGlyph kind={a.kind} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              {kindLabel(a.kind)} · {a.dueAt ? `fällig ${shortDate(a.dueAt)}` : "ohne Frist"} · {a.submitted}/{a.total} eingereicht
            </div>
          </div>
          {a.offen > 0 ? (
            <Pill tone="gruen" style={{ fontSize: 12 }}>{a.offen} zu bewerten</Pill>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>nichts offen</span>
          )}
        </div>
      ))}
    </div>
  );
}

function KindGlyph({ kind }: { kind: DetailAssignment["kind"] }) {
  if (kind === "speaking") {
    return (
      <SkillTile skill="sprechen" size={38} radius={11}>
        <IconMic size={19} />
      </SkillTile>
    );
  }
  if (kind === "practice") {
    return (
      <span style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 38px", background: "var(--lila-tint)", color: "var(--lila)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IconGrid size={19} />
      </span>
    );
  }
  return (
    <SkillTile skill="schreiben" size={38} radius={11}>
      <IconPencil size={19} />
    </SkillTile>
  );
}

function kindLabel(kind: DetailAssignment["kind"]): string {
  if (kind === "speaking") return "Sprechen";
  if (kind === "practice") return "Übung";
  return "Schreiben";
}

/* ── Anwesenheit ───────────────────────────────────────────────────────── */

function AnwesenheitTab({ sessions }: { sessions: DetailSession[] }) {
  if (sessions.length === 0) {
    return <Empty>Noch keine Sitzungen erfasst. Termine entstehen aus dem Stundenplan.</Empty>;
  }
  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 18, boxShadow: "var(--shadow-card-now)", padding: "6px 20px" }}>
      {sessions.map((s) => {
        const st = sessionStatus(s.status);
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "13px 0", borderTop: "1px solid var(--border-1)" }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, flex: "0 0 34px", background: "var(--surface-alt)", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconCalendar size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-hi)" }}>
                {shortDate(s.startsAt)} · {timeDe(s.startsAt)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                {s.title?.trim() || whenShort(s.startsAt)} · {attendanceSummary(s)}
              </div>
            </div>
            <Pill tone={st.tone} style={{ fontSize: 11.5 }}>{st.label}</Pill>
          </div>
        );
      })}
    </div>
  );
}

function attendanceSummary(s: DetailSession): string {
  if (s.recorded === 0) return "keine Anwesenheit erfasst";
  const parts: string[] = [];
  if (s.present) parts.push(`${s.present} anwesend`);
  if (s.late) parts.push(`${s.late} verspätet`);
  if (s.excused) parts.push(`${s.excused} entschuldigt`);
  if (s.absent) parts.push(`${s.absent} abwesend`);
  return parts.join(" · ");
}

function sessionStatus(status: string): { label: string; tone: Tone } {
  if (status === "held") return { label: "gehalten", tone: "gruen" };
  if (status === "canceled") return { label: "abgesagt", tone: "rot" };
  return { label: "geplant", tone: "neutral" };
}

/* ── Kleinteile ────────────────────────────────────────────────────────── */

function MenuItem({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hover-surface press"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "9px 11px",
        borderRadius: 9,
        border: "none",
        background: "transparent",
        color: danger ? "var(--rot-text)" : "var(--text-1)",
        fontSize: 13.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-1)", borderRadius: 18, boxShadow: "var(--shadow-card-now)", padding: "40px 28px", textAlign: "center", fontSize: 14, lineHeight: 1.6, color: "var(--text-2)" }}>
      {children}
    </div>
  );
}

function confirmCopy(action: Action, vm: ClassDetailVM): { title: string; body: ReactNode; confirmLabel: string } {
  switch (action.type) {
    case "remove":
      return {
        title: "Teilnehmende:n entfernen?",
        body: (
          <>
            <strong style={{ color: "var(--text-hi)" }}>{action.name}</strong> wird aus der Klasse entfernt und benachrichtigt. Bereits abgegebene Arbeiten bleiben erhalten.
          </>
        ),
        confirmLabel: "Entfernen",
      };
    case "archive":
      return {
        title: "Klasse archivieren?",
        body: <>„{vm.name}" wird archiviert. Neue Aufgaben und Beitritte werden gesperrt; offene Bewertungen bleiben möglich.</>,
        confirmLabel: "Archivieren",
      };
    case "unarchive":
      return {
        title: "Klasse reaktivieren?",
        body: <>„{vm.name}" wird wieder aktiv. Aufgaben und Beitritte sind danach erneut möglich.</>,
        confirmLabel: "Reaktivieren",
      };
    case "delete":
      return {
        title: "Klasse endgültig löschen?",
        body: <>„{vm.name}" und alle zugehörigen Daten werden unwiderruflich gelöscht. Dieser Schritt lässt sich nicht rückgängig machen.</>,
        confirmLabel: "Endgültig löschen",
      };
  }
}

const chipBtn: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  border: "none",
  background: "var(--surface-alt)",
  color: "var(--text-1)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
