import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getClassList, type ClassListItem } from "@/lib/klassen";
import { Eyebrow } from "@/components/ui/primitives";
import { IconArrowRight } from "@/components/icons";
import { whenShort } from "@/lib/format";
import { NeueKlasseButton } from "@/components/klassen/NeueKlasseButton";

export const dynamic = "force-dynamic";

export default async function KlassenPage() {
  const user = await requireAuth("/klassen");
  const sb = await supabaseServer();
  const classes = await getClassList(sb);

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "30px 34px 60px" }}>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 26 }}>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Klassen</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, color: "var(--text-hi)", margin: 0, letterSpacing: "-.01em" }}>
            Ihre Klassen
          </h1>
        </div>
        <NeueKlasseButton userId={user.id} />
      </div>

      {classes.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-1)",
            borderRadius: 20,
            boxShadow: "var(--shadow-card-now)",
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--text-hi)", marginBottom: 8 }}>
            Noch keine Klassen
          </div>
          <p style={{ margin: "0 auto 4px", maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: "var(--text-2)" }}>
            Legen Sie Ihre erste Klasse an. Teilnehmende treten anschließend per Beitritts-Code oder E-Mail-Einladung bei.
          </p>
        </div>
      )}
    </div>
  );
}

function ClassCard({ c }: { c: ClassListItem }) {
  const sub = [c.org, c.termLabel].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/klassen/${c.id}`}
      className="hover-card"
      style={{
        display: "block",
        background: "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 20,
        boxShadow: "var(--shadow-card-now)",
        padding: 22,
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 18 }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flex: "0 0 44px",
            background: "var(--cefr-b1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
          }}
        >
          B1
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-hi)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
            {c.archived ? (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-2)", background: "var(--surface-alt)", padding: "2px 8px", borderRadius: 999 }}>
                archiviert
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub || "Ohne Träger · kein Kurszeitraum"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)", borderRadius: 12, padding: "10px 13px", marginBottom: 16 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-2)" }}>Code</span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, letterSpacing: ".1em", color: "var(--text-hi)", flex: 1 }}>
          {c.joinCode}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>zum Beitreten</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
        <Stat value={String(c.members)} label="Mitglieder" />
        <Stat value={String(c.offen)} label="zu bewerten" color={c.offen > 0 ? "var(--gruen)" : "var(--text-hi)"} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-hi)", marginTop: 5 }}>
            {c.nextStartsAt ? whenShort(c.nextStartsAt) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-2)" }}>nächste Stunde</div>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          height: 42,
          borderRadius: 12,
          border: "1px solid var(--border-strong)",
          background: "var(--bg)",
          color: "var(--text-hi)",
          fontSize: 13.5,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
        }}
      >
        Klasse öffnen
        <IconArrowRight size={15} />
      </div>
    </Link>
  );
}

function Stat({ value, label, color = "var(--text-hi)" }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-2)" }}>{label}</div>
    </div>
  );
}
