import { ChevronRight } from "lucide-react";
import AddFarmLink from "./AddFarmLink";

// The amber "add your farm" box used at the end of listing pages; the copy
// adapts to the page, the box does not.
export default function AddFarmCallout({
  title,
  text,
  cta,
}: {
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-lg text-stone-900">{title}</p>
        <p className="text-sm text-stone-500">{text}</p>
      </div>
      <AddFarmLink
        surface="listing_callout"
        className="shrink-0 inline-flex items-center justify-center gap-1 px-4 py-2 rounded-full bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors"
      >
        {cta}
        <ChevronRight size={14} />
      </AddFarmLink>
    </div>
  );
}
