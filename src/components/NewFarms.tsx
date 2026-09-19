import { newestFarms } from "../lib/newFarms";
import { FarmCardList } from "./FarmCard";
import type { Farm } from "../types/farm";

/**
 * The farms that entered the guide most recently — on the homepage from every
 * county, on a county page from that county alone. Renders nothing when no
 * farm was added inside the window, so the section never presents an old
 * farm as new. The cards are the ordinary ones, photo thumbnail included.
 */
export default function NewFarms({ farms, limit, lan, className }: {
  farms: Farm[];
  limit: number;
  lan?: Farm["lan"];
  className?: string;
}) {
  const fresh = newestFarms(farms, { limit });
  if (fresh.length === 0) return null;
  return (
    <section className={className}>
      <div className="mb-3">
        <h2 className="font-display text-xl text-stone-900">{lan ? `Nya i ${lan}` : "Nya gårdar"}</h2>
        <p className="mt-1 text-sm text-stone-500">Senast tillagda i guiden.</p>
      </div>
      <FarmCardList farms={fresh} />
    </section>
  );
}
