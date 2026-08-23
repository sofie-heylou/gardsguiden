/**
 * Everything the scraper engine (scrape-places.js) takes as input: what to
 * search for, where, and the address-guessing lists. Data only — the rules for
 * judging results live in farm-relevance.js.
 *
 * Union of the five retired scrape-google-places*.js scripts (SCRAPER-PLAN
 * stage 1), pruned in stage 2: "bondens marknad" is gone — a farmers' market
 * is where farms sell *away* from the farm, and the catalog's criterion is
 * buying where things are made. (Markets as their own content type is a
 * backlog idea, not a scrape term.) "destilleri" stays: city distilleries are
 * a real risk, but assess() judges every result on location and name now that
 * the old auto-accept term lists are gone.
 */

'use strict';

// The scraper's output file, as a basename under data/tmp/. Also the default
// input of filter-google-results.ts.
const DEFAULT_SCRAPE_OUT = 'google-places-scrape.json';

// Every raw scrape file under data/tmp/, in one place so compile-farms.js and
// validate-relevance-gate.js stop keeping their own drifting copies of this
// list. `inCompile: false` on the core file preserves what compile-farms
// already did before this roster existed — it never merged that file. Whether
// that was intent or an oversight predates stage 1; resolving it is a stage-2
// question, not something to change by accident here.
const RAW_SCRAPE_FILES = [
  { file: 'google-places-farms.json',             label: 'Google Places (Stockholm, Uppsala, Västmanland, Södermanland)', inCompile: false },
  { file: 'google-places-farms-expansion.json',   label: 'Google Places (Skåne, Kalmar, Gotland)',                        inCompile: true },
  { file: 'google-places-farms-expansion-2.json', label: 'Google Places (Västra Götaland, Halland, Blekinge)',            inCompile: true },
  { file: 'google-places-farms-expansion-3.json', label: 'Google Places (Kronoberg, Jönköping, Östergötland)',            inCompile: true },
  { file: 'google-places-farms-new-terms.json',   label: 'Google Places (all counties, new terms)',                       inCompile: true },
  { file: DEFAULT_SCRAPE_OUT,                     label: 'Google Places (scrape-places.js)',                              inCompile: true },
];

// The original 11 terms plus the 18 added by the new-terms scraper.
const SEARCH_TERMS = [
  // Core (scrape-google-places.js and the expansion scripts)
  'gårdsbutik',
  'gårdsförsäljning',
  'självplock',
  'gårdscafé',
  'musteri',
  'bryggeri',
  'vingård',
  'gårdsrestaurang',
  'lokal producent mat',
  'odlare gård',
  'gårdsmejeri',
  // Farm types (new-terms)
  'lammgård',
  'fårfarm',
  'nötkött gård',
  'viltuppfödare',
  'ekologisk gård',
  'ekogård',
  'regenerativt lantbruk',
  // Products & activities (new-terms)
  'gårdsägg',
  'ägg gård',
  'biodling',
  'fruktodling',
  'bärodling',
  'gårdsslakteri',
  'naturbeteskött',
  'charkuteri gård',
  'gårdsbageri',
  'destilleri',
];

// One or two 80 km-radius search centres per county. Stockholm and Västra
// Götaland get two to cover their spread; overlap is fine — results are
// deduplicated by place_id.
const COUNTY_POINTS = [
  { name: 'Stockholm',       lat: 59.33, lng: 18.07 },
  { name: 'Stockholm',       lat: 59.70, lng: 18.50 }, // Norrtälje / archipelago
  { name: 'Uppsala',         lat: 59.86, lng: 17.64 },
  { name: 'Västmanland',     lat: 59.62, lng: 16.55 },
  { name: 'Södermanland',    lat: 58.98, lng: 16.51 },
  { name: 'Skåne',           lat: 55.83, lng: 13.83 },
  { name: 'Kalmar',          lat: 56.66, lng: 16.36 },
  { name: 'Gotland',         lat: 57.64, lng: 18.29 },
  { name: 'Västra Götaland', lat: 57.71, lng: 12.00 }, // Gothenburg coast
  { name: 'Västra Götaland', lat: 58.39, lng: 13.85 }, // Skövde / inland
  { name: 'Halland',         lat: 56.90, lng: 12.80 },
  { name: 'Blekinge',        lat: 56.16, lng: 15.59 },
  { name: 'Kronoberg',       lat: 56.88, lng: 14.81 },
  { name: 'Jönköping',       lat: 57.78, lng: 14.16 },
  { name: 'Östergötland',    lat: 58.41, lng: 15.62 },
];

