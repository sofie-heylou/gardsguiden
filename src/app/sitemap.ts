import type { MetadataRoute } from "next";
import { getAllFarms } from "../lib/farms";
import { COUNTY_SLUGS, GARDAR_COUNTY_SLUGS, farmPath } from "../lib/counties";
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
    {
      url: `${SITE_URL}/gardar`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const countyRoutes: MetadataRoute.Sitemap = COUNTY_SLUGS.map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const gardarCountyRoutes: MetadataRoute.Sitemap = GARDAR_COUNTY_SLUGS.map((slug) => ({
    url: `${SITE_URL}/gardar/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const farmRoutes: MetadataRoute.Sitemap = farms.map((farm) => ({
    url: `${SITE_URL}${farmPath(farm)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...countyRoutes, ...gardarCountyRoutes, ...farmRoutes];
}
