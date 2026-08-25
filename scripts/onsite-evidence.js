/**
 * Does a website describe selling things PRODUCED AT THIS PLACE? The judgment
 * half of stage 3 (SCRAPER-PLAN): verify-onsite.js fetches pages and writes
 * reports; this module owns the phrase lists and the verdict, so that stage 4
 * can reuse the same judgment at intake without dragging the fetcher along.
 *
 * Three-way verdict, deliberately asymmetric:
 *   "verified"     — first-person production language found.
 *   "contradicted" — reseller/venue language found AND no production language.
 *   "unclear"      — everything else. Absence of evidence is not evidence of
 *                    absence: a sparse site proves nothing.
 *
 * Verdicts carry the matched snippets so a human reviewing the report can see
 *  the evidence, not just the label.
 */

'use strict';

// First-person production. Any single match ⇒ verified. Written as regexes on
// lowercased, whitespace-collapsed text.
const STRONG = [
  /vi odlar|odlar vi/,
  /egen odling|egna odlingar|vår odling|våra odlingar/,
  /egenodla(?:d|t|de)/,
  /vi föder upp|föder vi upp|uppfödning (?:av|på gården)|(?:egen|vår|gårdens) uppfödning|uppfödda? på gården/,
  /gräsuppfödd|nötköttsproduktion|köttproduktion|mjölkproduktion|äggproduktion/,
  /våra (?:djur|kor|kossor|får|lamm|grisar|höns|hönor|kycklingar|getter|bin|hjortar)/,
  /hjorthägn|vilthägn/,
  /vår besättning|betar på våra/,
  /eget slakteri|gårdsslakteri|vi slaktar|slaktas på gården/,
  /vi brygger|brygger vi|eget bryggeri|brygg[dt] på gården/,
  /vi ystar|ystas på gården|eget mejeri/,
  /vi bakar|bakar vi|eget bageri/,
  /vi pressar|pressas på gården|egen must/,
  /vi skördar|skördar vi|egen skörd/,
  /självplock|plocka själv|plocka dina egna/,
  /egna bin|egen honung|vi slungar|slungad honung|bigård|bisvärm/,
  /vår vingård|vårt vineri|vinifier|egna druvor|egna äpplen|egna bär|egna grönsaker|egna råvaror/,
  /familjedriven gård|familjegård/,
  /från (?:vår|våra|egen|egna|gårdens) (?:gård|gårdar|odling|odlingar|djur|marker|åkrar|kron|dovhjort|hjortar)/,
  /gårdens egna|gårdens produkter/,
  /vi producerar|egen produktion|egenproducera(?:d|t|de)|egentillverka(?:d|t|de)/,
  /vi tillverkar|tillverkar vi|tillverkas på gården|hantverksmässigt tillverka/,
  /vi destillerar|eget destilleri|eget bränneri/,
  /vi har (?:kor|kossor|får|lamm|grisar|höns|hönor|kycklingar|getter|bin|djur)/,
  /odlas på gården|odlas här|skörd från egna/,
  /vi säljer våra egna|våra egna produkter|egen gårdsbutik/,
  // A milk/egg vending machine on a farm sells the farm's own produce, and
  // having retailers of your own means you make something to retail.
  /mjölkautomat|äggautomat|gårdsautomat|äggbod|mjölkbod/,
  /våra återförsäljare|hitta återförsäljare/,
  // Musteries pressing visitors' apples are producing on site — including
  // pure pressing services with nothing of their own for sale. Sofie's call
  // 2026-08-25: a mustning service is a lovely thing more apple-tree owners
  // should use, and it belongs in the catalog.
  /legopressning|vi pressar (?:dina|era)|musta(?:r|s|de)? (?:dina|era|din|er)|vi tar emot (?:äpplen|päron|frukt)|lämna in dina (?:äpplen|päron)|boka mustning|\bmustning\b/,
  // Swedish farms with English-language sites (Thora Vingård: "locally grown
  // vinified & bottled") deserve the same reading.
  /we (?:grow|raise|brew|bake|produce|harvest)|our (?:vineyard|farm|herd|bees|orchard)|locally grown/,
];