// Address → county guessing. Lowercase substrings; first county with a hit
// wins, the search centre's county is the fallback. Known-imperfect (see
// SCRAPER-PLAN backlog: retire in favour of coordinate-based kommun-lookup).
const COUNTY_KEYWORDS = {
  Stockholm: [
    'stockholms', 'norrtälje', 'värmdö', 'nacka', 'haninge', 'tyresö',
    'södertälje', 'botkyrka', 'huddinge', 'lidingö', 'solna', 'sundbyberg',
    'täby', 'danderyd', 'järfälla', 'sigtuna', 'upplands-bro', 'ekerö',
    'nynäshamn', 'vaxholm', 'österåker', 'vallentuna', 'upplands väsby',
  ],
  Uppsala: [
    'uppsala', 'enköping', 'tierp', 'östhammar', 'heby', 'håbo',
    'knivsta', 'älvkarleby',
  ],
  Västmanland: [
    'västerås', 'vastmanland', 'västmanland', 'köping', 'sala',
    'fagersta', 'arboga', 'hallstahammar', 'norberg', 'surahammar',
    'skinnskatteberg', 'kungsör',
  ],
  Södermanland: [
    'södermanland', 'sörmland', 'eskilstuna', 'nyköping', 'strängnäs',
    'gnesta', 'flen', 'katrineholm', 'trosa', 'oxelösund', 'vingåker',
    'mariefred', 'torshälla',
  ],
  Skåne: [
    'skåne', 'malmö', 'helsingborg', 'kristianstad', 'lund', 'ystad', 'trelleborg',
    'eslöv', 'landskrona', 'vellinge', 'burlöv', 'simrishamn', 'tomelilla', 'sjöbo',
    'höör', 'hörby', 'klippan', 'åstorp', 'båstad', 'ängelholm', 'höganäs', 'svalöv',
    'staffanstorp', 'skurup', 'bromölla', 'östra göinge', 'osby', 'hässleholm', 'perstorp',
  ],
  Kalmar: [
    'kalmar', 'oskarshamn', 'västervik', 'vimmerby', 'nybro', 'emmaboda', 'borgholm',
    'mörbylånga', 'torsås', 'mönsterås', 'hultsfred', 'högsby', 'uppvidinge', 'lessebo',
  ],
  Gotland: [
    'gotland', 'visby', 'roma', 'slite', 'hemse', 'burgsvik', 'klintehamn',
  ],
  'Västra Götaland': [
    'västra götaland', 'göteborg', 'borås', 'trollhättan', 'uddevalla', 'skövde',
    'lidköping', 'mariestad', 'alingsås', 'partille', 'härryda', 'stenungsund',
    'tjörn', 'orust', 'lysekil', 'strömstad', 'falköping', 'skara', 'vara',
    'tidaholm', 'ulricehamn', 'mark', 'bollebygd', 'tranemo', 'svenljunga',
    'herrljunga', 'vårgårda', 'lilla edet', 'ale', 'öckerö', 'vänersborg',
    'mellerud', 'bengtsfors', 'åmål', 'dals-ed', 'färgelanda', 'essunga',
    'grästorp', 'götene', 'karlsborg', 'tibro', 'hjo', 'töreboda', 'munkedal',
    'tanum', 'sotenäs',
  ],
  Halland: [
    'halland', 'halmstad', 'varberg', 'falkenberg', 'kungsbacka', 'laholm', 'hylte',
  ],
  Blekinge: [
    'blekinge', 'karlskrona', 'karlshamn', 'ronneby', 'sölvesborg', 'olofström',
  ],
  Kronoberg: [
    'kronoberg', 'växjö', 'ljungby', 'älmhult', 'markaryd', 'tingsryd',
    'uppvidinge', 'lessebo',
  ],
  Jönköping: [
    'jönköping', 'nässjö', 'vetlanda', 'eksjö', 'tranås', 'värnamo', 'gislaved',
    'gnosjö', 'vaggeryd', 'sävsjö', 'aneby', 'mullsjö', 'habo',
  ],
  Östergötland: [
    'östergötland', 'linköping', 'norrköping', 'motala', 'mjölby', 'finspång',
    'vadstena', 'ödeshög', 'valdemarsvik', 'söderköping',
  ],
};

