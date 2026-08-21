import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import {
  getOrg,
  PLAN_LABEL,
  ABO_LABEL,
  INVITE_LABEL,
  MEMBER_ROLE_LABEL,
  aboTone,
  inviteTone,
} from "@/lib/organisationen";
import { PageShell, StatCard, SectionCard, EmptyRow } from "@/components/ui/page";
import { Pill, Avatar } from "@/components/ui/primitives";
import { IconChevronLeft } from "@/components/icons";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const sb = await supabaseServer();
  const org = await getOrg(sb, orgId);
  if (!org) notFound();

  const aktive = org.mitglieder.filter((m) => m.status === "active").length;
  const offeneEinladungen = org.einladungen.filter((i) => i.status === "pending").length;

  return (
    <PageShell width={1080} style={{ paddingTop: 26 }}>
      <Link
        href="/organisationen"
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
        <IconChevronLeft size={15} strokeWidth={1.9} />
        Alle Organisationen
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                fontWeight: 600,
                color: "var(--text-hi)",
                margin: 0,
              }}
            >
              {org.name}
            </h1>
            <Pill tone={aboTone(org.aboStatus)}>
              {org.plan ? PLAN_LABEL[org.plan] ?? org.plan : "kein Abo"}
              {org.aboStatus && org.aboStatus !== "active"
                ? ` · ${ABO_LABEL[org.aboStatus] ?? org.aboStatus}`
                : ""}
            </Pill>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>
            Inhaber: {org.ownerName} · angelegt {shortDate(org.createdAt)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard label="Aktive Sitze" value={aktive} sub={`von ${org.mitglieder.length} Mitgliedern`} />
        <StatCard label="Offene Einladungen" value={offeneEinladungen} />
        <StatCard
          label="Abo läuft bis"
          value={
            org.periodEnd ? (
              <span style={{ fontSize: 19 }}>{shortDate(org.periodEnd)}</span>
            ) : (
              <span style={{ fontSize: 19, color: "var(--text-3)" }}>—</span>
            )
          }
          sub="Abo des Inhabers"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <SectionCard title="Mitglieder">
          {org.mitglieder.length === 0 ? (
            <EmptyRow>Keine Mitglieder.</EmptyRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {org.mitglieder.map((m) => (
                <div
                  key={m.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "10px 0",
                    borderTop: "1px solid var(--border-1)",
                  }}
                >
                  <Avatar name={m.name} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                      {MEMBER_ROLE_LABEL[m.role] ?? m.role} · seit {shortDate(m.createdAt)}
                    </div>
                  </div>
                  {m.status !== "active" ? <Pill tone="rot">gesperrt</Pill> : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Einladungen">
          {org.einladungen.length === 0 ? (
            <EmptyRow>Keine Einladungen.</EmptyRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {org.einladungen.map((i) => (
                <div
                  key={i.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "10px 0",
                    borderTop: "1px solid var(--border-1)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-hi)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {i.email}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                      {i.status === "pending" ? `läuft ab ${shortDate(i.expiresAt)}` : shortDate(i.createdAt)}
                    </div>
                  </div>
                  <Pill tone={inviteTone(i.status)}>{INVITE_LABEL[i.status] ?? i.status}</Pill>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
