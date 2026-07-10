import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getClassDetail } from "@/lib/klassen";
import { KlasseDetailClient } from "@/components/klassen/KlasseDetailClient";

export const dynamic = "force-dynamic";

export default async function KlasseDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  await requireAuth(`/klassen/${classId}`);
  const sb = await supabaseServer();
  const vm = await getClassDetail(sb, classId);
  if (!vm) notFound();

  return <KlasseDetailClient vm={vm} />;
}
