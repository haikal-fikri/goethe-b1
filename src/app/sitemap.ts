import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Wird unter /sitemap.xml ausgeliefert. Nur öffentliche, statische Seiten —
// /admin, /api, /pay/danke und die dynamischen /uebung/[lessonId]-Seiten
// bleiben außen vor. (Später optional: Lektionen via getAllItems() ergänzen.)
const ROUTES = ["", "/lernen", "/pruefen", "/pay"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
