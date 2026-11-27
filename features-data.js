function getInjuredPlayerNames(selectedCategory, mode = 'last') {
  const names = [];
  if (typeof injuryDataMap !== 'undefined' && injuryDataMap) {
    injuryDataMap.forEach((info, key) => {
      const parts = key.split('|');
      const sport = parts[0];

      if (selectedCategory === 'ALL' || selectedCategory === sport || selectedCategory.includes(sport)) {
        if (VALID_INJURY_LEAGUES.includes(sport) && info) {
          if (mode === 'full' && info.rawName) {
            let full = info.rawName.trim();
            if (full.includes(',')) {
              const p = full.split(',').map(s => s.trim());
              if (p.length >= 2) full = `${p[1]} ${p[0]}`;
            }
            full = full.replace(/,/g, '').trim();
            if (full && full.toLowerCase() !== 'player') {
              names.push(full);
            }
          } else if (mode === 'last' && info.surname) {
            const cleanSurname = info.surname.trim();
            if (cleanSurname && cleanSurname.toLowerCase() !== 'player') {
              names.push(cleanSurname);
            }
          }
        }
      }
    });
  }

  return Array.from(new Set(names));
}


// ====================================================
// AP TOP 25 RANKINGS INJECTION
// ====================================================

const ESPN_RANKINGS_URLS = {
  NCAAF: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
  NCAAB: "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings"
};

let apRankingsMap = new Map();
const AP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeTeamName(rawName) {
  if (!rawName) return '';
  return rawName
    .toLowerCase()
    .replace(/\b(st|state)\b/g, 'st')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadAPRankings() {
  if (!userSettings.enableApRankings) return;

  const now = Date.now();
  const cachedTime = localStorage.getItem('cno_ap_cache_time');
  const cachedData = localStorage.getItem('cno_ap_cache_data');

  if (cachedTime && cachedData && (now - parseInt(cachedTime, 10) < AP_CACHE_TTL_MS)) {
    try {
      apRankingsMap = new Map(JSON.parse(cachedData));
      return;
    } catch (e) {
      console.warn("Failed to parse cached AP rankings, fetching fresh.");
    }
  }

  for (const [sport, url] of Object.entries(ESPN_RANKINGS_URLS)) {
    try {
      const response = await fetch(url);
      const json = await response.json();

      if (json && Array.isArray(json.rankings)) {
        const apPoll = json.rankings.find(r => 
          (r.name && r.name.toLowerCase().includes('ap')) || 
          (r.shortName && r.shortName.toLowerCase().includes('ap')) ||
          (r.type && r.type.toLowerCase().includes('ap'))
        ) || json.rankings[0];

        if (apPoll && Array.isArray(apPoll.ranks)) {
          apPoll.ranks.forEach(item => {
            const rank = item.current;
            const t = item.team || {};

            // ONLY map the school location/name (e.g., "Florida", "Duke", "Purdue"), ignoring athletic nicknames
            const location = t.location || t.name || '';          

            if (location && rank) {
              const norm = normalizeTeamName(location);
              if (norm.length > 2) {
                apRankingsMap.set(`${sport}|${norm}`, rank);
              }
            }
          });
        }
      }
    } catch (err) {
      console.error(`Failed to fetch AP rankings for ${sport}:`, err);
    }
  }

  try {
    localStorage.setItem('cno_ap_cache_time', now.toString());
    localStorage.setItem('cno_ap_cache_data', JSON.stringify(Array.from(apRankingsMap.entries())));
  } catch (e) {
    console.warn("Could not save AP rankings to LocalStorage:", e);
  }
}

function escapeHtmlForAp(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Exact (full school name) lookup, so "Arkansas" can never match "Central Arkansas"
function getApRank(sportKey, rawTeam) {
  const norm = normalizeTeamName(rawTeam);
  if (!norm) return null;

  let rank = apRankingsMap.get(`${sportKey}|${norm}`);
  // CNO writes "Miami (FL)"; ESPN lists the Hurricanes simply as "Miami"
  if (!rank && norm === 'miami fl') rank = apRankingsMap.get(`${sportKey}|miami`);
  return rank || null;
}

// Events in CNO are always "Away @ Home". Returns the annotated HTML, or null if neither team is ranked.
function buildApRankedEventHtml(eventText, sportKey) {
  const parts = eventText.split(/\s+@\s+/);
  if (parts.length < 2) return null;

  let changed = false;
  const out = parts.map(part => {
    const team = part.trim();
    const rank = getApRank(sportKey, team);
    const safe = escapeHtmlForAp(team);
    if (rank) {
      changed = true;
      return `${safe} <span class="cno-ap-rank" style="color:#0284c7; font-weight:bold; font-size:0.85em;">(#${rank})</span>`;
    }
    return safe;
  });

  return changed ? out.join(' @ ') : null;
}

function processAPRankings() {
  if (!userSettings.enableApRankings) {
    document.querySelectorAll('.cno-ap-rank').forEach(el => el.remove());
    document.querySelectorAll('[data-has-ap-ranked]').forEach(el => delete el.dataset.hasApRanked);
    return;
  }

  if (apRankingsMap.size === 0) return;

  const standardRows = document.querySelectorAll('tr:not(.footable-row-detail)');
  standardRows.forEach(row => {
    if (row.children.length < 5) return;
    if (cnoRowScanned(row, 'ap', apRankingsMap)) return; // already checked against these rankings
    const cells = Array.from(row.children);

    let sportKey = '';
    let eventCell = null;

    cells.forEach((cell) => {
      const txt = cell.textContent.trim().toUpperCase();
      if (txt === 'NCAAF' || txt === 'COLLEGE FOOTBALL') sportKey = 'NCAAF';
      if (txt === 'NCAAB' || txt === 'COLLEGE BASKETBALL' || txt === 'NCAA BASKETBALL') sportKey = 'NCAAB';

      if (cell.querySelector('a[href*="game.aspx"]') || cell.textContent.includes('@') || cell.textContent.includes('vs')) {
        eventCell = cell;
      }
    });

    if (!sportKey || !eventCell || eventCell.dataset.hasApRanked) return;

    const eventLink = eventCell.querySelector('a') || eventCell;
    const eventText = eventLink.textContent.trim();
    if (eventText.includes('(#')) return;

    const rankedHtml = buildApRankedEventHtml(eventText, sportKey);
    if (rankedHtml) eventLink.innerHTML = rankedHtml;
    eventCell.dataset.hasApRanked = "true";
  });

  const detailInnerDivs = document.querySelectorAll('.footable-row-detail-inner');
  detailInnerDivs.forEach(container => {
    let sportKey = '';

    const divs = Array.from(container.children);
    divs.forEach(d => {
      const txt = d.textContent.trim().toUpperCase();
      if (txt.includes('LEAGUE : NCAAF') || txt.includes('SPORT : FOOTBALL')) sportKey = 'NCAAF';
      if (txt.includes('LEAGUE : NCAAB') || txt.includes('SPORT : BASKETBALL')) sportKey = 'NCAAB';
    });

    if (!sportKey) return;

    divs.forEach(div => {
      if (div.dataset.hasApRanked) return;

      const rawHtml = div.innerHTML;
      if (!rawHtml.includes('<strong>Event</strong>') && !rawHtml.includes('<strong>Event :</strong>')) return;

      const eventLink = div.querySelector('a');
      if (!eventLink) return;

      const eventText = eventLink.textContent.trim();
      if (eventText.includes('(#')) return;

      const rankedHtml = buildApRankedEventHtml(eventText, sportKey);
      if (rankedHtml) eventLink.innerHTML = rankedHtml;
      div.dataset.hasApRanked = "true";
    });
  });
}

// ====================================================
// INJURY GUARD INTEGRATION & DYNAMIC REFRESH
// ====================================================

const INJURY_CSV_URLS = {
  NBA: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcB7_SaAEsLEKjjI9Gol2JPAZyVlpasz13wmc7L6MaK8cIfUiRVutHvic_KE_MjTbc8unFJ27W0zZV/pub?gid=0&single=true&output=csv",
  NFL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcB7_SaAEsLEKjjI9Gol2JPAZyVlpasz13wmc7L6MaK8cIfUiRVutHvic_KE_MjTbc8unFJ27W0zZV/pub?gid=460843057&single=true&output=csv",
  MLB: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcB7_SaAEsLEKjjI9Gol2JPAZyVlpasz13wmc7L6MaK8cIfUiRVutHvic_KE_MjTbc8unFJ27W0zZV/pub?gid=402278769&single=true&output=csv",
  WNBA: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcB7_SaAEsLEKjjI9Gol2JPAZyVlpasz13wmc7L6MaK8cIfUiRVutHvic_KE_MjTbc8unFJ27W0zZV/pub?gid=594988415&single=true&output=csv"
};

const STATUS_MAP = {
  'OUT':   { label: 'Out',                            bg: '#ef4444' },
  'IL':    { label: 'Injured List',                   bg: '#ef4444' },
  'IR':    { label: 'Injured Reserve',                bg: '#ef4444' },
  'D':     { label: 'Doubtful',                       bg: '#ef4444' },
  'Q':     { label: 'Questionable',                   bg: '#f59e0b' },
  'D2D':   { label: 'Day-to-Day',                     bg: '#f59e0b' },
  'GTD':   { label: 'Game-Time Decision',             bg: '#f59e0b' },
  'PROB':  { label: 'Probable',                      bg: '#10b981' },
  'S':     { label: 'Suspended',                      bg: '#64748b' },
  'PAT':   { label: 'Paternity Leave',                bg: '#64748b' },
  'BRV':   { label: 'Bereavement Leave',              bg: '#64748b' },
  'COV':   { label: 'COVID-19 Protocol',              bg: '#64748b' },
  'DNR':   { label: 'Did Not Report',                 bg: '#64748b' },
  'NA':    { label: 'Not Available',                  bg: '#64748b' },
  'DevL':  { label: 'Developmental League',           bg: '#64748b' },
  'INAC':  { label: 'Inactive',                       bg: '#64748b' },
  'RES':   { label: 'Reserve List',                   bg: '#64748b' },
  'PUP':   { label: 'Physically Unable to Perform',   bg: '#64748b' },
  'NFI-R': { label: 'Non-Football Injury Reserve', bg: '#64748b' }
};

let injuryDataMap = new Map();
let latestInjuryTimestamp = '';
let injuryTimerId = null;

function getCurrentEasternComponents() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric'
  });

  const parts = formatter.formatToParts(now);
  let hour = 0, minute = 0;
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

