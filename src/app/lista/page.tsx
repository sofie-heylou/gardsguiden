import { getAllFarms } from "../../lib/farms";
import FarmList from "../../components/FarmList";

// Farm data is static — revalidate once per hour.
export const revalidate = 3600;

export default function ListPage() {
  const farms = getAllFarms();
  return <FarmList initialFarms={farms} />;
}
