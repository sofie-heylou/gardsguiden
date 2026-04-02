import type { MetadataRoute } from "next";
import { getAllFarms } from "../lib/farms";
import { SITE_URL } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const farms = getAllFarms();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/lista`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const farmRoutes: MetadataRoute.Sitemap = farms.map((farm) => ({
    url: `${SITE_URL}/gard/${farm.id}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...farmRoutes];
}
