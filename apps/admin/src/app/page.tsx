import { redirect } from "next/navigation";

// Die Konsole hat keine eigene Startseite — /uebersicht ist das Dashboard.
// Das Rollen-Gate sitzt in (app)/layout.tsx.
export default function Home() {
  redirect("/uebersicht");
}
