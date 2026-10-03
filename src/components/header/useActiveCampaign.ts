import { useEffect, useState } from "react";
import { activeCampaign, type SeasonalCampaign } from "../../lib/seasons";

/** The running seasonal campaign, read after mount so the server's and the
 *  browser's clock can't disagree about it during hydration. */
export function useActiveCampaign(): SeasonalCampaign | null {
  const [campaign, setCampaign] = useState<SeasonalCampaign | null>(null);
  useEffect(() => {
    setCampaign(activeCampaign());
  }, []);
  return campaign;
}
