import MapLoader from "../components/MapLoader";
import PopularAreas from "../components/PopularAreas";
import SeasonalBanner from "../components/SeasonalBanner";
import { activeCampaign } from "../lib/seasons";

// PopularAreas reads farm counts from the DB, which can change outside the
// app; refresh the prerender hourly like the other listing pages. The same
// refresh is what starts and ends a seasonal banner on its dates.
export const revalidate = 3600;

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
