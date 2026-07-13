import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/primitives";

// Seiten-Container + Seitenkopf. Ersetzt die vorher auf jeder Seite
// wiederholte `mx-auto max-w-5xl px-4 pt-6`-Konvention durch den Container
// des Lehrkraft-Portals (max 1160px, 30px/34px/60px Innenabstand — auf
// kleinen Viewports enger).

export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[1160px] px-4 pb-16 pt-6 lg:px-[34px] lg:pb-[60px] lg:pt-[30px] ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow style={{ marginBottom: 7 }}>{eyebrow}</Eyebrow> : null}
        <h1
          className="font-serif"
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-.01em",
            color: "var(--text-hi)",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text-2)",
              maxWidth: 620,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
