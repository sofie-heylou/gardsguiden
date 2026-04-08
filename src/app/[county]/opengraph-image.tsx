import { ImageResponse } from "next/og";
import { getFarmsByCounty } from "../../lib/farms";
import { SLUG_TO_COUNTY } from "../../lib/counties";
import { getFonts, FLOWER_SRC, OgCard } from "../../lib/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ county: string }> };

export default async function Image({ params }: Props) {
  const { county } = await params;
  const lan = SLUG_TO_COUNTY[county];

  if (!lan) {
    return new ImageResponse(
      <OgCard flowerSrc={FLOWER_SRC} title="Gårdsguiden" />,
      { ...size, fonts: getFonts() }
    );
  }

  const farms = getFarmsByCounty(lan);

  return new ImageResponse(
    <OgCard
      flowerSrc={FLOWER_SRC}
      eyebrow="Gårdar i"
      title={`${lan} län`}
      subtitle={`${farms.length} gårdsbutiker med direktförsäljning`}
    />,
    { ...size, fonts: getFonts() }
  );
}