function getNextInjuryFetchDelayMs() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric'
  });

  const parts = formatter.formatToParts(now);
  let dayOfWeek = '', hour = 0, minute = 0;
  for (const part of parts) {
    if (part.type === 'weekday') dayOfWeek = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }
  const totalMinutes = hour * 60 + minute;
  const isWeekend = (dayOfWeek === 'Sat' || dayOfWeek === 'Sun');

  const startPeak = 16 * 60;        // 4:00 PM ET
  const endPeak = 20 * 60 + 30;     // 8:30 PM ET
  const weekendStart = 10 * 60;     // 10:00 AM ET

  const startNight = 23 * 60;       // 11:00 PM ET
  const endNight = 8 * 60;          // 8:00 AM ET

  // Weekend: 10:00 AM to 8:30 PM ET -> 1 Minute
  if (isWeekend && totalMinutes >= weekendStart && totalMinutes < endPeak) {
    return 1 * 60 * 1000;
  }

  // Weekday (Mon-Fri): 4:00 PM to 8:30 PM ET -> 1 Minute
  if (!isWeekend && totalMinutes >= startPeak && totalMinutes < endPeak) {
    return 1 * 60 * 1000;
  }

  // Daily: 11:00 PM to 8:00 AM ET -> 60 Minutes
  if (totalMinutes >= startNight || totalMinutes < endNight) {
    return 60 * 60 * 1000;
  }

  // All other times -> 5 Minutes
  return 5 * 60 * 1000;
}


function scheduleNextInjuryDataLoad() {
  if (injuryTimerId) clearTimeout(injuryTimerId);

  const delayMs = getNextInjuryFetchDelayMs();
  injuryTimerId = setTimeout(async () => {
    if (userSettings.enableInjuryBadges) {
      await loadAllInjuryData(true);
    }
    scheduleNextInjuryDataLoad();
  }, delayMs);
}

