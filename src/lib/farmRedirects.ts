/**
 * Farm ids that were deleted as duplicates, mapped to the row that stayed.
 * The farm page 301s these so an address Google already indexed keeps
 * working instead of turning into a 404. Add a line whenever a duplicate is
 * removed; never remove one — the old links live on in other people's pages.
 */
export const FARM_REDIRECTS: Record<string, string> = {
  // Duplicate cleanup 2026-09-12 (see scripts/data/duplicate-actions-2026-09-12.json)
  "hagby-gard":                                       "hagby-gard-gardsbutik",
  "bryggerifabriken-fd-bryggeri-skeppsgossen":        "bryggerifabriken",
  "hops-n-leon-of-skaraborg-ab":                      "bryggeriet-i-mariestad",
  "lidingo-musteri":                                  "lidingo-musteri-fiket",
  "skogslidens-bar":                                  "skogslidens-gardsbutik",
  "fulltofta-gard-ab":                                "bryggeri-1766",
  "bergs-appelgard-kopings-musteri-ab-hallstahammar": "kopings-musteri-ab",
  "tradgardscaf":                                     "susegard-gardsforsaljning",
  "brunneby-restaurang":                              "brunneby-musteri-ab",
  "restaurang-logen":                                 "astad-vingard",
  "restaurang-ang":                                   "astad-vingard",
  "cafe-angsbacken":                                  "angsbackens-handelstradgard",
};
