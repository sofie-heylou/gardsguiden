import { ImageResponse } from "next/og";
import { getFarmById } from "../../../lib/farms";
import { SLUG_TO_COUNTY } from "../../../lib/counties";
import { getFonts, FLOWER_SRC, OgCard } from "../../../lib/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ county: string; slug: string }> };

export default async function Image({ params }: Props) {
  const { county, slug } = await params;
  const lan = SLUG_TO_COUNTY[county];
  const farm = getFarmById(slug);

  if (!lan || !farm) {
    return new ImageResponse(
      <OgCard flowerSrc={FLOWER_SRC} title="Gårdsguiden" />,
      { ...size, fonts: getFonts() }
    );
  }

  const products = farm.products
    .filter((p) => p !== "annat")
    .slice(0, 4)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" · ");

  return new ImageResponse(
    <OgCard
      flowerSrc={FLOWER_SRC}
      eyebrow={`${farm.kommun} · ${farm.lan}`}
      title={farm.name}
      subtitle={products || undefined}
    />,
    { ...size, fonts: getFonts() }
  );
}