function normalizePlayerName(rawName) {
  if (!rawName) return '';
  let str = rawName.trim();

  if (str.includes(',')) {
    const parts = str.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      str = `${parts[1]} ${parts[0]}`;
    }
  }

  return str
    .toLowerCase()
    .replace(/\b(over|under|yes|no)\b.*/gi, '')       
    .replace(/[-+]?\d+(\.\d+)?/g, '')                 
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '')         
    .replace(/[^a-z0-9\s]/g, '')                      
    .replace(/\s+/g, ' ')                             
    .trim();
}

function extractPlayerLastName(rawName) {
  if (!rawName) return '';
  let str = rawName.trim();

  if (str.includes(',')) {
    str = str.split(',')[0].trim();
  }

  str = str.replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '').trim();

  const spaceParts = str.split(/\s+/);
  let surname = spaceParts[spaceParts.length - 1] || str;

  if (surname.includes('-')) {
    surname = surname.split('-')[0];
  }

  return surname.replace(/[^a-zA-Z]/g, '').trim();
}

function formatStatusShortCode(status) {
  if (!status) return null;
  const s = status.trim().toUpperCase();

  if (s.includes('IL') || s.includes('DISABLED')) return 'IL';
  if (s.includes('SUSP') || s === 'SUS') return 'S';
  if (s.includes('PATERNITY') || s === 'PL' || s === 'PAT') return 'PAT';
  if (s.includes('BEREAVEMENT') || s === 'BRV') return 'BRV';
  if (s.includes('COV')) return 'COV';
  if (s.includes('DNR')) return 'DNR';
  if (s === 'NA' || s.includes('NOT AVAILABLE')) return 'NA';
  if (s.includes('DEVELOPMENTAL') || s === 'DEVL') return 'DevL';
  if (s.includes('INACTIVE') || s === 'INAC') return 'INAC';
  if (s === 'IR-R' || s === 'IR') return 'IR';
  if (s.includes('RESERVE')) return 'RES';
  if (s.includes('OUT FOR SEASON') || s.includes('SEASON')) return 'OUT';
  if (s.includes('OUT') || s === 'O') return 'OUT';
  if (s.includes('QUESTIONABLE') || s === 'Q') return 'Q';
  if (s.includes('DOUBTFUL') || s === 'D') return 'D';
  if (s.includes('DAY-TO-DAY') || s.includes('DAY TO DAY') || s === 'DTD' || s === 'D2D') return 'D2D';
  if (s.includes('GAME TIME DECISION') || s.includes('GTD')) return 'GTD';
  if (s.includes('PROBABLE') || s === 'P' || s === 'PROB') return 'PROB';
  if (s.includes('PUP-R') || s.includes('PUP')) return 'PUP';
  if (s.includes('NFI-R') || s.includes('NFI')) return 'NFI-R';

  return s;
}

async function loadAllInjuryData(forceRefresh = false) {
  if (!userSettings.enableInjuryBadges) return;

  const now = Date.now();
  const cachedTime = localStorage.getItem('cno_injury_cache_time');
  const cachedMapData = localStorage.getItem('cno_injury_cache_data');
  const cachedTimestamp = localStorage.getItem('cno_injury_last_timestamp') || '';

  const delayMs = getNextInjuryFetchDelayMs();

  if (!forceRefresh && cachedTime && cachedMapData && (now - parseInt(cachedTime, 10) < delayMs)) {
    try {
      const rawEntries = JSON.parse(cachedMapData);
      // Copies saved before team/position were kept get refreshed once
      if (!rawEntries.length || rawEntries.some(([, v]) => v && v.team !== undefined)) {
        injuryDataMap = new Map(rawEntries);
        latestInjuryTimestamp = cachedTimestamp;
        return;
      }
    } catch (e) {
      console.warn("Failed to parse cached injury data, fetching fresh.");
    }
  }

  let newestTsString = cachedTimestamp;
  const newMap = new Map();

  // All four sheets download at once; they're read in the usual order afterwards
  const entries = Object.entries(INJURY_CSV_URLS);
  const texts = await Promise.all(entries.map(([sport, url]) =>
    fetch(url).then(r => r.text()).catch(err => { console.error(`Failed to load injury data for ${sport}:`, err); return null; })));
  entries.forEach(([sport], i) => {
    if (texts[i] === null) return;
    try {
      const extractedTs = parseInjuryCSV(sport, texts[i], newMap);
      if (extractedTs) newestTsString = extractedTs;
    } catch (err) {
      console.error(`Failed to read injury data for ${sport}:`, err);
    }
  });

  injuryDataMap = newMap;
  latestInjuryTimestamp = newestTsString || latestInjuryTimestamp;

  try {
    localStorage.setItem('cno_injury_cache_time', now.toString());
    localStorage.setItem('cno_injury_cache_data', JSON.stringify(Array.from(injuryDataMap.entries())));
    localStorage.setItem('cno_injury_last_timestamp', latestInjuryTimestamp);
  } catch (e) {
    console.warn("Could not save injury cache to LocalStorage:", e);
  }
}

function parseInjuryCSV(sport, csvText, targetMap) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return '';

  let b1Timestamp = '';
  const firstRowCols = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
  if (firstRowCols.length >= 2) {
    b1Timestamp = firstRowCols[1];
  }

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row || !row.trim()) continue;

    const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 2) continue;

    const isPlayerName = (str) => str && !str.startsWith('/') && !str.startsWith('http') && isNaN(str);

    let rawName = '';
    if (isPlayerName(cols[3])) {
      rawName = cols[3];
    } else if (isPlayerName(cols[4])) {
      rawName = cols[4];
    } else if (isPlayerName(cols[0])) {
      rawName = cols[0];
    } else {
      rawName = `${cols[1] || ''} ${cols[2] || ''}`.trim();
    }

    const rawStatus = cols[8] || cols[1] || '';
    const status = formatStatusShortCode(rawStatus);

    let fullDetails = cols[9] || cols[10] || cols[7] || rawStatus;
    if (fullDetails === status || fullDetails === rawStatus) {
      fullDetails = '';
    }

    const surname = extractPlayerLastName(rawName);

    if (rawName && status) {
      const normName = normalizePlayerName(rawName);
      if (normName) {
        const key = `${sport}|${normName}`;
        targetMap.set(key, {
          status: status,
          rawStatus: rawStatus,
          fullDetails: fullDetails,
          surname: surname,
          rawName: rawName,
          // For the event injury report: team (short name, column F), position, injury, return date
          team: (cols[5] || '').toUpperCase(),
          pos: cols[6] || '',
          injury: cols[7] || '',
          returnDate: cols[9] || ''
        });
      }
    }
  }

  return b1Timestamp;
}

