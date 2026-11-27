// ====================================================
// IMMEDIATE FOUC PREVENTION (TOP-LEVEL INJECTION)
// ====================================================
(function injectEarlyFoucStyles() {
  if (document.getElementById('cno-fouc-style')) return;
  const style = document.createElement('style');
  style.id = 'cno-fouc-style';
  style.textContent = `
    /* Instantly hide filter panes across accordion and markets page until cno-ready is attached */
    #ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion > div:first-of-type .accordionContent:not(.cno-ready),
    #ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion > div:nth-child(3) .accordionContent:not(.cno-ready),
    #cno-markets-filter-wrapper:not(.cno-ready),
    #cno-games-filter-wrapper:not(.cno-ready) {
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

})();

// Game pages: keep the odds table hidden until the restyle has been applied. This is its own
// <style> element (removed if the restyle is turned off), not a class on <html>, because the
// site can reset <html>'s classes. Fallback: the table shows anyway after 3s.
(function hideGameTableUntilRestyled() {
  if (!/game\.aspx/i.test(location.pathname)) return;
  if (document.getElementById('cno-gt-pending-style')) return;
  const style = document.createElement('style');
  style.id = 'cno-gt-pending-style';
  style.textContent = `
    @keyframes cno-gt-reveal { to { visibility: visible; } }
    #ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1:not(.lh-ready) {
      visibility: hidden !important;
      animation: cno-gt-reveal 0s linear 3s forwards;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
})();

// ====================================================
// SETTINGS & CONFIGURATION
// ====================================================

// True in the Firefox build (see build-firefox.ps1): no GitHub update banner / badge / options section
const CNO_IS_FIREFOX_BUILD = !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest &&
  chrome.runtime.getManifest().browser_specific_settings);

// Every extension setting the user chooses, with its default. Kept in chrome.storage.local
// under these same keys. BACKUP: these are all part of the "Little Helper settings" backup
// (see CNO_BACKUP_HELPER_KEYS below), so a new setting added here is backed up automatically.
const CNO_USER_SETTING_DEFAULTS = {
  enableApRankings: true,
  enableInjuryBadges: true,
  enableMlbWeather: true,
  enableFilterModernization: true,
  enablePctBadges: true,
  hideShareLinkPane: false,
  hideReadmePane: false,
  hideUnusedExtraColumn: false,
  hideUnwantedGameBooks: false,
  modernizeGameTable: true,
  modernizeMainTables: true,
  mainTableDensity: 'standard',
  customSharpDevig: true,
  excludePlayerUndersDefault: false,
  hideEvSlipWhenEmpty: false,          // Positive EV: hide the EV Bet Slip until a leg is added
  useClassicFilterView: false,          // Switch to Classic / Enhanced View (was in the site's localStorage)
  enableRightClickDevig: true,          // game page right-click devig checkbox (was in the site's localStorage)
  excludePlayerUndersByPage: {}         // { 'positive-ev': true|false } (was in the site's localStorage)
};

let userSettings = JSON.parse(JSON.stringify(CNO_USER_SETTING_DEFAULTS));
let userSettingsLoaded = false;

// Saves one setting (and updates the in-memory copy right away)
function cnoSetUserSetting(key, value) {
  userSettings[key] = value;
  try { chrome.storage.local.set({ [key]: value }); } catch (e) { /* ignore */ }
}

// One-time move of the settings CNO's site used to hold (localStorage on crazyninjaodds.com)
// into the extension's storage, so the options page can back them up
function cnoMigrateSiteLocalSettings(done) {
  let ls;
  try { ls = window.localStorage; } catch (e) { ls = null; }
  if (!ls || !/crazyninja/i.test(window.location.hostname || '')) { done(); return; }
  chrome.storage.local.get(['useClassicFilterView', 'enableRightClickDevig', 'excludePlayerUndersByPage'], (have) => {
    const out = {};
    const classic = ls.getItem('cno_use_classic_view');
    if (classic !== null && have.useClassicFilterView === undefined) out.useClassicFilterView = classic === 'true';
    const rc = ls.getItem('cno_enable_rightclick_devig');
    if (rc !== null && have.enableRightClickDevig === undefined) out.enableRightClickDevig = rc !== 'false';
    const unders = Object.assign({}, have.excludePlayerUndersByPage || {});
    let undersFound = false;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      const m = k && k.match(/^cno_exclude_player_unders_(.+)$/);
      if (m && unders[m[1]] === undefined) { unders[m[1]] = ls.getItem(k) === 'true'; undersFound = true; }
    }
    if (undersFound) out.excludePlayerUndersByPage = unders;
    const cleanup = () => {
      try {
        ls.removeItem('cno_use_classic_view');
        ls.removeItem('cno_enable_rightclick_devig');
        Object.keys(ls).filter(k => /^cno_exclude_player_unders_/.test(k)).forEach(k => ls.removeItem(k));
      } catch (e) { /* ignore */ }
      done();
    };
    if (Object.keys(out).length) chrome.storage.local.set(out, cleanup); else cleanup();
  });
}

function refreshUserSettings(callback) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    cnoMigrateSiteLocalSettings(() => {
      chrome.storage.local.get(JSON.parse(JSON.stringify(CNO_USER_SETTING_DEFAULTS)), (items) => {
        userSettings = items;
        userSettingsLoaded = true;
        if (callback) callback();
      });
    });
  } else {
    userSettingsLoaded = true;
    if (callback) callback();
  }
}

