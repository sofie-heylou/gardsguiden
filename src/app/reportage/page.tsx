import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Reportage",
  description: "Läs reportage och berättelser om Sveriges gårdar och direktförsäljning.",
  alternates: { canonical: `${SITE_URL}/reportage` },
};

const articles = [
  {
    slug: "darfor-koper-jag-direkt-fran-bonden",
    title: "Därför köper jag direkt från bonden — och varför det är svårare i Sverige än det borde vara",
    excerpt:
      "Från söndagsmarknader i Australien till handskrivna skyltar längs svenska landsvägar — och varför jag skapade Gårdsguiden.",
    date: "April 2026",
  },
];

export default function ReportagePage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-14 space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-stone-900">
            Reportage
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Berättelser om gårdar, direktförsäljning och varför det spelar roll
            vad vi väljer att äta.
          </p>
        </div>

        <div className="space-y-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/reportage/${article.slug}`}
              className="flex items-start justify-between gap-4 bg-white rounded-xl border border-stone-100 shadow-sm px-5 py-4 hover:border-stone-300 transition-colors group"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-stone-400">{article.date}</p>
                <p className="text-sm font-semibold text-stone-800 group-hover:text-stone-900 leading-snug">
                  {article.title}
                </p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {article.excerpt}
                </p>
              </div>
              <ChevronRight
                size={16}
                className="flex-shrink-0 mt-1 text-stone-300 group-hover:text-stone-500 transition-colors"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
