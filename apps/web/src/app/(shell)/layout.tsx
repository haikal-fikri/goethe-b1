import type { ReactNode } from "react";
import { PublicShell } from "@/components/shell/PublicShell";

// Hülle für die Lernenden-Routen (/, /lernen, /pruefen, /pay). Routengruppen
// ändern die URL nicht. /uebung und /admin liegen bewusst AUSSERHALB dieser
// Gruppe: der Übungs-Player ist bildschirmfüllend und chromfrei, /admin behält
// seine eigene (nicht migrierte) Kopfzeile.
export default function ShellLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