function getFilterAccordionContainer() {
  const accordion = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion');
  if (accordion) {
    return accordion.querySelector('.accordionContent');
  }
  return document.querySelector('.accordionContent');
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes) => {
    let needsFilterReset = false;

    for (let [key, { newValue }] of Object.entries(changes)) {
      if (key in userSettings) {
        // A removed setting (e.g. during a restore) goes back to its default
        userSettings[key] = newValue !== undefined ? newValue : JSON.parse(JSON.stringify(CNO_USER_SETTING_DEFAULTS[key]));
        if (key === 'enableFilterModernization') {
          needsFilterReset = true;
        }
      }
    }

    if (!userSettings.enableApRankings) {
      document.querySelectorAll('.cno-ap-rank').forEach(el => el.remove());
      document.querySelectorAll('[data-has-ap-ranked]').forEach(el => delete el.dataset.hasApRanked);
    }

    if (needsFilterReset && !userSettings.enableFilterModernization) {
      const container = getFilterAccordionContainer();
      if (container && container.dataset.originalHTML) {
        container.innerHTML = container.dataset.originalHTML;
        delete container.dataset.restyled;
        container.classList.add('cno-ready');
      }
    }

    if (!userSettings.enablePctBadges) {
      document.querySelectorAll('.cno-badge').forEach(el => el.remove());
      document.querySelectorAll('[data-converted]').forEach(el => delete el.dataset.converted);
    }

    if (!userSettings.enableInjuryBadges) {
      document.querySelectorAll('.cno-injury-badge').forEach(el => el.remove());
    }

    if (!userSettings.enableMlbWeather) {
      document.querySelectorAll('.cno-weather-badge').forEach(el => el.remove());
      document.querySelectorAll('[data-has-weather]').forEach(el => delete el.dataset.hasWeather);
    }

    if (typeof runAll === 'function') runAll();
  });
}

// ====================================================
// HELPER & CONVERSION FUNCTIONS
// ====================================================

function americanToPercentage(americanOdds) {
  if (!americanOdds) return null;
  
  const match = String(americanOdds).match(/([+-]\d+)/);
  if (!match) return null;

  const odds = parseFloat(match[1]);
  if (isNaN(odds)) return null;

  let prob = 0;
  if (odds > 0) {
    prob = 100 / (odds + 100);
  } else if (odds < 0) {
    prob = Math.abs(odds) / (Math.abs(odds) + 100);
  } else {
    return null;
  }

  return (prob * 100).toFixed(1);
}

function percentageToAmerican(pctVal) {
  const prob = parseFloat(pctVal);
  if (isNaN(prob) || prob <= 0 || prob >= 100) return null;

  let american;
  if (prob >= 50) {
    american = Math.round(- (prob / (100 - prob)) * 100);
  } else {
    american = Math.round(+ ((100 - prob) / prob) * 100);
  }

  return american > 0 ? `+${american}` : `${american}`;
}

function calculatePreCommissionPct(netPctVal) {
  const pNet = parseFloat(netPctVal) / 100;
  if (isNaN(pNet) || pNet <= 0 || pNet >= 1) return null;

  const pPre = (0.98 * pNet) / (1 - 0.02 * pNet);
  return (pPre * 100).toFixed(1);
}

function createBadgeInput(percentage, isProphetX = false) {
  let titleAttr = '';
  if (isProphetX) {
    const preComm = calculatePreCommissionPct(percentage);
    if (preComm) titleAttr = ` title="${preComm}% pre-commission"`;
  }
  return `<input class="cno-badge cno-badge-input" type="text" value="${percentage}%"${titleAttr} style="background:#f1f5f9; color:#475569; padding:1px 4px; border-radius:3px; font-size:0.85em; font-weight:500; margin-left:4px; display:inline-block; border:1px solid #e2e8f0; width:48px; text-align:center; outline:none;" />`;
}

function createBadgeStatic(percentage, isCompact = false, isProphetX = false) {
  const paddingStyle = isCompact ? 'padding:0px 3px; line-height:1.0; font-size:0.75em;' : 'padding:1px 4px; font-size:0.8em;';
  let titleAttr = '';
  if (isProphetX) {
    const preComm = calculatePreCommissionPct(percentage);
    if (preComm) titleAttr = ` title="${preComm}% pre-commission"`;
  }
  return `<span class="cno-badge"${titleAttr} style="background:#f1f5f9; color:#475569; ${paddingStyle} font-weight:500; margin-left:4px; display:inline-block; border:1px solid #e2e8f0;">${percentage}%</span>`;
}

function convertOddsInContainer(container, isCompact = false, isProphetX = false) {
  if (!userSettings.enablePctBadges) {
    const existing = container.querySelector('.cno-badge');
    if (existing) existing.remove();
    delete container.dataset.converted;
    return;
  }

  if (!container || container.dataset.converted) return;

  const rawText = container.textContent.trim();
  const pct = americanToPercentage(rawText);

  if (pct) {
    container.insertAdjacentHTML('beforeend', createBadgeStatic(pct, isCompact, isProphetX));
    container.dataset.converted = "true";
  }
}

// ====================================================
// GAME ODDS: BOOK LIST (Google Sheet: ShortCode, FullName, IsPercentage, ShowByDefault)
// Shared by the options page and the game page.
// ====================================================

const CNO_BOOKS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTS09M-p05Qs9ZTzM2VtV5S7g9i9HA3Fw7XqwH_Sv7h8xYwyoixibXoCxPx46Ojxex0l76o5oAEJuWe/pub?gid=83233817&single=true&output=csv';
const CNO_BOOKS_CACHE_KEY = 'cno_books_sheet_cache';
const CNO_GAME_BOOK_VIS_KEY = 'gameBookVisibility'; // { SHORTCODE: true|false } – user choices only

function parseCsvLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

function parseBooksCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const iCode = header.indexOf('shortcode');
  const iName = header.indexOf('fullname');
  const iShow = header.indexOf('showbydefault');
  if (iCode === -1) return [];
  return lines.slice(1).map(l => {
    const c = parseCsvLine(l);
    const code = (c[iCode] || '').toUpperCase();
    return {
      shortCode: code,
      fullName: (iName !== -1 && c[iName]) ? c[iName] : code,
      showByDefault: iShow === -1 ? true : String(c[iShow]).toUpperCase() !== 'FALSE'
    };
  }).filter(b => b.shortCode);
}

