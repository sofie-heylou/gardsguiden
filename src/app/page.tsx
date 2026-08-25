import MapLoader from "../components/MapLoader";
import PopularAreas from "../components/PopularAreas";

// PopularAreas reads farm counts from the DB, which can change outside the
// app; refresh the prerender hourly like the other listing pages.
export const revalidate = 3600;

export default function MapPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="h-full">
        <MapLoader />
      </div>
      <PopularAreas />
    </div>
  );
}
