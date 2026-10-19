import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://aamibakes.co.in/",
    changeFrequency: "weekly",
    priority: 1,
  }];
}
