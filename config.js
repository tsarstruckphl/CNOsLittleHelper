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

let userSettings = {
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
  mainTableDensity: 'standard'
};
let userSettingsLoaded = false;

function refreshUserSettings(callback) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({
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
      mainTableDensity: 'standard'
    }, (items) => {
      userSettings = items;
      userSettingsLoaded = true;
      if (callback) callback();
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
        userSettings[key] = newValue !== undefined ? newValue : !(key === 'hideShareLinkPane' || key === 'hideReadmePane' || key === 'hideUnusedExtraColumn' || key === 'hideUnwantedGameBooks' || key === 'mainTableDensity');
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
// LegOdds becomes "<fair odds>     // <event initials> <market> <bet name>", e.g.
//   "-112     // GSW @ NOP Player Points Guis Santos Over 23.5"
// The whole value is URL-encoded by the caller, so &, #, +, / etc. can't break the link.
// ====================================================

// "Golden State Warriors @ New Orleans Pelicans" -> "GSW @ NOP"
function cnoAbbreviateEvent(eventName) {
  const clean = String(eventName || '')
    .replace(/\(#\d+\)/g, '')          // AP ranks like "(#14)"
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  const initials = (side) => side.split(' ')
    .map(w => (w.match(/[A-Za-z0-9]/) || [''])[0].toUpperCase())
    .join('');
  const m = clean.match(/^(.*?)\s+(@|vs\.?|v)\s+(.*)$/i);
  if (!m) return initials(clean);
  return `${initials(m[1])} ${m[2] === '@' ? '@' : 'vs'} ${initials(m[3])}`;
}

function cnoBuildDeviggerLegOdds(fairOdds, eventName, market, betName) {
  const desc = [cnoAbbreviateEvent(eventName), market, betName]
    .map(s => String(s || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  return desc ? `${fairOdds}     // ${desc}` : String(fairOdds); // a few spaces before // to set it off from the odds
}

// Icon for "show only" filters that just hide rows CNO already returned (no new search):
// a funnel over table rows. (Search filters that fill in CNO's own fields use the plain funnel.)
const ROWS_FILTER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="display:block;" aria-hidden="true"><path d="M2 2h14l-5 6v5l-4-2V8L2 2z"/><rect x="13" y="13" width="9" height="2.2" rx="1"/><rect x="13" y="17" width="9" height="2.2" rx="1" opacity=".55"/><rect x="13" y="21" width="9" height="2.2" rx="1" opacity=".3"/></svg>`;
