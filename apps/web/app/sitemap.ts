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
    {
      url: "https://nodetasks.com/download",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://nodetasks.com/privacy",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
