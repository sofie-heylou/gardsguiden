#!/usr/bin/env node
/**
 * Does this web page belong to the business that claims it?
 *
 * Extracted from verify-lead-sites.js when the website audit (verify-onsite.js
 * auditFarm, and through it the Google intake gate) became the second caller.
 * The audit's own question — "does this page describe production?" — can be
 * answered yes by a page that is somebody else's: five farm domains in the
 * August audit had expired into casino spam, and a searched URL for
 * "Gamla Uppsala Musteri" turned out to be Uppsala municipality.
 */

'use strict';

const { normalize, distinctiveTokens, nameMatch } = require('./name-match');
const { OFF_TOPIC } = require('./onsite-evidence');

// A parked or unfinished page only matters when it does not name the business
// — "Sjöfallets is under construction" is still Sjöfallets' own site. Gambling
// spam (OFF_TOPIC) is checked first instead: a hijacked domain sometimes keeps
// the old farm name in its title.
const PARKED = /domain (is )?for sale|köp denna domän|buy this domain|parkerad|under construction|loopia parking|this domain is/i;

// Directory and registry sites: real pages about the business, but not the
// business's own presence, and never what we want to link to.
const DIRECTORIES = /musterier\.se|hitta\.se|merinfo\.se|ratsit\.se|allabolag\.se|eniro\.se|bolagsfakta|118100|yumpu|visitdalarna|matkluster|proff\.se|linkedin\.com|booking\.com|tripadvisor|swenavi|navmapi/i;

/** Internationalised domains arrive as punycode; bällstaträdgård.se reads as xn--… */
function decodeHost(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // Node's URL keeps punycode; domainToUnicode restores the Swedish letters.
    return require('url').domainToUnicode(host) || host;
  } catch { return ''; }
}

function hostMatchesName(host, name) {
  const stem = normalize(host.replace(/\.[a-z.]+$/, ''));
  const joined = stem.split(' ').join('');
  const target = normalize(name).split(' ').join('');
  if (!joined || !target) return false;
  return joined === target || target.includes(joined) || joined.includes(target);
}

/**
 * A title that spells out the whole business name settles it, and has to be
 * checked before nameMatch: nameMatch removes the town first, so a business
 * named after its town ("Uppsala Musteri", "Lidingö Musteri") has no words
 * left and can never match its own site. Removing the town is right when
 * telling two businesses apart; it is wrong when confirming a page is the one
 * it says it is.
 */
const titleNames = (title, name, ort) =>
  Boolean(title) && (normalize(title).includes(normalize(name)) || Boolean(nameMatch(name, title, ort)));

/**
 * The name-and-page evidence. Returns:
 *   verdict      'confirmed'   the page title names the business
 *                'unconfirmed' reachable and clean, title does not name it
 *                'junk'        spam, parked, or a directory listing
 *                'unreachable' dead, HTTP error, or empty
 *   why          human-readable, for review files
 * and, for 'unconfirmed' only:
 *   tokensHit    distinctive name words (town words excluded) found on the page
 *   hostMatches  the domain spells the business name
 *   namesIt      the domain spells the name, a distinctive name word is in the
 *                title or the domain, or every distinctive name word is on the
 *                page — enough for a URL the owner gave Google, not for one
 *                found by web search
 */
function checkIdentity(page, name, ort = '') {
  if (!page || page.status === 0) return { verdict: 'unreachable', why: `unreachable (${page?.error || 'no response'})` };
  if (page.status >= 400) return { verdict: 'unreachable', why: `HTTP ${page.status}` };

  const raw = page.text || '';
  if (!raw.trim()) return { verdict: 'unreachable', why: 'empty page' };
  if (OFF_TOPIC.test(raw.toLowerCase())) return { verdict: 'junk', why: 'gambling or spam content' };
  const host = decodeHost(page.finalUrl || page.url);
  if (DIRECTORIES.test(host)) return { verdict: 'junk', why: `directory listing (${host}), not the business` };

  const title = raw.split(/[|–—·]|\s{2,}/)[0].slice(0, 120).trim();
  if (titleNames(title, name, ort)) return { verdict: 'confirmed', why: `title names it: ${title}` };
  if (PARKED.test(raw)) return { verdict: 'junk', why: 'parked or unfinished page' };

  const text = normalize(raw);
  const ortWords = new Set(normalize(ort).split(' ').filter(Boolean));
  const tokens = [...distinctiveTokens(normalize(name))].filter(t => !ortWords.has(t));
  const tokensHit = tokens.filter(t => text.includes(t));
  const hostMatches = Boolean(host && hostMatchesName(host, name));
  // The title and the domain are what the owner chose to call the site, so one
  // distinctive name word there ("Harsby" in harsbygardsbutik.se, "Wappersta"
  // in "Wappersta gård & lantliv") is stronger than the same word somewhere in
  // the body text.
  const titleAndHost = `${normalize(title)} ${normalize(host).split(' ').join('')}`;
  const namesIt = hostMatches
    || tokens.some(t => t.length >= 4 && titleAndHost.includes(t))
    || (tokens.length > 0 && tokensHit.length === tokens.length);
  return {
    verdict: 'unconfirmed',
    why: `title "${title.slice(0, 60)}" does not name ${name}`,
    tokensHit,
    hostMatches,
    namesIt,
  };
}

module.exports = { DIRECTORIES, hostMatchesName, titleNames, checkIdentity };
