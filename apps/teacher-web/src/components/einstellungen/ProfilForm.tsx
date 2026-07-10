"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Card, Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/controls";

// Profil-Karte + Inline-Bearbeitung. Der Anzeigename ist ein client-direkter
// RLS-Write ("profiles update own": id = auth.uid()) — KEINE Route. Die E-Mail
// ist an das Auth-Konto gebunden und hier nur lesbar.
export function ProfilForm({
  userId,
  initialName,
  email,
}: {
  userId: string;
  initialName: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown = name.trim() || email || "Lehrkraft";

  async function save() {
    const value = draft.trim();
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabaseBrowser()
        .from("profiles")
        .update({ display_name: value })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      setName(value);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
      <Avatar name={shown} size={56} style={{ fontSize: 18 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Anzeigename"
              autoFocus
              className="focus-ring"
              style={{
                width: "100%",
                maxWidth: 320,
                height: 40,
                borderRadius: 11,
                border: "1px solid var(--border-1)",
                background: "var(--bg)",
                padding: "0 13px",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-hi)",
              }}
            />
            <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
              {email} · E-Mail nicht änderbar
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-hi)" }}>{shown}</div>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>{email} · Lehrkraft</div>
          </>
        )}
        {err ? (
          <div style={{ fontSize: 12.5, color: "var(--rot-text)", marginTop: 6 }}>{err}</div>
        ) : null}
      </div>
      {editing ? (
        <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setDraft(name);
              setErr(null);
            }}
          >
            Abbrechen
          </Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            {busy ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          style={{ flex: "0 0 auto" }}
          onClick={() => {
            setDraft(name);
            setErr(null);
            setEditing(true);
          }}
        >
          Profil bearbeiten
        </Button>
      )}
    </Card>
  );
}
