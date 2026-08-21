import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { listOrgs, PLAN_LABEL, ABO_LABEL, aboTone } from "@/lib/organisationen";
import { PageShell, PageHeader, EmptyRow } from "@/components/ui/page";
import { Card, Pill } from "@/components/ui/primitives";
import { IconBuilding } from "@/components/icons";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const COLS = "2.2fr 1.4fr 0.8fr 0.9fr 1fr 1fr";

export default async function OrganisationenPage() {
  const sb = await supabaseServer();
  const orgs = await listOrgs(sb);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Organisationen"
        title={orgs.length === 1 ? "1 Organisation" : `${orgs.length} Organisationen`}
      />

      <Card radius={18} padded={false} style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            padding: "13px 20px",
            borderBottom: "1px solid var(--border-1)",
          }}
        >
          {["Organisation", "Inhaber", "Sitze", "Einladungen", "Tarif", "Angelegt"].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: ".09em",
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {orgs.length === 0 ? (
          <div style={{ padding: "18px 20px" }}>
            <EmptyRow>Noch keine Organisationen angelegt.</EmptyRow>
          </div>
        ) : (
          orgs.map((o) => (
            <Link
              key={o.id}
              href={`/organisationen/${o.id}`}
              className="hover-surface"
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 12,
                alignItems: "center",
                padding: "12px 20px",
                borderTop: "1px solid var(--border-1)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    flex: "0 0 32px",
                    background: "var(--surface-alt)",
                    color: "var(--text-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconBuilding size={16} strokeWidth={1.7} />
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--text-hi)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {o.name}
                </span>
              </div>

              <span style={{ fontSize: 13, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {o.ownerName}
              </span>

              <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--text-hi)" }}>
                {o.aktiveMitglieder}
                <span style={{ color: "var(--text-2)", fontSize: 12 }}>/{o.mitglieder}</span>
              </span>

              <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--text-hi)" }}>
                {o.offeneEinladungen > 0 ? o.offeneEinladungen : <span style={{ color: "var(--text-3)" }}>—</span>}
              </span>

              <span style={{ justifySelf: "start" }}>
                <Pill tone={aboTone(o.aboStatus)}>
                  {o.plan ? PLAN_LABEL[o.plan] ?? o.plan : "kein Abo"}
                  {o.aboStatus && o.aboStatus !== "active"
                    ? ` · ${ABO_LABEL[o.aboStatus] ?? o.aboStatus}`
                    : ""}
                </Pill>
              </span>

              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{shortDate(o.createdAt)}</span>
            </Link>
          ))
        )}
      </Card>
    </PageShell>
  );
}