// Farm-life self-description. Two or more ⇒ verified; one alone stays unclear
// ("vår gård" is also how a wedding venue talks).
const SUPPORTING = [
  /vår gård|här på gården|på vår gård/,
  /gårdsbutik|gårdsbod|gårdsförsäljning/,
  /gårdsmejeri|gårdsbryggeri|gårdsbageri|gårdscafé|gårdskafé/,
  /krav-certifier|krav-märkt|ekologisk (?:gård|vingård|odling)/,
  /våra viner|vi driver/,
  /reko-ring|reko ring/,
  /naturbeteskött|mathantverk/,
  /lantbruk|jordbruk/,
  /obemannad/,
  /på gården finns/,
];

// Places that champion local producers — Sofie's call 2026-08-25, drawn from
// her review keeps (Freadals & Friden Gårdskrog, HAFI's fabriksbutik, Forshems
// slow food, Vävra Gårdsdeli, Haddorps' närproducerat focus): these terms mark
// businesses worth keeping even without own production, so they are never
// auto-rejected — a match neutralizes "contradicted" and goes to review.
const LOCAL_SUPPORT = [
  /gårdskrog/,
  /fabriksbutik/,
  /slow ?food/,
  /gårdsdeli/,
  /närproducera|närodla/,
];

// Reseller/venue language — evidence AGAINST on-site production, but only when
// nothing above matched: a farm shop proudly selling neighbours' goods next to
// its own says both, and its own production wins.
const RESELLER = [
  /lokala producenter|lokala leverantörer|våra leverantörer/,
  /noga utvalda|utvalda (?:producenter|gårdar|leverantörer|delikatesser)/,
  /produkter från (?:lokala|andra|traktens|regionens|närliggande) (?:gårdar|producenter|odlare)/,
  /vi säljer produkter från/,
  /grossist/,
  /delikatessbutik|saluhall/,
];

// Content that belongs to no farm at all — expired domains resurrected as
// casino/spam pages (seen in the wild: attanasgard.se). A trust finding in its
// own right, reported separately.
const OFF_TOPIC = /casino|kasino|betting|spelautomater|gratissnurr|välkomstbonus|online slots|krypto ?valuta|viagra/;

// ±40 chars of context around a match, so reports show the sentence, not just
// which regex fired.
function snippet(text, match) {
  const i = match.index;
  const from = Math.max(0, i - 40);
  const to = Math.min(text.length, i + match[0].length + 40);
  return (from > 0 ? '…' : '') + text.slice(from, to).trim() + (to < text.length ? '…' : '');
}

function collectMatches(text, patterns) {
  const hits = [];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) hits.push({ phrase: m[0], context: snippet(text, m) });
  }
  return hits;
}

/**
 * @param {string} text — extracted page text (any case/spacing; normalized here)
 * @returns {{ verdict: "verified"|"unclear"|"contradicted",
 *             strong: {phrase,context}[], supporting: {phrase,context}[],
 *             reseller: {phrase,context}[] }}
 */
function classifyText(text) {
  const t = (text || '').toLowerCase().replace(/\s+/g, ' ');
  const strong = collectMatches(t, STRONG);
  const supporting = collectMatches(t, SUPPORTING);
  const reseller = collectMatches(t, RESELLER);
  const localSupport = collectMatches(t, LOCAL_SUPPORT);

  const offTopic = OFF_TOPIC.test(t) && strong.length === 0;

  let verdict = 'unclear';
  if (strong.length >= 1 || supporting.length >= 2) verdict = 'verified';
  else if (reseller.length >= 1 && supporting.length === 0 && localSupport.length === 0) {
    verdict = 'contradicted'; // local-producer champions are a human call, never auto-out
  }
  if (offTopic) verdict = 'unclear'; // hijacked domain says nothing about the farm

  return { verdict, offTopic, strong, supporting, reseller, localSupport };
}

module.exports = { classifyText, STRONG, SUPPORTING, RESELLER, LOCAL_SUPPORT, OFF_TOPIC };