// Fetch the sheet (falls back to the last good copy if it can't be reached)
function loadBooksList(callback) {
  const useCache = () => {
    chrome.storage.local.get([CNO_BOOKS_CACHE_KEY], (d) => callback(parseBooksCsv(d && d[CNO_BOOKS_CACHE_KEY])));
  };
  fetch(CNO_BOOKS_CSV_URL)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(text => {
      const books = parseBooksCsv(text);
      if (!books.length) return useCache();
      chrome.storage.local.set({ [CNO_BOOKS_CACHE_KEY]: text });
      callback(books);
    })
    .catch(useCache);
}

function isBookShown(book, visibility) {
  return (visibility && typeof visibility[book.shortCode] === 'boolean') ? visibility[book.shortCode] : book.showByDefault;
}

// ====================================================
// DEVIGGER: VERBOSE BET DESCRIPTION IN "LegOdds"
// LegOdds becomes "<fair odds>     // <event> <market> <bet name>", shortened:
//   "-112     // GSW @ NOP Plr Pts G. Santos o23.5"
// Teams and markets come from two Google Sheet tabs (League,Team,Short and Market,Abbreviation),
// kept in storage and refetched once they're over 7 days old. Anything not on a sheet keeps its
// full name (markets get a few common words shortened). The whole value is URL-encoded by the
// caller, so &, #, +, / etc. can't break the link.
// ====================================================

const CNO_TEAM_ABBR_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTS09M-p05Qs9ZTzM2VtV5S7g9i9HA3Fw7XqwH_Sv7h8xYwyoixibXoCxPx46Ojxex0l76o5oAEJuWe/pub?gid=572061823&single=true&output=csv';
const CNO_MARKET_ABBR_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTS09M-p05Qs9ZTzM2VtV5S7g9i9HA3Fw7XqwH_Sv7h8xYwyoixibXoCxPx46Ojxex0l76o5oAEJuWe/pub?gid=1291491460&single=true&output=csv';
const CNO_TEAM_ABBR_CACHE_KEY = 'cno_team_abbr_cache';     // { at: ms, text: csv }
const CNO_MARKET_ABBR_CACHE_KEY = 'cno_market_abbr_cache'; // { at: ms, text: csv }
const CNO_ABBR_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let cnoTeamAbbr = null;   // { LEAGUE: Map(lowercase team -> short) }
let cnoMarketAbbr = null; // Map(lowercase market -> short)

function cnoParseTeamAbbr(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  const out = {};
  lines.slice(1).forEach(l => {
    const [league, team, short] = parseCsvLine(l);
    if (!league || !team || !short) return;
    const key = league.toUpperCase();
    (out[key] = out[key] || new Map()).set(team.toLowerCase(), short);
  });
  return out;
}

function cnoParseMarketAbbr(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  const out = new Map();
  lines.slice(1).forEach(l => {
    const [market, short] = parseCsvLine(l);
    if (market && short && !out.has(market.toLowerCase())) out.set(market.toLowerCase(), short);
  });
  return out;
}

// Load both sheets from storage; refetch any that are missing or over 7 days old
function cnoLoadAbbreviations() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  const sheets = [
    { key: CNO_TEAM_ABBR_CACHE_KEY, url: CNO_TEAM_ABBR_CSV_URL, apply: (t) => { cnoTeamAbbr = cnoParseTeamAbbr(t); } },
    { key: CNO_MARKET_ABBR_CACHE_KEY, url: CNO_MARKET_ABBR_CSV_URL, apply: (t) => { cnoMarketAbbr = cnoParseMarketAbbr(t); } }
  ];
  chrome.storage.local.get(sheets.map(s => s.key), (d) => {
    sheets.forEach(s => {
      const cached = d && d[s.key];
      if (cached && cached.text) s.apply(cached.text);
      if (cached && cached.text && Date.now() - (cached.at || 0) < CNO_ABBR_MAX_AGE_MS) return;
      fetch(s.url)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(text => {
          if (String(text).split(/\r?\n/).filter(l => l.trim()).length < 2) return;
          s.apply(text);
          chrome.storage.local.set({ [s.key]: { at: Date.now(), text } });
        })
        .catch(() => { /* keep the stored copy */ });
    });
  });
}
cnoLoadAbbreviations();

// "Football - NFL" / "NCAAF" / "Soccer - EPL" -> the sheet's league ("NFL", "NCAA", "Soccer")
function cnoAbbrLeagueKey(league) {
  const t = String(league || '').trim();
  if (!t) return '';
  if (/soccer/i.test(t)) return 'SOCCER';
  const last = t.split(/\s+-\s+/).pop().trim().toUpperCase();
  return /^NCAA/.test(last) ? 'NCAA' : last;
}

