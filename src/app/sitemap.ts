import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE.url}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/editor/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  ];
}
