import MapLoader from "../components/MapLoader";
import PopularAreas from "../components/PopularAreas";

// PopularAreas reads farm counts from the DB, which can change outside the
// app; refresh the prerender hourly like the other listing pages.
export const revalidate = 3600;

export default function MapPage() {
  return (
    <div className="h-full overflow-y-auto">
      {/* Leave room for the PopularAreas peek: the map eats scroll gestures,
          so the section must be visible above the fold to be discoverable. */}
      <div className="h-[calc(100%-5.5rem)]">
        <MapLoader />
      </div>
      <PopularAreas />
    </div>
  );
}