function escapeAttrForInjury(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createInjuryBadge(injuryInfo) {
  const status = typeof injuryInfo === 'object' ? injuryInfo.status : injuryInfo;
  const meta = STATUS_MAP[status] || { label: status, bg: '#ef4444' };
  const fg = '#ffffff';

  let tooltip = `${meta.label} (${status})`;
  let details = '';
  let playerName = '';
  if (typeof injuryInfo === 'object') {
    if (injuryInfo.fullDetails) {
      tooltip += ` - ${injuryInfo.fullDetails}`;
      details = injuryInfo.fullDetails;
    }
    playerName = injuryInfo.rawName || '';
    if (playerName.includes(',')) {
      const parts = playerName.split(',').map(p => p.trim());
      if (parts.length >= 2) playerName = `${parts[1]} ${parts[0]}`;
    }
  }
  if (latestInjuryTimestamp) {
    tooltip += ` [Refreshed: ${latestInjuryTimestamp}]`;
  }
  tooltip += ' (Click to search status on Google)';

  return `<span class="cno-injury-badge" title="${escapeAttrForInjury(tooltip)}" data-cno-name="${escapeAttrForInjury(playerName)}" data-cno-status="${escapeAttrForInjury(status)}" data-cno-label="${escapeAttrForInjury(meta.label)}" data-cno-bg="${escapeAttrForInjury(meta.bg)}" data-cno-details="${escapeAttrForInjury(details)}" data-cno-refreshed="${escapeAttrForInjury(latestInjuryTimestamp || '')}" style="background:${meta.bg}; color:${fg}; padding:2px 5px; border-radius:3px; font-size:0.65em; font-weight:bold; line-height:1.2; margin-right:4px; display:inline-block; vertical-align:middle; cursor:pointer;">${status}</span>`;
}

// ---- Click-to-open injury detail card with a Google search link ----

function closeInjuryPopover() {
  const existing = document.getElementById('cno-injury-popover');
  if (existing) existing.remove();
}

function openInjuryPopover(badge) {
  closeInjuryPopover();

  const name = badge.dataset.cnoName || '';
  const status = badge.dataset.cnoStatus || '';
  const label = badge.dataset.cnoLabel || status;
  const bg = badge.dataset.cnoBg || '#ef4444';
  const details = badge.dataset.cnoDetails || '';
  const refreshed = badge.dataset.cnoRefreshed || '';

  const pop = document.createElement('div');
  pop.id = 'cno-injury-popover';
  pop.style.cssText = `
    position: fixed; z-index: 1000003; width: 280px; max-width: 90vw;
    background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25); padding: 12px 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 0.85rem; color: #1e293b; line-height: 1.4; text-align: left; white-space: normal;
  `;

  const head = document.createElement('div');
  head.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';
  const pill = document.createElement('span');
  pill.textContent = status;
  pill.style.cssText = `background:${bg}; color:#fff; font-weight:700; font-size:0.75rem; padding:1px 6px; border-radius:3px; flex-shrink:0;`;
  const title = document.createElement('strong');
  title.textContent = name || 'Player';
  title.style.cssText = 'font-size:0.92rem;';
  head.appendChild(pill);
  head.appendChild(title);
  pop.appendChild(head);

  const statusLine = document.createElement('div');
  statusLine.textContent = label;
  statusLine.style.cssText = 'font-weight:600; color:#334155;';
  pop.appendChild(statusLine);

  if (details) {
    const detailLine = document.createElement('div');
    detailLine.textContent = details;
    detailLine.style.cssText = 'margin-top:4px; color:#475569;';
    pop.appendChild(detailLine);
  }

  if (refreshed) {
    const refLine = document.createElement('div');
    refLine.textContent = `Refreshed: ${refreshed}`;
    refLine.style.cssText = 'margin-top:6px; font-size:0.74rem; color:#64748b;';
    pop.appendChild(refLine);
  }

  if (name) {
    const link = document.createElement('a');
    link.href = `https://www.google.com/search?q=${encodeURIComponent(`is ${name} playing today?`)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Check Injury Status on Google \u2197';
    link.style.cssText = 'display:inline-block; margin-top:8px; color:#0284c7; font-weight:600; text-decoration:underline;';
    pop.appendChild(link);
  }

  document.body.appendChild(pop);

  // Position under the badge, flipping/clamping to stay on screen
  const rect = badge.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = Math.min(Math.max(8, rect.left), window.innerWidth - pw - 8);
  let top = rect.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 6);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

document.addEventListener('click', (e) => {
  const badge = e.target.closest ? e.target.closest('.cno-injury-badge') : null;
  const insidePopover = e.target.closest ? e.target.closest('#cno-injury-popover') : null;

  if (badge) {
    e.preventDefault();
    e.stopPropagation();
    const name = badge.dataset.cnoName || '';
    if (name) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(`is ${name} playing today?`)}`, '_blank', 'noopener,noreferrer');
    } else {
      openInjuryPopover(badge);
    }
  } else if (!insidePopover) {
    closeInjuryPopover();
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeInjuryPopover();
}, true);

window.addEventListener('scroll', closeInjuryPopover, true);

