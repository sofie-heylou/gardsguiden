import { ImageResponse } from "next/og";
import { getAllFarms } from "../lib/farms";
import { COUNTIES } from "../lib/counties";
import { getFonts, FLOWER_SRC, OgCard } from "../lib/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const farms = getAllFarms();
  const total = farms.length;
  const countyCount = COUNTIES.filter((c) => farms.some((f) => f.lan === c.name)).length;

  return new ImageResponse(
    <OgCard
      flowerSrc={FLOWER_SRC}
      title="Gårdsbutiker i Sverige"
      subtitle={`${total} gårdar · ${countyCount} län`}
    />,
    { ...size, fonts: getFonts() }
  );
}
