import Link from "next/link";
import { PageShell } from "@/components/ui/page";
import { IconChevronLeft } from "@/components/icons";
import { SimulationForm } from "@/components/korpus/SimulationForm";

export const dynamic = "force-dynamic";

export default function NeueSimulationPage() {
  return (
    <PageShell width={980} style={{ paddingTop: 26 }}>
      <Link
        href="/korpus"
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
        Zurück zum Korpus
      </Link>

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 28,
          fontWeight: 600,
          color: "var(--text-hi)",
          margin: "0 0 6px",
        }}
      >
        Neue Simulation
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
        Eine Simulation besteht immer aus genau drei Aufgaben. Die ID wird beim Speichern
        serverseitig vergeben.
      </p>

      <SimulationForm />
    </PageShell>
  );
}