function processInjuryBadges() {
  if (!userSettings.enableInjuryBadges) {
    document.querySelectorAll('.cno-injury-badge').forEach(el => el.remove());
    return;
  }

  if (injuryDataMap.size === 0) return;

  // Game pages: one league for the whole page (from "Sport - League" at the top), names in the first column
  if (window.location.pathname.toLowerCase().includes('game.aspx')) {
    processGameInjuryBadges();
    return;
  }

  const headerBetIdxCache = new WeakMap();
  const getHeaderBetIdx = (row) => {
    const table = row.closest('table');
    if (!table) return -1;
    if (headerBetIdxCache.has(table)) return headerBetIdxCache.get(table);
    let idx = -1;
    const ths = Array.from(table.querySelectorAll('thead th'));
    ths.forEach((th, i) => {
      if (idx === -1 && th.textContent.trim().toLowerCase() === 'bet') idx = i;
    });
    headerBetIdxCache.set(table, idx);
    return idx;
  };

  const rows = document.querySelectorAll('tr');
  rows.forEach(row => {
    if (row.children.length < 8) return;
    if (cnoRowScanned(row, 'inj', injuryDataMap)) return; // already checked against this injury data
    const cells = Array.from(row.children);
    if (row.querySelector('.cno-injury-badge')) return;

    let league = '';
    for (const cell of cells) {
      const txt = cell.textContent.trim().toUpperCase();
      if (txt === 'WNBA') { league = 'WNBA'; break; }
      if (txt === 'NBA') { league = 'NBA'; break; }
      if (txt === 'NFL') { league = 'NFL'; break; } // NFL only: college players aren't on the injury lists
      if (txt === 'MLB') { league = 'MLB'; break; }
    }

    if (!league) return;

    // The bet/player column is not at a fixed index (e.g. EV/Low Hold vs Boost/Free Bet pages),
    // so try the header-derived column first, then the known positions.
    const candidates = [getHeaderBetIdx(row), 8, 7].filter((i, pos, arr) => i >= 0 && arr.indexOf(i) === pos);

    for (const idx of candidates) {
      const betCell = cells[idx];
      if (!betCell) continue;

      const normalizedBetName = normalizePlayerName(betCell.textContent.trim());
      if (!normalizedBetName) continue;

      const injuryInfo = injuryDataMap.get(`${league}|${normalizedBetName}`);
      if (injuryInfo) {
        betCell.insertAdjacentHTML('afterbegin', createInjuryBadge(injuryInfo));
        break;
      }
    }
  });
}

function processPlayerTableRefreshTimestamp() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const existingBanner = document.getElementById('cno-injury-refresh-banner');

  if (!table) {
    if (existingBanner) existingBanner.remove();
    return;
  }

  const headerCells = Array.from(table.querySelectorAll('thead th'));
  let marketColIdx = -1;

  headerCells.forEach((th, idx) => {
    const txt = th.textContent.trim().toLowerCase();
    if (txt.includes('market')) {
      marketColIdx = idx;
    }
  });

  // Pages without a Market column (e.g. game pages) never show the notice
  if (marketColIdx === -1) {
    if (existingBanner) existingBanner.remove();
    return;
  }

  let hasPlayerRow = false;
  const rows = table.querySelectorAll('tbody tr:not(.footable-row-detail)');
  rows.forEach(row => {
    const cell = row.children[marketColIdx];
    if (cell && cell.textContent.toLowerCase().includes('player')) {
      hasPlayerRow = true;
    }
  });

  const tsToDisplay = latestInjuryTimestamp || localStorage.getItem('cno_injury_last_timestamp') || '';
  const showNotice = userSettings.enableInjuryBadges && hasPlayerRow && !!tsToDisplay;

  let banner = existingBanner;
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'cno-injury-refresh-banner';
    banner.style.cssText = `
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 12px;
      font-size: 0.7rem;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 4px;
      width: 100%;
    `;
  }
  // Right above the table (the EV Bet Slip's dock may sit between them)
  const next = banner.nextElementSibling;
  if (next !== table && !(next && next.id === 'cno-slip-dock' && next.nextElementSibling === table)) {
    table.parentNode.insertBefore(banner, table);
  }

  // The space is always kept so the gap between the filters and the table doesn't change;
  // when there's nothing to show, the same line is rendered invisibly.
  const html = showNotice
    ? `<span class="cno-injury-updated">Injury statuses last refreshed at ${tsToDisplay}</span>`
    : `<span class="cno-injury-updated" style="visibility:hidden;" aria-hidden="true">Injury statuses last refreshed at 00:00</span>`;
  if (banner.dataset.cnoHtml !== html) {
    banner.innerHTML = html;
    banner.dataset.cnoHtml = html;
  }
}

// ====================================================
// MLB WEATHER INTEGRATION
// ====================================================

const MLB_WEATHER_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcB7_SaAEsLEKjjI9Gol2JPAZyVlpasz13wmc7L6MaK8cIfUiRVutHvic_KE_MjTbc8unFJ27W0zZV/pub?gid=1854436716&single=true&output=csv";
const WEATHER_CACHE_TTL_MS = 60 * 60 * 1000;

const MLB_TEAM_NORM_MAP = {
  'arizona diamondbacks': 'ARI', 'diamondbacks': 'ARI', 'd-backs': 'ARI', 'ari': 'ARI', 'az': 'ARI',
  'atlanta braves': 'ATL', 'braves': 'ATL', 'atl': 'ATL',
  'baltimore orioles': 'BAL', 'orioles': 'BAL', 'bal': 'BAL',
  'boston red sox': 'BOS', 'red sox': 'BOS', 'bos': 'BOS',
  'chicago cubs': 'CHC', 'cubs': 'CHC', 'chc': 'CHC', 'chcubs': 'CHC',
  'chicago white sox': 'CWS', 'white sox': 'CWS', 'cws': 'CWS', 'chw': 'CWS', 'sox': 'CWS',
  'cincinnati reds': 'CIN', 'reds': 'CIN', 'cin': 'CIN',
  'cleveland guardians': 'CLE', 'guardians': 'CLE', 'indians': 'CLE', 'cle': 'CLE',
  'colorado rockies': 'COL', 'rockies': 'COL', 'col': 'COL',
  'detroit tigers': 'DET', 'tigers': 'DET', 'det': 'DET',
  'houston astros': 'HOU', 'astros': 'HOU', 'hou': 'HOU',
  'kansas city royals': 'KCR', 'royals': 'KCR', 'kc royals': 'KCR', 'kcr': 'KCR', 'kc': 'KCR',
  'los angeles angels': 'LAA', 'angels': 'LAA', 'la angels': 'LAA', 'laa': 'LAA', 'ana': 'LAA',
  'los angeles dodgers': 'LAD', 'dodgers': 'LAD', 'la dodgers': 'LAD', 'lad': 'LAD', 'la': 'LAD',
  'miami marlins': 'MIA', 'marlins': 'MIA', 'mia': 'MIA', 'fla': 'MIA',
  'milwaukee brewers': 'MIL', 'brewers': 'MIL', 'mil': 'MIL',
  'minnesota twins': 'MIN', 'twins': 'MIN', 'min': 'MIN',
  'new york mets': 'NYM', 'mets': 'NYM', 'nym': 'NYM',
  'new york yankees': 'NYY', 'yankees': 'NYY', 'nyy': 'NYY',
  'oakland athletics': 'OAK', 'athletics': 'OAK', 'a\'s': 'OAK', 'oak': 'OAK', 'sacramento athletics': 'OAK',
  'philadelphia phillies': 'PHI', 'phillies': 'PHI', 'phi': 'PHI',
  'pittsburgh pirates': 'PIT', 'pirates': 'PIT', 'pit': 'PIT', 'san diego padres': 'SDP', 'padres': 'SDP', 'sd padres': 'SDP', 'sdp': 'SDP', 'sd': 'SDP',
  'san francisco giants': 'SFG', 'giants': 'SFG', 'sf giants': 'SFG', 'sfg': 'SFG', 'sf': 'SFG',
  'seattle mariners': 'SEA', 'mariners': 'SEA', 'sea': 'SEA', 'st. louis cardinals': 'STL', 'st louis cardinals': 'STL', 'cardinals': 'STL', 'stl': 'STL',
  'tampa bay rays': 'TBR', 'rays': 'TBR', 'tb rays': 'TBR', 'tbr': 'TBR', 'tb': 'TBR',
  'texas rangers': 'TEX', 'rangers': 'TEX', 'tex': 'TEX',
  'toronto blue jays': 'TOR', 'blue jays': 'TOR', 'tor': 'TOR',
  'washington nationals': 'WSN', 'nationals': 'WSN', 'wsn': 'WSN', 'was': 'WSN', 'wsh': 'WSN'
};

