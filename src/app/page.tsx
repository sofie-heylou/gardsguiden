import MapLoader from "../components/MapLoader";
import PopularAreas from "../components/PopularAreas";
import SeasonalBanner from "../components/SeasonalBanner";
import { activeCampaign } from "../lib/seasons";

// The build prerenders this page from the seed database, which lacks every
// farm approved through the form (those live only on the volume), so each
// deploy hides them until the page is regenerated from the runtime DB — the
// hourly window used to hide a new farm for an hour after every deploy. A
// minute is cheap: the page re-renders on demand, from SQLite, in a few ms.
// The same refresh is what starts and ends a seasonal banner on its dates.
export const revalidate = 60;

export default function MapPage() {
  const campaign = activeCampaign();
  return (
    <div className="h-full overflow-y-auto">
      {/* Leave room for the PopularAreas peek: the map eats scroll gestures,
          so the section must be visible above the fold to be discoverable.
          A seasonal banner and the map share the space above that peek. */}
      <div className="flex h-[calc(100%-5.5rem)] flex-col">
        {campaign && <SeasonalBanner campaign={campaign} />}
        <div className="min-h-0 flex-1">
          <MapLoader />
        </div>
      </div>
      <PopularAreas />
    </div>
  );
}