// A team's short name, or null. Unknown league: only when one league has that name.
function cnoTeamShort(name, league) {
  if (!cnoTeamAbbr) return null;
  const n = String(name || '').replace(/\(#\d+\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return null;
  const key = cnoAbbrLeagueKey(league);
  if (key && cnoTeamAbbr[key]) {
    const m = cnoTeamAbbr[key];
    if (m.has(n)) return m.get(n);
    // NCAA: a school name that starts the event's name ("Alabama Crimson Tide"), longest first
    if (key === 'NCAA') {
      let best = null;
      m.forEach((v, k) => { if (n.startsWith(k + ' ') && (!best || k.length > best.k.length)) best = { k, v }; });
      if (best) return best.v;
    }
    return null;
  }
  const hits = Object.values(cnoTeamAbbr).filter(m => m.has(n)).map(m => m.get(n));
  return hits.length === 1 ? hits[0] : null;
}

// "Las Vegas Raiders @ Denver Broncos" -> "LV @ DEN" (a team not on the sheet keeps its name)
function cnoAbbreviateEvent(eventName, league) {
  const clean = String(eventName || '').replace(/\(#\d+\)/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const m = clean.match(/^(.*?)\s+(@|vs\.?|v)\s+(.*)$/i);
  if (!m) return cnoTeamShort(clean, league) || clean;
  return `${cnoTeamShort(m[1], league) || m[1]} ${m[2] === '@' ? '@' : 'vs'} ${cnoTeamShort(m[3], league) || m[3]}`;
}

// Common words, for markets that aren't on the sheet (longer phrases first)
const CNO_MARKET_WORDS = [
  [/\b1st Quarter\b/gi, '1Q'], [/\b2nd Quarter\b/gi, '2Q'], [/\b3rd Quarter\b/gi, '3Q'], [/\b4th Quarter\b/gi, '4Q'],
  [/\b1st Half\b/gi, '1H'], [/\b2nd Half\b/gi, '2H'], [/\b1st Period\b/gi, '1P'], [/\b2nd Period\b/gi, '2P'], [/\b3rd Period\b/gi, '3P'],
  [/\bPoint Spread\b/gi, 'Spread'], [/\bMoneyline\b/gi, 'ML'], [/\bAlternate\b/gi, 'Alt'], [/\bPlayer\b/gi, 'Plr'],
  [/\bTotal\b/gi, 'Tot'], [/\bPoints\b/gi, 'Pts'], [/\bRebounds\b/gi, 'Reb'], [/\bAssists\b/gi, 'Ast'],
  [/\bYards\b/gi, 'Yds'], [/\bTouchdowns\b/gi, 'TD'], [/\bStrikeouts\b/gi, 'K'], [/\b3-way\b/gi, '3W']
];

function cnoAbbreviateMarket(market) {
  const m = String(market || '').replace(/\s+/g, ' ').trim();
  if (!m) return '';
  if (cnoMarketAbbr && cnoMarketAbbr.has(m.toLowerCase())) return cnoMarketAbbr.get(m.toLowerCase());
  return CNO_MARKET_WORDS.reduce((s, [re, to]) => s.replace(re, to), m);
}

// Bet name: the event's teams shortened, "Josh Allen" -> "J. Allen" on player markets,
// "Over 2.5" -> "o2.5", "Under 2.5" -> "u2.5"
function cnoAbbreviateBetName(betName, eventName, market, league) {
  let b = String(betName || '').replace(/\s+/g, ' ').trim();
  if (!b) return '';
  const ev = String(eventName || '').replace(/\(#\d+\)/g, '').replace(/\s+/g, ' ').trim();
  const em = ev.match(/^(.*?)\s+(?:@|vs\.?|v)\s+(.*)$/i);
  const teams = em ? [em[1], em[2]] : [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  teams.slice().sort((x, y) => y.length - x.length).forEach(t => {
    const short = cnoTeamShort(t, league);
    if (short) b = b.replace(new RegExp(`(^|\\s)${esc(t)}(?=\\s|$)`, 'gi'), `$1${short}`);
  });
  if (/^player\b/i.test(String(market || '').trim())) {
    // Player name: the words before Over / Under / Yes / No / a number
    const pm = b.match(/^(.+?)(\s+(?:(?:over|under|yes|no)\b|[+-]?\d).*)?$/i);
    if (pm) {
      const words = pm[1].split(' ');
      if (words.length >= 2 && /^[A-Za-z]/.test(words[0]) && !/\.$/.test(words[0])) {
        b = `${words[0][0].toUpperCase()}. ${words.slice(1).join(' ')}${pm[2] || ''}`;
      }
    }
  }
  return b.replace(/\bOver\s+(?=[+-]?\d)/gi, 'o').replace(/\bUnder\s+(?=[+-]?\d)/gi, 'u');
}

function cnoBuildDeviggerLegOdds(fairOdds, eventName, market, betName, league) {
  const desc = [cnoAbbreviateEvent(eventName, league), cnoAbbreviateMarket(market), cnoAbbreviateBetName(betName, eventName, market, league)]
    .map(s => String(s || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  return desc ? `${fairOdds}     // ${desc}` : String(fairOdds); // a few spaces before // to set it off from the odds
}

// Icon for "show only" filters that just hide rows CNO already returned (no new search):
// a funnel over table rows. (Search filters that fill in CNO's own fields use the plain funnel.)
const ROWS_FILTER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="display:block;" aria-hidden="true"><path d="M2 2h14l-5 6v5l-4-2V8L2 2z"/><rect x="13" y="13" width="9" height="2.2" rx="1"/><rect x="13" y="17" width="9" height="2.2" rx="1" opacity=".55"/><rect x="13" y="21" width="9" height="2.2" rx="1" opacity=".3"/></svg>`;

// ====================================================
// CUSTOM SHARP BOOK DEVIGGING: SHARED SETTINGS
// Stored as sharpBookConfig = {
//   devigMethod: 'worstcase' | 'multiplicative' | 'additive' | 'power' | 'shin',
//   sets: [{ key: 'All' | sport | league, marketType: 'all' | 'nonplayer' | 'player', mode: 'average' | 'weighted',
//            books: [{ code: 'PN', weight: 60 (weighted only), minLiq: 500 (exchanges only) }] }]
// }
// The most specific set wins: league, then sport, then All; at each level a set for the line's
// market type (player / non-player) beats one for all markets. Player markets start with "Player ".
// Defaults sheet column MarketType: All / Non-Player / Player.
// Defaults come from a Google Sheet tab (SportorLeague, Sportsbook, AverageorWeighted?, Percentage, MinimumLiquidity).
// ====================================================

const CNO_SHARP_CONFIG_KEY = 'sharpBookConfig';
const CNO_SHARP_DEFAULTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTS09M-p05Qs9ZTzM2VtV5S7g9i9HA3Fw7XqwH_Sv7h8xYwyoixibXoCxPx46Ojxex0l76o5oAEJuWe/pub?gid=1989758400&single=true&output=csv';
const CNO_SHARP_EXCHANGES = ['PX', 'NV', 'KI']; // need a minimum liquidity
const CNO_SHARP_DEVIG_METHODS = [
  { value: 'worstcase', label: 'Worst-case (all four methods)' },
  { value: 'multiplicative', label: 'Multiplicative' },
  { value: 'additive', label: 'Additive' },
  { value: 'power', label: 'Power' },
  { value: 'shin', label: 'Shin' }
];
const CNO_SHARP_MARKET_TYPES = [
  { value: 'all', label: 'All markets' },
  { value: 'nonplayer', label: 'Non-player markets' },
  { value: 'player', label: 'Player markets' }
];

function cnoSharpMarketType(v) {
  const t = String(v || '').toLowerCase().replace(/[^a-z]/g, '');
  if (t === 'player' || t === 'players') return 'player';
  if (t === 'nonplayer' || t === 'nonplayers') return 'nonplayer';
  return 'all';
}

function cnoSharpMarketLabel(type) {
  const m = CNO_SHARP_MARKET_TYPES.find(x => x.value === type);
  return m ? m.label : 'All markets';
}

const CNO_SHARP_SPORTS = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer'];
const CNO_SHARP_LEAGUES = {
  Baseball: ['MLB'],
  Basketball: ['NBA', 'NCAAB', 'NCAAW', 'WNBA'],
  Football: ['NCAAF', 'NFL'],
  Hockey: ['NHL'],
  Soccer: ['Bundesliga (Germany)', 'FIFA World Cup', 'LaLiga (Spain)', 'Liga MX (Mexico)', 'Ligue 1 (France)',
    'MLS (USA)', 'Premier League (England)', 'Serie A (Brazil)', 'Serie A (Italy)',
    'UEFA Champions League', 'UEFA Europa League', 'UEFA Nations League']
};

function cnoSharpSetKind(key) {
  if (key === 'All') return 'all';
  if (CNO_SHARP_SPORTS.some(s => s.toLowerCase() === String(key).toLowerCase())) return 'sport';
  return 'league';
}

function cnoSharpNumber(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, ''));
  return isFinite(n) ? n : null;
}

// Sheet CSV -> config. The first row of each SportorLeague + MarketType decides Average/Weighted for that set.
function parseSharpDefaultsCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const header = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (name) => header.indexOf(name);
  const iKey = col('sportorleague'), iBook = col('sportsbook'), iMode = col('averageorweighted');
  const iPct = col('percentage'), iLiq = col('minimumliquidity'), iType = col('markettype');
  if (iKey === -1 || iBook === -1) return null;
  const sets = [];
  lines.slice(1).forEach(l => {
    const c = parseCsvLine(l);
    const key = (c[iKey] || '').trim();
    const code = (c[iBook] || '').trim().toUpperCase();
    if (!key || !code) return;
    const marketType = cnoSharpMarketType(iType === -1 ? '' : c[iType]);
    let set = sets.find(s => s.key.toLowerCase() === key.toLowerCase() && s.marketType === marketType);
    if (!set) {
      const mode = /^w/i.test(iMode === -1 ? '' : (c[iMode] || '')) ? 'weighted' : 'average';
      set = { key, marketType, mode, books: [] };
      sets.push(set);
    }
    if (set.books.some(b => b.code === code)) return;
    const book = { code };
    const w = iPct === -1 ? null : cnoSharpNumber(c[iPct]);
    const liq = iLiq === -1 ? null : cnoSharpNumber(c[iLiq]);
    if (w !== null) book.weight = w;
    if (liq !== null) book.minLiq = liq;
    set.books.push(book);
  });
  return sets.length ? { devigMethod: 'worstcase', sets } : null;
}

function loadSharpDefaults(callback) {
  fetch(CNO_SHARP_DEFAULTS_CSV_URL)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(text => callback(parseSharpDefaultsCsv(text)))
    .catch(() => callback(null));
}

// "Player Points", "Player Rebounds + Assists"... are player markets
function cnoIsPlayerMarket(market) {
  return /^player /i.test(String(market || '').trim());
}

// The set that applies to a line (null if none): league, then sport, then All; at each level the
// line's own market type first, then a set for all markets
function cnoFindSharpSet(config, sport, league, market) {
  if (!config || !Array.isArray(config.sets)) return null;
  const type = cnoIsPlayerMarket(market) ? 'player' : 'nonplayer';
  const find = (k, t) => k && config.sets.find(s => s.key.toLowerCase() === String(k).trim().toLowerCase()
    && cnoSharpMarketType(s.marketType) === t && s.books && s.books.length);
  for (const k of [league, sport, 'All']) {
    const hit = find(k, type) || find(k, 'all');
    if (hit) return hit;
  }
  return null;
}

// ====================================================
// TOOLBAR ICONS: one plain line style in the button's own color (no emoji)
// ====================================================

// Where "Generated by CNO's Little Helper" links (the Discord copies)
const CNO_LH_SITE_URL = 'https://github.com/tsarstruckphl/CNOsLittleHelper/releases';

const CNO_ICON_PATHS = {
  apply: '<path d="M5 19l2.8-7.4A1 1 0 0 1 8.7 11H21a1 1 0 0 1 1 1.2l-1 5.2A2 2 0 0 1 19 19H5zM5 19a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v2"/>',
  save: '<path d="M6 4h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 4v4h7V4"/><circle cx="12" cy="14" r="2.2"/>',
  swap: '<path d="M7 10h14l-4-4M17 14H3l4 4"/>',
  options: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  classic: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15"/>',
  enhanced: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM18.5 14.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/>',
  devig: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  discord: '<path d="M8.6 6.4c-1.5.3-2.9.8-4.2 1.6C2.9 10.4 2.3 13 2.5 15.7c1.5 1.2 3 1.9 4.6 2.4l1-1.8M15.4 6.4c1.5.3 2.9.8 4.2 1.6 1.5 2.4 2.1 5 1.9 7.7-1.5 1.2-3 1.9-4.6 2.4l-1-1.8M7.6 16.2c2.9 1.2 5.9 1.2 8.8 0M8.6 6.4l.6 1.3c1.9-.4 3.7-.4 5.6 0l.6-1.3"/><circle cx="9.2" cy="12.6" r="1.2"/><circle cx="14.8" cy="12.6" r="1.2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  positiveEv: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  rocket: '<path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3-5a9 9 0 0 0 6-8a3 3 0 0 0-3-3a9 9 0 0 0-8 6a6 6 0 0 0-5 3"/><path d="M7 14a6 6 0 0 0-3 6a6 6 0 0 0 6-3"/><circle cx="15" cy="9" r="1"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  shield: '<path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3"/><path d="M9 12l2 2 4-4"/>',
  ticket: '<path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10M17 4v8a5 5 0 0 1-10 0V4"/><path d="M5 9a2 2 0 1 1 0-4h2M19 9a2 2 0 1 0 0-4h-2"/>',
  lowHold: '<path d="M3 7l6 6 4-4 8 8"/><path d="M21 10v7h-7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4M13.5 6.5l4 4"/>'
};

function cnoIconSvg(name, size = 14) {
  const paths = CNO_ICON_PATHS[name];
  if (!paths) return '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block; vertical-align:-2px; flex:0 0 auto;">${paths}</svg>`;
}

// Sets a button/link to "<icon> text" (text set safely); returns the element
function cnoSetIconLabel(el, icon, text, after) {
  const key = `${icon}|${text}|${after || ''}`;
  if (el.dataset.cnoIconLabel === key) return el;
  el.innerHTML = cnoIconSvg(icon);
  const span = document.createElement('span');
  span.textContent = ` ${text}`;
  el.appendChild(span);
  if (after) {
    const a = document.createElement('span');
    a.setAttribute('aria-hidden', 'true');
    a.textContent = ` ${after}`;
    el.appendChild(a);
  }
  el.dataset.cnoIconLabel = key;
  return el;
}

// ====================================================
// BACKUP / RESTORE / IMPORT / EXPORT: WHAT IS SAVED WHERE
// Every key the extension keeps in chrome.storage.local belongs to exactly one list below.
// When you add something new that the extension saves, add its key to the right list:
//   - a user choice that should survive a backup  -> CNO_BACKUP_HELPER_EXTRA_KEYS
//     (settings in CNO_USER_SETTING_DEFAULTS are included automatically)
//   - saved filters / custom sharp books           -> their own areas (keys below)
//   - caches, update checks, dismissed notices      -> CNO_STORAGE_NOT_BACKED_UP
// The backup page warns (console + a note on the page) about any stored key that's in none of
// them, so a forgotten key shows up instead of silently missing from backups.
// File format changes: bump CNO_BACKUP_FORMAT_VERSION and teach cnoParseTransferXml to read
// the older versions (it ignores anything it doesn't recognize, so new areas don't break old readers).
// ====================================================

const CNO_BACKUP_FORMAT_VERSION = 1;
const CNO_BACKUP_HELPER_EXTRA_KEYS = [
  'gameBookVisibility',      // shown books on game pages
  'cno_game_pair_lines',     // game page: pair 2-/3-way lines
  'cno_game_liq_threshold',  // game page: liquidity highlight
  'cno_default_boost',       // Odds Boost: default boost type / amount
  'sharpShowBetSize'         // Sharp FV popup: show / hide bet size
];
const CNO_BACKUP_FILTERS_KEY = 'cno_saved_filters';
const CNO_BACKUP_SHARP_KEY = 'sharpBookConfig';
const CNO_STORAGE_NOT_BACKED_UP = [
  'cno_books_sheet_cache', 'cno_site_defaults_cache', 'cno_dismissed_notice',
  'cno_last_update_check', 'cno_checked_version', 'updateAvailable', 'latestVersion',
  'downloadUrl', 'releasePageUrl',
  'cno_team_abbr_cache', 'cno_market_abbr_cache', // Devigger comment abbreviations (Google Sheet copies)
  'cno_ev_slip' // the EV Bet Slip's current legs and boost (temporary)
];

function cnoBackupHelperKeys() {
  return Object.keys(CNO_USER_SETTING_DEFAULTS).concat(CNO_BACKUP_HELPER_EXTRA_KEYS);
}

// Stored keys that no list above accounts for (a sign the backup lists need updating)
function cnoUnclassifiedStorageKeys(allStored) {
  const known = new Set(cnoBackupHelperKeys().concat([CNO_BACKUP_FILTERS_KEY, CNO_BACKUP_SHARP_KEY], CNO_STORAGE_NOT_BACKED_UP));
  return Object.keys(allStored || {}).filter(k => !known.has(k));
}

// Page keys used by saved filters -> names people know
const CNO_FILTER_PAGE_NAMES = {
  'positive-ev': 'Positive EV', 'odds-boost': 'Odds Boost', 'free-bet-converter': 'Free Bet',
  'risk-free-bet': 'Risk Free Bet', 'bet-and-get': 'Bet and Get', 'win-and-get': 'Win and Get',
  'low-hold': 'Low Hold', 'arbitrage': 'Arbitrage', 'markets': 'Markets', 'games': 'Games'
};
function cnoFilterPageName(key) { return CNO_FILTER_PAGE_NAMES[key] || key; }

// ---------- CNO's own Settings page ----------

const CNO_SETTINGS_URL = 'https://crazyninjaodds.com/site/account/settings.aspx';
// Fields that are actions, not settings (never backed up or restored)
const CNO_SETTINGS_SKIP = ['CheckBoxResetDeepLinkCookies'];

// The page's fields as a list of plain values. Checkbox and radio lists are kept by their
// labels (e.g. sportsbook names), so a restore still lines up if CNO adds or reorders books.
function cnoReadCnoSettingsDoc(doc) {
  const form = doc.querySelector('form');
  if (!form) return null;
  const short = (id) => String(id || '').replace(/^ContentPlaceHolderMain_ContentPlaceHolderRight_/, '');
  const labelFor = (el) => { const l = doc.querySelector(`label[for="${el.id}"]`); return l ? l.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const fields = [];
  const lists = {};
  form.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.name || /^__/.test(el.name) || ['submit', 'button', 'image', 'hidden', 'file'].includes(el.type)) return;
    if (el.disabled || el.hasAttribute('disabled')) return; // locked by CNO (not a choice, and never sent)
    const id = short(el.id);
    const listMatch = id.match(/^(.*List[A-Za-z]*)_\d+$/); // CheckBoxList / RadioButtonList items
    if (CNO_SETTINGS_SKIP.some(s => id.startsWith(s))) return;
    if (listMatch && (el.type === 'checkbox' || el.type === 'radio')) {
      const listId = listMatch[1];
      if (!lists[listId]) { lists[listId] = { id: listId, kind: el.type === 'radio' ? 'radiolist' : 'checklist', items: [] }; fields.push(lists[listId]); }
      lists[listId].items.push({ label: labelFor(el) || el.value, value: el.value, checked: el.checked || el.hasAttribute('checked') });
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      fields.push({ id, kind: 'checkbox', label: labelFor(el), checked: el.checked || el.hasAttribute('checked') });
    } else if (el.tagName === 'SELECT') {
      const opt = el.querySelector('option[selected]') || el.options[el.selectedIndex] || el.querySelector('option');
      fields.push({ id, kind: 'select', value: opt ? opt.value : '', text: opt ? opt.textContent.trim() : '' });
    } else {
      fields.push({ id, kind: 'text', value: el.getAttribute('value') !== null ? el.getAttribute('value') : el.value });
    }
  });
  return fields;
}

async function cnoFetchCnoSettings() {
  const html = await fetch(CNO_SETTINGS_URL, { credentials: 'include', cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`CNO Settings page: ${r.status}`); return r.text(); });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fields = cnoReadCnoSettingsDoc(doc);
  if (!fields || !fields.length) throw new Error("couldn't read CNO's Settings page (are you signed in to CNO in this browser?)");
  return { html, doc, fields };
}

// Fills CNO's Settings form with the saved values and presses Save Settings (in the background).
// Returns { applied, notFound } and checks the result by reading the page again.
async function cnoRestoreCnoSettings(saved) {
  const { doc } = await cnoFetchCnoSettings();
  const form = doc.querySelector('form');
  const P = 'ContentPlaceHolderMain_ContentPlaceHolderRight_';
  const byShort = (id) => doc.getElementById(P + id) || doc.getElementById(id);
  const labelFor = (el) => { const l = doc.querySelector(`label[for="${el.id}"]`); return l ? l.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const notFound = [];
  let applied = 0;

  // Start from the page as it is, then overwrite with the saved values
  const state = new Map(); // element -> value / checked
  form.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') state.set(el, el.hasAttribute('checked'));
    else if (el.tagName === 'SELECT') { const o = el.querySelector('option[selected]') || el.querySelector('option'); state.set(el, o ? o.value : ''); }
    else state.set(el, el.getAttribute('value') || '');
  });

  (saved || []).forEach(f => {
    if (CNO_SETTINGS_SKIP.some(s => String(f.id).startsWith(s))) return;
    if (f.kind === 'checklist' || f.kind === 'radiolist') {
      const els = Array.from(form.querySelectorAll(`input[id^="${P}${f.id}_"]`));
      if (!els.length) { notFound.push(f.id); return; }
      (f.items || []).forEach(item => {
        const el = els.find(e => labelFor(e) === item.label) || els.find(e => e.value === item.value && item.value !== 'on');
        if (!el) { notFound.push(`${f.id}: ${item.label}`); return; }
        if (el.disabled || el.hasAttribute('disabled')) return; // locked by CNO
        if (f.kind === 'radiolist') { if (item.checked) { els.forEach(e => state.set(e, false)); state.set(el, true); applied++; } }
        else { state.set(el, !!item.checked); applied++; }
      });
    } else {
      const el = byShort(f.id);
      if (!el) { notFound.push(f.id); return; }
      if (f.kind === 'checkbox') state.set(el, !!f.checked);
      else if (f.kind === 'select') {
        const opt = Array.from(el.options).find(o => o.value === f.value) || Array.from(el.options).find(o => o.textContent.trim() === f.text);
        if (!opt) { notFound.push(`${f.id}: ${f.text || f.value}`); return; }
        state.set(el, opt.value);
      } else state.set(el, f.value == null ? '' : String(f.value));
      applied++;
    }
  });

  const body = new URLSearchParams();
  form.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.name || ['submit', 'button', 'image', 'file'].includes(el.type)) return;
    if (el.disabled || el.hasAttribute('disabled')) return; // the browser never sends these either
    const v = state.get(el);
    if (el.type === 'checkbox' || el.type === 'radio') { if (v) body.append(el.name, el.value || 'on'); return; }
    body.append(el.name, v == null ? '' : v);
  });
  const saveBtn = doc.getElementById(P + 'ButtonSaveSettings');
  if (!saveBtn) throw new Error("couldn't find CNO's Save Settings button");
  body.append(saveBtn.name, saveBtn.value);
  const action = new URL(form.getAttribute('action') || CNO_SETTINGS_URL, CNO_SETTINGS_URL).href;
  const res = await fetch(action, { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (!res.ok) throw new Error(`CNO didn't accept the save (${res.status})`);

  // Read the page again and compare
  const after = (await cnoFetchCnoSettings()).fields;
  const mismatches = cnoCompareCnoSettings(saved, after);
  // Tool pages re-read CNO's defaults (they're cached for a day)
  try { chrome.storage.local.remove('cno_site_defaults_cache'); } catch (e) { /* ignore */ }
  return { applied, notFound, mismatches };
}

// Saved values that didn't come out the same after a restore
function cnoCompareCnoSettings(saved, now) {
  const out = [];
  const find = (id) => (now || []).find(f => f.id === id);
  (saved || []).forEach(f => {
    const n = find(f.id);
    if (!n) return;
    if (f.kind === 'checklist' || f.kind === 'radiolist') {
      (f.items || []).forEach(item => {
        const m = (n.items || []).find(i => i.label === item.label);
        if (m && !!m.checked !== !!item.checked) out.push(`${f.id}: ${item.label}`);
      });
    } else if (f.kind === 'checkbox') { if (!!n.checked !== !!f.checked) out.push(f.id); }
    else if (String(n.value) !== String(f.value)) out.push(f.id);
  });
  return out;
}

// ---------- XML file ----------

// data: { helper: {key: value}, cno: [fields], filters: {page: {name: entry}}, sharp: config }
// (only the areas present are written). kind: 'backup' | 'export'
function cnoBuildTransferXml(data, kind) {
  const doc = document.implementation.createDocument(null, 'CNOsLittleHelper', null);
  const root = doc.documentElement;
  root.setAttribute('kind', kind || 'backup');
  root.setAttribute('formatVersion', String(CNO_BACKUP_FORMAT_VERSION));
  try { root.setAttribute('extensionVersion', chrome.runtime.getManifest().version); } catch (e) { /* ignore */ }
  root.setAttribute('created', new Date().toISOString());
  const add = (parent, tag, attrs, json) => {
    const el = doc.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (json !== undefined) el.textContent = JSON.stringify(json);
    parent.appendChild(el);
    return el;
  };
  if (data.helper) {
    const sec = add(root, 'HelperSettings');
    Object.keys(data.helper).sort().forEach(k => add(sec, 'Setting', { key: k }, data.helper[k]));
  }
  if (data.cno) {
    const sec = add(root, 'CnoSettings');
    data.cno.forEach(f => add(sec, 'Field', { id: f.id, kind: f.kind }, f));
  }
  if (data.filters) {
    const sec = add(root, 'SavedFilters');
    Object.keys(data.filters).sort().forEach(page => {
      const p = add(sec, 'Page', { key: page, name: cnoFilterPageName(page) });
      Object.keys(data.filters[page] || {}).forEach(name => add(p, 'Filter', { name }, data.filters[page][name]));
    });
  }
  if (data.sharp) {
    const sec = add(root, 'CustomSharpBooks');
    if (data.sharp.devigMethod) add(sec, 'DevigMethod', { value: data.sharp.devigMethod });
    (data.sharp.sets || []).forEach(s => add(sec, 'Set', { key: s.key, marketType: s.marketType || 'all' }, s));
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc).replace(/></g, '>\n<');
}

// The reverse; unknown parts are skipped, and bad entries are dropped with a note in `problems`
function cnoParseTransferXml(text) {
  const doc = new DOMParser().parseFromString(String(text || ''), 'application/xml');
  const root = doc.documentElement;
  if (!root || root.nodeName !== 'CNOsLittleHelper' || doc.getElementsByTagName('parsererror').length) {
    throw new Error("This isn't a CNO's Little Helper file.");
  }
  const out = {
    kind: root.getAttribute('kind') || 'backup',
    formatVersion: parseInt(root.getAttribute('formatVersion') || '1', 10),
    extensionVersion: root.getAttribute('extensionVersion') || '',
    created: root.getAttribute('created') || '',
    problems: []
  };
  if (out.formatVersion > CNO_BACKUP_FORMAT_VERSION) {
    out.problems.push(`This file was made by a newer version of the extension (${out.extensionVersion || 'unknown'}); parts it doesn't know about are skipped.`);
  }
  const json = (el, what) => { try { return JSON.parse(el.textContent); } catch (e) { out.problems.push(`Skipped ${what}: it's damaged.`); return undefined; } };
  const kids = (el, tag) => Array.from(el.children).filter(c => c.nodeName === tag);
  const sec = (tag) => kids(root, tag)[0];

  const h = sec('HelperSettings');
  if (h) {
    out.helper = {};
    const allowed = new Set(cnoBackupHelperKeys());
    kids(h, 'Setting').forEach(el => {
      const k = el.getAttribute('key');
      if (!allowed.has(k)) return; // a setting this version doesn't have
      const v = json(el, `setting "${k}"`);
      if (v !== undefined) out.helper[k] = v;
    });
  }
  const c = sec('CnoSettings');
  if (c) out.cno = kids(c, 'Field').map(el => json(el, `CNO setting "${el.getAttribute('id')}"`)).filter(f => f && f.id && f.kind);
  const f = sec('SavedFilters');
  if (f) {
    out.filters = {};
    kids(f, 'Page').forEach(p => {
      const page = p.getAttribute('key');
      if (!page) return;
      kids(p, 'Filter').forEach(el => {
        const name = el.getAttribute('name');
        const entry = json(el, `filter "${name}"`);
        if (!name || !entry || typeof entry !== 'object') return;
        (out.filters[page] = out.filters[page] || {})[name] = entry;
      });
    });
  }
  const s = sec('CustomSharpBooks');
  if (s) {
    const dm = kids(s, 'DevigMethod')[0];
    out.sharp = { devigMethod: dm ? dm.getAttribute('value') : null, sets: [] };
    kids(s, 'Set').forEach(el => {
      const set = json(el, `sharp book set "${el.getAttribute('key')}"`);
      if (set && set.key && Array.isArray(set.books)) out.sharp.sets.push(set);
    });
  }
  return out;
}

// Sets match by sport/league + market type
function cnoSharpSetId(s) { return `${String(s.key).toLowerCase()}|${cnoSharpMarketType(s.marketType)}`; }
function cnoSharpSetLabel(s) {
  return `${s.key === 'All' ? 'All sports & leagues' : s.key} · ${cnoSharpMarketLabel(cnoSharpMarketType(s.marketType))} · ${s.mode === 'weighted' ? 'Weighted' : 'Average'}`;
}

// ====================================================
// "ALREADY LOOKED AT" MARKERS FOR THE HALF-SECOND PASSES
// Row filters and badge checks remember what they read from a cell / row, so unchanged rows aren't
// re-read twice a second. CNO replaces the whole table on every update (new rows, so nothing stale
// carries over). As a backstop, everything is re-read anyway every 10 seconds (cnoScanEpoch).
// ====================================================

let cnoScanEpoch = 0;
setInterval(() => { cnoScanEpoch++; }, 10000);

// getCleanCellText, remembered per cell
function cnoCellText(cell) {
  if (!cell) return '';
  if (cell._cnoTextEpoch === cnoScanEpoch) return cell._cnoText;
  const t = getCleanCellText(cell);
  cell._cnoText = t;
  cell._cnoTextEpoch = cnoScanEpoch;
  return t;
}

// True if this row was already checked against this copy of the data (and marks it checked)
function cnoRowScanned(row, key, data) {
  const k = `_cnoScan_${key}`;
  const seen = row[k];
  if (seen && seen.data === data && seen.epoch === cnoScanEpoch) return true;
  row[k] = { data, epoch: cnoScanEpoch };
  return false;
}