let mlbWeatherList = [];

// Weather icons: a cloud with rain (possible delay/rainout) or with lightning (likely)
const CNO_WEATHER_CLOUD = '<path d="M7 16.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a3.75 3.75 0 0 1-.5 7.5"/>';
const CNO_WEATHER_ICON_POSSIBLE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;" aria-hidden="true">${CNO_WEATHER_CLOUD}<path d="M9 19.5l.8-1.6M13 19.5l.8-1.6M11 22l.8-1.6"/></svg>`;
const CNO_WEATHER_ICON_LIKELY = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;" aria-hidden="true">${CNO_WEATHER_CLOUD}<path d="M12.5 13l-2 3.5h3l-2 3.5"/></svg>`;

function cleanGameString(str) {
  if (!str) return '';
  return str
    .replace(/\b(game\s*\d+|gm\s*\d+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeGameMatchKey(rawGameText) {
  const cleaned = cleanGameString(rawGameText);
  const parts = cleaned.split(/\s+@\s+|\s+at\s+|\s+vs\.?\s+|\s+v\.\s+/i);
  if (parts.length < 2) return null;

  const awayNorm = parts[0].toLowerCase().trim();
  const homeNorm = parts[1].toLowerCase().trim();

  const awayCode = MLB_TEAM_NORM_MAP[awayNorm] || awayNorm.toUpperCase();
  const homeCode = MLB_TEAM_NORM_MAP[homeNorm] || homeNorm.toUpperCase();

  return `${awayCode} AT ${homeCode}`;
}

function parseEasternDateTimeToUtcMs(dateStr, timeStr) {
  try {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');

    const edtDate = new Date(`${dateStr.trim()}T${hh}:${mm}:00-04:00`);
    return isNaN(edtDate.getTime()) ? null : edtDate.getTime();
  } catch (e) {
    return null;
  }
}

async function loadMLBWeatherData() {
  if (!userSettings.enableMlbWeather) return;

  const now = Date.now();
  const cachedTime = localStorage.getItem('cno_mlb_weather_cache_time');
  const cachedData = localStorage.getItem('cno_mlb_weather_cache_data');

  if (cachedTime && cachedData && cachedData !== '[]' && (now - parseInt(cachedTime, 10) < WEATHER_CACHE_TTL_MS)) {
    try {
      mlbWeatherList = JSON.parse(cachedData);
      if (Array.isArray(mlbWeatherList) && mlbWeatherList.length > 0) {
        return;
      }
    } catch (e) {
      console.warn("Failed to parse cached MLB weather data, fetching fresh.");
    }
  }

  try {
    const response = await fetch(MLB_WEATHER_CSV_URL);
    const csvText = await response.text();
    parseMLBWeatherCSV(csvText);

    localStorage.setItem('cno_mlb_weather_cache_time', now.toString());
    localStorage.setItem('cno_mlb_weather_cache_data', JSON.stringify(mlbWeatherList));
  } catch (err) {
    console.error("Failed to load MLB Weather CSV:", err);
  }
}

function parseMLBWeatherCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  mlbWeatherList = [];

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('date') && l.includes('time') && l.includes('game') && l.includes('status')) {
      headerIndex = i;
      break;
    }
  }

  const startRow = headerIndex !== -1 ? headerIndex + 1 : 1;

  for (let i = startRow; i < lines.length; i++) {
    const row = lines[i];
    if (!row || !row.trim()) continue;

    const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 4) continue;

    const dateVal = cols[0];
    const timeVal = cols[1];
    const rawGame = cols[2];
    const rawStatus = cols[3];

    if (!rawGame || !rawStatus) continue;

    let icon = '';
    if (rawStatus === 'Possible Delay/Rainout') {
      icon = '🌦️';
    } else if (rawStatus === 'Likely Delay/Rainout') {
      icon = '⛈️';
    } else {
      continue;
    }

    const normGameKey = normalizeGameMatchKey(rawGame);
    const timestampMs = parseEasternDateTimeToUtcMs(dateVal, timeVal);

    if (normGameKey) {
      mlbWeatherList.push({
        gameKey: normGameKey,
        status: rawStatus,
        icon: icon,
        timestampMs: timestampMs
      });
    }
  }
}

