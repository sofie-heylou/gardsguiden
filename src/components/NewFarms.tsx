import { newestFarms } from "../lib/newFarms";
import { FarmCardStrip } from "./FarmCard";
import type { Farm } from "../types/farm";

/**
 * The farms that entered the guide most recently — on the homepage from every
 * county, on a county page from that county alone. Renders nothing when no
 * farm was added inside the window, so the section never presents an old
 * farm as new. The cards are the ordinary ones, photo thumbnail included,
 * in a row that scrolls sideways so the block stays one card tall.
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
      {lan ? <CountyHeader lan={lan} /> : <HomeHeader />}
      <FarmCardStrip farms={fresh} />
    </section>
  );
}

/** On a county page the block is one section among the county's own, so it
 *  keeps the page's smaller section heading. */
function CountyHeader({ lan }: { lan: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-xl text-stone-900">Nya i {lan}</h2>
      <p className="mt-1 text-sm text-stone-500">Senast tillagda i guiden.</p>
    </div>
  );
}

/** On the homepage the block opens the sheet under the map, so it carries the
 *  same weight as "Populära områden" — eyebrow, display heading, one line —
 *  plus a pill in the map pins' amber. "Tre månaderna" is NEW_FARM_WINDOW_DAYS
 *  in words. */
function HomeHeader() {
  return (
    <div className="mb-3 flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Senast tillagda</span>
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-2xl text-stone-900">Nya gårdar</h2>
        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-900">
          Nytt
        </span>
      </div>
      <p className="text-sm text-stone-500">Gårdar som kommit med i guiden de senaste tre månaderna.</p>
    </div>
  );
}