// Address → kommun guessing. First name found in the address wins.
const KOMMUN_LIST = [
  // Stockholm
  'Norrtälje', 'Värmdö', 'Nacka', 'Haninge', 'Tyresö', 'Södertälje', 'Botkyrka',
  'Huddinge', 'Lidingö', 'Solna', 'Sundbyberg', 'Täby', 'Danderyd', 'Järfälla',
  'Sigtuna', 'Upplands-Bro', 'Ekerö', 'Nynäshamn', 'Vaxholm', 'Österåker',
  'Vallentuna', 'Upplands Väsby', 'Stockholm',
  // Uppsala
  'Uppsala', 'Enköping', 'Tierp', 'Östhammar', 'Heby', 'Håbo', 'Knivsta', 'Älvkarleby',
  // Västmanland
  'Västerås', 'Köping', 'Sala', 'Fagersta', 'Arboga', 'Hallstahammar', 'Norberg',
  'Surahammar', 'Skinnskatteberg', 'Kungsör',
  // Södermanland
  'Eskilstuna', 'Nyköping', 'Strängnäs', 'Gnesta', 'Flen', 'Katrineholm', 'Trosa',
  'Oxelösund', 'Vingåker', 'Mariefred', 'Torshälla',
  // Skåne
  'Malmö', 'Helsingborg', 'Kristianstad', 'Lund', 'Ystad', 'Trelleborg', 'Eslöv',
  'Landskrona', 'Vellinge', 'Burlöv', 'Simrishamn', 'Tomelilla', 'Sjöbo', 'Höör',
  'Hörby', 'Klippan', 'Åstorp', 'Båstad', 'Ängelholm', 'Höganäs', 'Svalöv',
  'Staffanstorp', 'Skurup', 'Bromölla', 'Osby', 'Hässleholm', 'Perstorp',
  // Kalmar ('Lessebo' is a Kronoberg kommun and listed there; the old
  // scrapers carried it in both blocks, where the second copy was unreachable)
  'Kalmar', 'Oskarshamn', 'Västervik', 'Vimmerby', 'Nybro', 'Emmaboda', 'Borgholm',
  'Mörbylånga', 'Torsås', 'Mönsterås', 'Hultsfred', 'Högsby',
  // Gotland
  'Gotland', 'Visby',
  // Västra Götaland
  'Göteborg', 'Borås', 'Trollhättan', 'Uddevalla', 'Skövde', 'Lidköping',
  'Mariestad', 'Alingsås', 'Partille', 'Härryda', 'Stenungsund', 'Tjörn',
  'Orust', 'Lysekil', 'Strömstad', 'Falköping', 'Skara', 'Vara', 'Tidaholm',
  'Ulricehamn', 'Mark', 'Bollebygd', 'Tranemo', 'Svenljunga', 'Herrljunga',
  'Vårgårda', 'Lilla Edet', 'Ale', 'Öckerö', 'Vänersborg', 'Mellerud',
  'Bengtsfors', 'Åmål', 'Dals-Ed', 'Färgelanda', 'Essunga', 'Grästorp',
  'Götene', 'Karlsborg', 'Tibro', 'Hjo', 'Töreboda', 'Munkedal', 'Tanum', 'Sotenäs',
  // Halland
  'Halmstad', 'Varberg', 'Falkenberg', 'Kungsbacka', 'Laholm', 'Hylte',
  // Blekinge
  'Karlskrona', 'Karlshamn', 'Ronneby', 'Sölvesborg', 'Olofström',
  // Kronoberg
  'Växjö', 'Ljungby', 'Älmhult', 'Markaryd', 'Tingsryd', 'Uppvidinge', 'Lessebo',
  // Jönköping
  'Jönköping', 'Nässjö', 'Vetlanda', 'Eksjö', 'Tranås', 'Värnamo', 'Gislaved',
  'Gnosjö', 'Vaggeryd', 'Sävsjö', 'Aneby', 'Mullsjö', 'Habo',
  // Östergötland
  'Linköping', 'Norrköping', 'Motala', 'Mjölby', 'Finspång', 'Vadstena',
  'Ödeshög', 'Valdemarsvik', 'Söderköping',
];

module.exports = {
  SEARCH_TERMS, COUNTY_POINTS, COUNTY_KEYWORDS, KOMMUN_LIST,
  DEFAULT_SCRAPE_OUT, RAW_SCRAPE_FILES,
};