function processMLBWeatherBadges() {
  if (!userSettings.enableMlbWeather) {
    document.querySelectorAll('.cno-weather-badge').forEach(el => el.remove());
    document.querySelectorAll('[data-has-weather]').forEach(el => delete el.dataset.hasWeather);
    return;
  }

  if (mlbWeatherList.length === 0) return;

  const rows = document.querySelectorAll('tr:not(.footable-row-detail)');
  rows.forEach(row => {
    if (row.children.length < 6) return;
    if (cnoRowScanned(row, 'wx', mlbWeatherList)) return; // already checked against this weather data
    const cells = Array.from(row.children);

    let isMlb = false;
    let eventCell = null;
    let dateCell = null;

    cells.forEach((cell) => {
      const txt = cell.textContent.trim().toUpperCase();
      if (txt === 'MLB') isMlb = true;

      const dtEl = cell.querySelector('datetime');
      if (dtEl && dtEl.getAttribute('utc')) {
        dateCell = cell;
      }

      if (cell.querySelector('a[href*="game.aspx"]') || (cell.textContent.includes('@') && !cell.textContent.includes('Today at')) || cell.textContent.toLowerCase().includes(' at ')) {
        eventCell = cell;
      }
    });

    if (!isMlb || !eventCell || eventCell.dataset.hasWeather) return;
    row.dataset.cnoWeather = 'none'; // for the "Excl. Weather" filter

    const eventLink = eventCell.querySelector('a[href*="game.aspx"]') || eventCell.querySelector('a') || eventCell;
    const rawCnoEvent = eventLink.textContent.trim();
    const cnoMatchKey = normalizeGameMatchKey(rawCnoEvent);

    if (!cnoMatchKey) return;

    let cnoUtcMs = null;
    if (dateCell) {
      const dtEl = dateCell.querySelector('datetime');
      if (dtEl) {
        const utcAttr = dtEl.getAttribute('utc');
        if (utcAttr) {
          cnoUtcMs = new Date(utcAttr + " UTC").getTime();
        }
      }
    }

    const match = mlbWeatherList.find(w => {
      if (w.gameKey !== cnoMatchKey) return false;

      if (cnoUtcMs && w.timestampMs) {
        const diffMinutes = Math.abs(cnoUtcMs - w.timestampMs) / (1000 * 60);
        return diffMinutes <= 15;
      }

      return true;
    });

    if (match) {
      const likely = /likely/i.test(match.status);
      row.dataset.cnoWeather = likely ? 'likely' : 'possible';
      // Same line-icon style and blue as the extension's other icons; opens Rotowire's weather page
      const badge = document.createElement('a');
      badge.className = 'cno-weather-badge';
      badge.href = 'https://www.rotowire.com/baseball/weather.php';
      badge.target = '_blank';
      badge.rel = 'noopener';
      badge.title = `${match.status} per Rotowire (click for Rotowire's weather page)`;
      badge.innerHTML = likely ? CNO_WEATHER_ICON_LIKELY : CNO_WEATHER_ICON_POSSIBLE;
      badge.addEventListener('click', (e) => e.stopPropagation());
      if (eventLink.tagName === 'A') eventLink.insertAdjacentElement('afterend', badge);
      else eventCell.appendChild(badge);
    }

    eventCell.dataset.hasWeather = "true";
  });
}

// ====================================================
// MARKET SEARCH FILTER MODAL & GOOGLE SHEET CACHE
// ====================================================

const MARKET_SHEETS = {
  SPORT: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTS09M-p05Qs9ZTzM2VtV5S7g9i9HA3Fw7XqwH_Sv7h8xYwyoixibXoCxPx46Ojxex0l76o5oAEJuWe/pub?gid=0&single=true&output=csv",
  LEAGUE: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTS09M-p05Qs9ZTzM2VtV5S7g9i9HA3Fw7XqwH_Sv7h8xYwyoixibXoCxPx46Ojxex0l76o5oAEJuWe/pub?gid=461603785&single=true&output=csv"
};

const MARKET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let cachedSportMarkets = [];
let cachedLeagueMarkets = [];

function parseMarketDateString(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d.getTime();
}

async function loadMarketSheetsData() {
  const now = Date.now();
  const cachedTime = localStorage.getItem('cno_market_cache_time');
  const cachedSportData = localStorage.getItem('cno_market_sport_cache');
  const cachedLeagueData = localStorage.getItem('cno_market_league_cache');

  if (cachedTime && cachedSportData && cachedLeagueData && (now - parseInt(cachedTime, 10) < MARKET_CACHE_TTL_MS)) {
    try {
      cachedSportMarkets = JSON.parse(cachedSportData);
      cachedLeagueMarkets = JSON.parse(cachedLeagueData);
      return;
    } catch (e) {
      console.warn("Failed to parse cached market data, fetching fresh.");
    }
  }

  const cutoffMs = now - THIRTY_DAYS_MS;

  try {
    const [sportRes, leagueRes] = await Promise.all([
      fetch(MARKET_SHEETS.SPORT).then(r => r.text()),
      fetch(MARKET_SHEETS.LEAGUE).then(r => r.text())
    ]);

    cachedSportMarkets = parseMarketCSV(sportRes, cutoffMs);
    cachedLeagueMarkets = parseMarketCSV(leagueRes, cutoffMs);

    localStorage.setItem('cno_market_cache_time', now.toString());
    localStorage.setItem('cno_market_sport_cache', JSON.stringify(cachedSportMarkets));
    localStorage.setItem('cno_market_league_cache', JSON.stringify(cachedLeagueMarkets));
  } catch (err) {
    console.error("Failed to load Market Sheets CSVs:", err);
  }
}

function parseMarketCSV(csvText, cutoffMs) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row || !row.trim()) continue;

    const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 3) continue;

    const category = cols[0];
    const market = cols[1];
    const dateStr = cols[2];

    if (!category || !market || !dateStr) continue;

    const dateMs = parseMarketDateString(dateStr);
    if (dateMs && dateMs >= cutoffMs) {
      parsed.push({
        category: category.trim(),
        market: market.trim(),
        dateMs: dateMs
      });
    }
  }
  return parsed;
}

let modalSelectedMarkets = new Set();

