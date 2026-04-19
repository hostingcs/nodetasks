import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://nodetasks.com",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
