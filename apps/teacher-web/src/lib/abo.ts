import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRO_FAIR_USE_CEILINGS } from "@repo/core";

// Server-seitiges View-Model für „Abo & Nutzung". Alle Reads laufen über den
// RLS-scoped SSR-Client: die Lehrkraft sieht nur das eigene Entitlement
// (unique(user_id, kind)), die eigenen Klassen (archived_at is null = aktiv,
// wie enforce_class_cap in 0016) und die eigenen usage_counters (RLS:
// teacher_id = auth.uid(), 0023). Es werden AUSSCHLIESSLICH real vorhandene
// Werte zurückgegeben — Rechnungen liegen bei Polar, nicht in unserer DB.

export type Plan = "starter" | "pro";

// Spiegel von public.plan_limits() (Migration 0016). null = unbegrenzt (Pro).
export const PLAN_CAPS: Record<Plan, { classes: number | null; students: number | null }> = {
  starter: { classes: 3, students: 60 },
  pro: { classes: null, students: null },
};

// Statischer Tarifpreis (Produktfakt, identisch zur Paywall/Design) — KEINE
// Nutzungs- oder Rechnungsdaten, nur der Katalogpreis.
export const PLAN_PRICE: Record<Plan, { amount: string; period: string }> = {
  starter: { amount: "€99", period: "/ Jahr" },
  pro: { amount: "€249", period: "/ Jahr" },
};

// Faire-Nutzungs-Grenze (Pro) für bewertete Audiozeit, in Minuten. Das ist eine
// WEICHE Grenze (fairUse.ts, 05 §3) — sie drosselt/löscht nichts, sie alarmiert.
export const PRO_AUDIO_CAP_MIN = Math.round(PRO_FAIR_USE_CEILINGS.gradedAudioSeconds / 60);

export interface AboData {
  plan: Plan;
  /** Entitlement-Status ('active'|'canceled'|'past_due'|…) oder null (kein Abo-Row). */
  status: string | null;
  /** Abo aktiv UND innerhalb der laufenden Periode. */
  active: boolean;
  /** Es existiert ein Abrechnungsverhältnis (Polar-Kunde) → Portal/Rechnungen sinnvoll. */
  hasBilling: boolean;
  currentPeriodEnd: string | null;
  /** Aktive (nicht archivierte) Klassen — die von enforce_class_cap gezählte Größe. */
  classesUsed: number;
  classesCap: number | null;
  /** Eindeutige aktive Teilnehmende in aktiven Klassen. */
  studentsUsed: number;
  studentsCap: number | null;
  /** UTC-Monatsschlüssel 'YYYY-MM' (wie bump_usage()). */
  period: string;
  /** Bewertete Audiozeit diesen Monat (aus graded_audio_seconds). */
  audioMinutes: number;
  /** Pro: faire-Nutzungs-Grenze in Minuten; Starter: null (keine Minuten-Grenze definiert). */
  audioCapMin: number | null;
  writingGrades: number;
  speakingGrades: number;
  /** Irgendeine KI-Nutzung diesen Monat vorhanden. */
  hasUsage: boolean;
  /** Starter am/über einem harten Limit → Paywall anbieten. */
  atCap: boolean;
}

export async function getAboData(sb: SupabaseClient, userId: string): Promise<AboData> {
  const now = new Date();
  const period = now.toISOString().slice(0, 7); // 'YYYY-MM' in UTC — wie bump_usage()

  // Entitlement (max. 1 Row je Lehrkraft: unique(user_id, kind)).
  const { data: ent } = await sb
    .from("entitlements")
    .select("plan,status,current_period_end")
    .eq("kind", "teacher_subscription")
    .maybeSingle();

  const status = (ent?.status as string | null) ?? null;
  const currentPeriodEnd = (ent?.current_period_end as string | null) ?? null;
  const active =
    !!ent &&
    status === "active" &&
    (!currentPeriodEnd || new Date(currentPeriodEnd).getTime() > now.getTime());
  // Plan wie public.teacher_plan_of(): Pro nur bei aktivem Pro-Abo, sonst Starter.
  const plan: Plan = active && ent?.plan === "pro" ? "pro" : "starter";

  // Aktive (nicht archivierte) Klassen.
  const { data: classRows } = await sb
    .from("classes")
    .select("id")
    .eq("teacher_id", userId)
    .is("archived_at", null);
  const classIds = (classRows ?? []).map((c) => c.id as string);
  const classesUsed = classIds.length;

  // Eindeutige aktive Teilnehmende in diesen Klassen.
  let studentsUsed = 0;
  if (classIds.length) {
    const { data: enr } = await sb
      .from("class_enrollments")
      .select("student_id")
      .in("class_id", classIds)
      .eq("status", "active");
    studentsUsed = new Set((enr ?? []).map((e) => e.student_id as string)).size;
  }

  // Nutzung diesen Monat (RLS: teacher_id = auth.uid()).
  const { data: usage } = await sb
    .from("usage_counters")
    .select("graded_audio_seconds,writing_ai_grades,speaking_ai_grades")
    .eq("teacher_id", userId)
    .eq("period", period)
    .maybeSingle();

  const audioSeconds = Number(usage?.graded_audio_seconds ?? 0);
  const audioMinutes = Math.round(audioSeconds / 60);
  const writingGrades = Number(usage?.writing_ai_grades ?? 0);
  const speakingGrades = Number(usage?.speaking_ai_grades ?? 0);

  const caps = PLAN_CAPS[plan];
  const atCap =
    plan === "starter" &&
    ((caps.classes != null && classesUsed >= caps.classes) ||
      (caps.students != null && studentsUsed >= caps.students));

  return {
    plan,
    status,
    active,
    hasBilling: status !== null,
    currentPeriodEnd,
    classesUsed,
    classesCap: caps.classes,
    studentsUsed,
    studentsCap: caps.students,
    period,
    audioMinutes,
    audioCapMin: plan === "pro" ? PRO_AUDIO_CAP_MIN : null,
    writingGrades,
    speakingGrades,
    hasUsage: audioSeconds > 0 || writingGrades > 0 || speakingGrades > 0,
    atCap,
  };
}