function openMarketSearchModal(targetInput) {
  // Reset selections every time the search icon is clicked
  modalSelectedMarkets = new Set();

  loadMarketSheetsData().then(() => {
    const container = getFilterAccordionContainer() || document;
    const elSport = container.querySelector('[id$="DropDownListSport"]');
    const elLeague = container.querySelector('[id$="DropDownListLeague"]');

    const selectedSport = elSport ? elSport.value : '';
    const selectedLeague = elLeague ? elLeague.value : '';

    const isSportAll = !selectedSport || selectedSport.toLowerCase() === 'all' || selectedSport === '-1' || selectedSport === '0';
    const isLeagueAll = !selectedLeague || selectedLeague.toLowerCase() === 'all' || selectedLeague === '-1' || selectedLeague === '0';

    let activeList = [];
    let filterCategory = '';
    let categoryType = '';

    if (!isLeagueAll) {
      activeList = cachedLeagueMarkets;
      filterCategory = elLeague.options[elLeague.selectedIndex]?.text?.trim() || selectedLeague;
      categoryType = 'League';
    } else if (!isSportAll) {
      activeList = cachedSportMarkets;
      filterCategory = elSport.options[elSport.selectedIndex]?.text?.trim() || selectedSport;
      categoryType = 'Sport';
    } else {
      activeList = cachedSportMarkets;
      filterCategory = 'ALL';
      categoryType = 'All Sports';
    }

    let existingModal = document.getElementById('cno-market-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'cno-market-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(2px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #ffffff;
      border-radius: 8px;
      width: 540px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 14px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <div>
        <h3 style="margin:0; font-size:1.05rem; color:#0284c7; font-weight:700;">🔍 Market Name Search</h3>
        <span style="font-size:0.78rem; color:#64748b;">Filtering for ${categoryType}: <strong>${filterCategory}</strong></span>
      </div>
      <button id="cno-modal-close-x" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;">✕</button>
    `;

    const body = document.createElement('div');
    body.style.cssText = `
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
      flex: 1;
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Type to search markets...';
    searchInput.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.95rem;
      outline: none;
    `;

    const resultsBox = document.createElement('div');
    resultsBox.tabIndex = 0;
    resultsBox.style.cssText = `
      flex: 1;
      min-height: 180px;
      max-height: 320px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      gap: 4px;
      outline: none;
    `;

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 12px 16px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const previewInput = document.createElement('input');
    previewInput.type = 'text';
    previewInput.readOnly = true;
    previewInput.placeholder = 'Selected markets preview...';
    previewInput.style.cssText = `
      flex: 1;
      box-sizing: border-box;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.85rem;
      background: #f1f5f9;
      color: #334155;
      outline: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 6px 14px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      font-weight: 600;
      cursor: pointer;
    `;

    const insertBtn = document.createElement('button');
    insertBtn.textContent = 'Insert Markets';
    insertBtn.disabled = true;
    insertBtn.style.cssText = `
      padding: 6px 14px;
      border-radius: 4px;
      border: none;
      background: #94a3b8;
      color: #ffffff;
      font-weight: 600;
      cursor: not-allowed;
    `;

    function updateFooterPreview() {
      if (modalSelectedMarkets.size > 0) {
        const formattedList = Array.from(modalSelectedMarkets).map(m => `"${m}"`);
        previewInput.value = formattedList.join(' or ');
        insertBtn.disabled = false;
        insertBtn.style.background = '#0284c7';
        insertBtn.style.cursor = 'pointer';
      } else {
        previewInput.value = '';
        insertBtn.disabled = true;
        insertBtn.style.background = '#94a3b8';
        insertBtn.style.cursor = 'not-allowed';
      }
    }

    function renderResults(query = '') {
      resultsBox.innerHTML = '';

      let filtered = activeList;
      if (filterCategory !== 'ALL') {
        filtered = filtered.filter(item => item.category.toLowerCase() === filterCategory.toLowerCase());
      }

      const rawMarkets = filtered.map(item => item.market);
      const uniqueMarkets = Array.from(new Set(rawMarkets)).sort((a, b) => a.localeCompare(b));

      const q = query.trim().toLowerCase();
      const matchingMarkets = q ? uniqueMarkets.filter(m => m.toLowerCase().includes(q)) : uniqueMarkets;

      if (matchingMarkets.length === 0) {
        resultsBox.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:0.88rem; padding:20px 0;">No matching markets found</div>`;
        return;
      }

      matchingMarkets.forEach(m => {
        const label = document.createElement('label');
        label.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          color: #1e293b;
        `;
        label.addEventListener('mouseover', () => label.style.background = '#f1f5f9');
        label.addEventListener('mouseout', () => label.style.background = 'transparent');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = m;
        cb.checked = modalSelectedMarkets.has(m);

        cb.addEventListener('change', () => {
          if (cb.checked) {
            modalSelectedMarkets.add(m);
          } else {
            modalSelectedMarkets.delete(m);
          }
          updateFooterPreview();
        });

        label.appendChild(cb);
        label.appendChild(document.createTextNode(m));
        resultsBox.appendChild(label);
      });
    }

    searchInput.addEventListener('input', () => {
      renderResults(searchInput.value);
    });

    const closeModal = () => {
      modal.remove();
      if (targetInput) targetInput.focus();
    };

    cancelBtn.addEventListener('click', closeModal);
    header.querySelector('#cno-modal-close-x').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });

    insertBtn.addEventListener('click', () => {
      if (modalSelectedMarkets.size === 0) return;

      const formattedList = Array.from(modalSelectedMarkets).map(m => `"${m}"`);
      const joinedResult = formattedList.join(' or ');

      if (targetInput) {
        targetInput.value = joinedResult;
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      closeModal();
    });

    body.appendChild(searchInput);
    body.appendChild(resultsBox);

    footer.appendChild(previewInput);
    footer.appendChild(cancelBtn);
    footer.appendChild(insertBtn);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    modal.appendChild(content);

    document.body.appendChild(modal);
    renderResults('');
    updateFooterPreview();
    setTimeout(() => searchInput.focus(), 50);
  });
}
function processGameInjuryBadges() {
  const labelEl = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_LabelSportLeague');
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!labelEl || !table) return;

  // "Basketball - NBA" -> NBA (NBA, WNBA, NFL and MLB only, as on the tool pages)
  const parts = labelEl.textContent.split('-').map(x => x.trim().toUpperCase());
  const raw = parts[parts.length - 1] || '';
  let league = '';
  if (raw === 'WNBA') league = 'WNBA';
  else if (raw === 'NBA') league = 'NBA';
  else if (raw === 'NFL') league = 'NFL';
  else if (raw === 'MLB') league = 'MLB';
  if (!league) return;

  const ths = Array.from(table.querySelectorAll('thead th'));
  let nameIdx = ths.findIndex(th => th.textContent.trim().toLowerCase() === 'bet name');
  if (nameIdx === -1) nameIdx = 0;

  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    if (row.children.length < 2 || row.querySelector('.cno-injury-badge')) return;
    const cell = row.children[nameIdx];
    if (!cell) return;
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('[class^="cno-"], [class*=" cno-"]').forEach(el => el.remove());
    const name = normalizePlayerName(clone.textContent.trim());
    if (!name) return;
    const info = injuryDataMap.get(`${league}|${name}`);
    if (info) cell.insertAdjacentHTML('afterbegin', createInjuryBadge(info));
  });
}
