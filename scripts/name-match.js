#!/usr/bin/env node
/**
 * Deciding whether two Swedish business names are the same business.
 *
 * Extracted from musterier-leads.js when the lead lookup in scrape-places.js
 * became the second caller: a targeted Places query has to reject the result
 * when Google answers with a *different* business in the right town, which is
 * the same judgment the lead matcher makes against the catalog.
 *
 * The rules here are lessons, not guesses. Each one is a false pair that
 * actually occurred:
 *   - "Äppelmusteriet i Huskvarna" ≈ "Säbygård i Huskvarna" — the only shared
 *     word was the town, so a town check confirmed itself.
 *   - "Kulinarika – Mat & Vingård" (Västra Ämtervik) ≈ a vineyard 300 km away —
 *     matched on the compass word "Västra".
 *   - "Gränna musteri" ≈ "Gabis granna Grönsaker" — one shared word, no more.
 *   - "Äppelboden Musteri" vs "Äppelbodens Musteri" — a real duplicate hidden
 *     by the Swedish genitive -s.
 */

'use strict';

// Size and compass words: never what distinguishes two businesses, and never
// what confirms a town either.
const MODIFIERS = ['lilla', 'stora', 'nya', 'gamla', 'vastra', 'ostra', 'norra', 'sodra'];

// What the place is (musteri, vingård) plus filler nouns — shared by half the
// catalog, so useless for telling one business from another.
const CATEGORY_WORDS = [
  'musteri', 'musteriet', 'musterier', 'appelmusteri', 'appelmusteriet',
  'gard', 'gards', 'garden', 'gardsmusteri', 'appleri', 'lantgard',
  'must', 'appel', 'apple', 'frukt', 'tradgard', 'butik', 'gardsbutik',
  'vingard', 'bryggeri', 'mejeri', 'bigard', 'honung', 'honungsbin',
  'mat', 'gron', 'grona', 'ekologiska', 'ekologisk',
];

const GENERIC = new Set([...CATEGORY_WORDS, ...MODIFIERS]);
const ORT_STOP = new Set([...MODIFIERS, 'st']);

// NFKD + combining-mark strip already folds å/ä→a and ö→o; an explicit map
// would only be a second, permanently incomplete copy of the same rule.
const normalize = s => (s || '').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(ab|hb|och|and|the|pa|i)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

// The genitive -s is everywhere in these names and is never the difference
// between two businesses.
const stem = t => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

const distinctiveTokens = normalized =>
  new Set(normalized.split(' ').map(stem).filter(t => t.length > 2 && !GENERIC.has(t)));

/** Words in a town name that can actually corroborate a location. */
const ortSignals = ortNorm =>
  ortNorm.split(' ').filter(w => w.length > 2 && !ORT_STOP.has(w));

/**
 * Does `candidate` name the same business as `wanted`?
 *
 * `ort` is the town both are expected to be in; any word of it is stripped from
 * the comparison first, because two businesses sharing only their town share
 * nothing. Returns one of:
 *   'exact'       — identical once normalized
 *   'distinctive' — every identifying word of the shorter name is in the other
 *   null          — not the same business
 */
function nameMatch(wanted, candidate, ort = '') {
  const a = normalize(wanted);
  const b = normalize(candidate);
  if (!a || !b) return null;
  if (a === b) return 'exact';

  const ortWords = new Set(normalize(ort).split(' ').filter(Boolean));
  const ta = [...distinctiveTokens(a)].filter(t => !ortWords.has(t));
  const tb = [...distinctiveTokens(b)].filter(t => !ortWords.has(t));
  if (ta.length === 0 || tb.length === 0) return null;

  const shared = ta.filter(t => tb.includes(t));
  if (shared.length === 0) return null;

  // One name may carry extra words (a legal form, a second business line), but
  // the shorter one must be fully contained: a single word in common is what
  // paired Gränna with Gabis.
  return shared.length === Math.min(ta.length, tb.length) ? 'distinctive' : null;
}

module.exports = {
  MODIFIERS, CATEGORY_WORDS, GENERIC, ORT_STOP,
  normalize, stem, distinctiveTokens, ortSignals, nameMatch,
};
