import Link from "next/link";
import { Page, PageHeader } from "@/components/ui/Page";
import { buttonClass, buttonStyle } from "@/components/ui/controls";
import { IconArrowRight } from "@/components/icons";

export const metadata = {
  title: "Danke · Satzwerk",
};

export default function DankePage() {
  return (
    <Page>
      <PageHeader
        title="Vielen Dank für deinen Beitrag!"
        subtitle="Dein Beitrag hilft, Satzwerk frei nutzbar und werbefrei zu halten. Eine Zahlungsbestätigung erhältst du per E-Mail von Stripe."
      />
      <Link
        href="/"
        className={buttonClass("outline")}
        style={buttonStyle("outline")}
      >
        Zurück zum Üben
        <IconArrowRight size={16} />
      </Link>
    </Page>
  );
}
