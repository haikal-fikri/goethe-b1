import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Wird unter /robots.txt ausgeliefert. Admin- und API-Pfade ausschließen.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
