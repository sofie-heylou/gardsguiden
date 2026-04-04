import { notFound, permanentRedirect } from "next/navigation";
import { getFarmById } from "../../../lib/farms";
import { farmPath } from "../../../lib/counties";

/**
 * Legacy URL handler — redirects /gard/[id] → /[county]/[slug] (308 permanent).
 * Keeps old links and search engine entries working after the URL restructure.
 */
type Props = { params: Promise<{ id: string }> };

export default async function LegacyFarmRedirect({ params }: Props) {
  const { id } = await params;
  const farm = getFarmById(id);
  if (!farm) notFound();
  permanentRedirect(farmPath(farm));
}
