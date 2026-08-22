import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Redaktionsoberfläche und Schnittstelle gehören nicht in den Index.
      disallow: ["/admin", "/api"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
