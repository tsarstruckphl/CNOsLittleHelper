// ====================================================
// EV BET SLIP (Positive EV page)
// Legs are added with the + next to a row's EV% or bet name (or "Add to EV Bet Slip" in the
// Calc popup) and kept in storage until cleared, so the slip survives refreshes and is shared by
// every open tab. One sportsbook per slip; two legs from the same game (event + start time) make
// it a same game parlay, where combined odds / EV / Devigger / Discord are off.
// EV is worked out here: product of each leg's fair win chance x the parlay's decimal odds - 1,
// with CNO's fair odds, or (Sharps, chosen each time) each leg's custom sharp FV where it has one.
// ====================================================

const CNO_SLIP_KEY = 'cno_ev_slip'; // { book, bookCode, legs: [...], boost, oddsEdit }
let cnoSlip = { book: '', bookCode: '', legs: [], boost: '', oddsEdit: null };
let cnoSlipLoaded = false;
const cnoSlipUi = { open: false, pinned: false, sharp: false, closeTimer: null, pulse: false };
const cnoSlipSharp = new Map(); // lineId -> { status: 'loading' | 'ok' | 'none', p, r }
let cnoSlipKelly = null;        // { mult, bankroll }
let cnoSlipRenderSig = '';

function cnoSlipOnPage() {
  return /\/site\/tools\/positive-ev\.aspx/i.test(window.location.pathname);
}

function cnoSlipLoad() {
  try {
    chrome.storage.local.get([CNO_SLIP_KEY], (d) => {
      const s = d && d[CNO_SLIP_KEY];
      if (s && Array.isArray(s.legs)) cnoSlip = Object.assign({ book: '', bookCode: '', legs: [], boost: '', oddsEdit: null }, s);
      cnoSlipLoaded = true;
      cnoSlipRender(true);
    });
    // Other tabs: same slip
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[CNO_SLIP_KEY]) return;
      const s = changes[CNO_SLIP_KEY].newValue;
      cnoSlip = s && Array.isArray(s.legs) ? Object.assign({ book: '', bookCode: '', legs: [], boost: '', oddsEdit: null }, s)
        : { book: '', bookCode: '', legs: [], boost: '', oddsEdit: null };
      cnoSlipRender(true);
    });
  } catch (e) { cnoSlipLoaded = true; }
}
if (cnoSlipOnPage()) cnoSlipLoad();

function cnoSlipSave() {
  try { chrome.storage.local.set({ [CNO_SLIP_KEY]: cnoSlip }); } catch (e) { /* ignore */ }
}

// ---------- reading a row ----------

function cnoSlipHeads(table) {
  return Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
}

function cnoSlipRowLineId(row, heads) {
  const i = heads.indexOf('sportsbook');
  const cell = i >= 0 ? row.children[i] : null;
  const a = cell && cell.querySelector('a[href*="line_id="]');
  const m = a && a.href.match(/line_id=(\d+)/);
  return m ? m[1] : '';
}

function cnoSlipLegFromRow(row) {
  const table = row && row.closest('table');
  if (!table) return null;
  const heads = cnoSlipHeads(table);
  const cellAt = (n) => { const i = heads.indexOf(n); return i >= 0 ? row.children[i] : null; };
  const text = (n) => { const c = cellAt(n); return c ? cnoCellText(c) : ''; };
  const lineId = cnoSlipRowLineId(row, heads);
  const odds = extractAmericanOdds(text('odds'));
  const fair = extractAmericanOdds(text('fair odds'));
  if (!lineId || !odds || !fair) return null;
  const dateCell = cellAt('date');
  const dt = dateCell && dateCell.querySelector('datetime');
  const eventCell = cellAt('event');
  const gameLink = eventCell && eventCell.querySelector('a[href*="game.aspx"]');
  const calc = row.querySelector('input[type="button"][value="Calc"]');
  let fvUrl = '';
  try { fvUrl = calc && typeof getCalcRowDeviggerUrl === 'function' ? (getCalcRowDeviggerUrl(calc) || '') : ''; } catch (e) { /* ignore */ }
  return {
    lineId,
    book: text('sportsbook'),
    sport: text('sport'),
    league: text('league'),
    event: text('event'),
    gameUrl: gameLink ? gameLink.href : '',
    dateUtc: dt ? (dt.getAttribute('utc') || '') : '',
    dateText: dt ? (dt.dataset.lhOrig || dt.textContent).replace(/\s+/g, ' ').trim() : text('date'),
    market: text('market'),
    betName: text('bet name'),
    odds,
    fair,
    prevOdds: '',
    fvUrl
  };
}

// ---------- dates ----------

// "11/24/2026 3:00:00 AM" (UTC) -> Date
function cnoSlipDate(leg) {
  const m = String(leg.dateUtc || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)$/i);
  if (!m) return null;
  let h = Number(m[4]) % 12;
  if (/pm/i.test(m[7])) h += 12;
  return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h, Number(m[5]), Number(m[6] || 0)));
}

// { day: "Today" / "Tomorrow" / "Wed Nov 26", time: "7:40 PM" }
function cnoSlipWhenParts(leg) {
  const d = cnoSlipDate(leg);
  if (!d) {
    const m = String(leg.dateText || '').match(/^(.*?)\s+at\s+(.+)$/i);
    return m ? { day: m[1].replace(/,/g, ''), time: m[2] } : { day: leg.dateText || '', time: '' };
  }
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date())) / 86400000);
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(/,/g, '');
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return { day, time };
}

function cnoSlipEventKey(leg) {
  return `${String(leg.event || '').toLowerCase()}|${leg.dateUtc || leg.dateText || ''}`;
}

function cnoSlipIsSgp() {
  const seen = new Set();
  for (const l of cnoSlip.legs) {
    const k = cnoSlipEventKey(l);
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

function cnoSlipBookDisplay(name) {
  return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// ---------- adding / removing ----------

function cnoSlipHas(lineId) {
  return cnoSlip.legs.some(l => l.lineId === lineId);
}

function cnoSlipRemove(lineId) {
  cnoSlip.legs = cnoSlip.legs.filter(l => l.lineId !== lineId);
  cnoSlip.oddsEdit = null;
  if (!cnoSlip.legs.length) { cnoSlip.book = ''; cnoSlip.bookCode = ''; }
  cnoSlipSharp.delete(lineId);
  cnoSlipSave();
  cnoSlipRender(true);
}

function cnoSlipClear() {
  cnoSlip.legs = [];
  cnoSlip.boost = '';
  cnoSlip.book = '';
  cnoSlip.bookCode = '';
  cnoSlip.oddsEdit = null;
  cnoSlipSharp.clear();
  cnoSlipSave();
  cnoSlipRender(true);
}

async function cnoSlipToggle(leg) {
  if (!leg) return;
  if (cnoSlipHas(leg.lineId)) { cnoSlipRemove(leg.lineId); return; }
  if (cnoSlip.legs.length && cnoSlip.book !== leg.book) {
    const ok = await cnoSlipConfirmSwitch(leg.book);
    if (!ok) return;
    cnoSlip.legs = [];
    cnoSlip.oddsEdit = null;
    cnoSlipSharp.clear();
  }
  if (!cnoSlip.legs.length) {
    cnoSlip.book = leg.book;
    let code = null;
    try { code = (await cnoBookCodeForName(leg.book)) || (await cnoBookCodeForName(cnoSlipBookDisplay(leg.book))); } catch (e) { /* ignore */ }
    cnoSlip.bookCode = code || cnoSlipBookDisplay(leg.book).split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
  }
  const wasSgp = cnoSlipIsSgp();
  cnoSlip.legs.push(leg);
  cnoSlip.oddsEdit = null;
  cnoSlipSave();
  if (!wasSgp && cnoSlipIsSgp()) cnoSlipToast('sgp', 'Same game parlay: the book prices these legs together, so combined odds and EV% are hidden and Copy for Discord is off. Open in Devigger still sends the legs.');
  if (cnoSlipUi.sharp) cnoSlipLoadSharp();
  cnoSlipUi.pulse = true;
  cnoSlipRender(true);
}

function cnoSlipConfirmSwitch(newBook) {
  return new Promise(resolve => {
    const n = cnoSlip.legs.length;
    const { modal, body, close } = createSavedFilterModal(`${cnoIconSvg('swap', 17)} Switch sportsbook`, 420, 1000003);
    const p = document.createElement('div');
    p.style.cssText = 'font-size:0.9rem; color:#334155; line-height:1.45;';
    p.textContent = `Your slip has ${n} ${cnoSlipBookDisplay(cnoSlip.book)} leg${n === 1 ? '' : 's'}. Clear it and start a new ${cnoSlipBookDisplay(newBook)} slip?`;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:flex-end; gap:8px;';
    const mk = (label, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = primary
        ? 'background:#0284c7; color:#fff; border:none; border-radius:6px; padding:7px 14px; font-weight:600; cursor:pointer;'
        : 'background:#fff; color:#334155; border:1px solid #cbd5e1; border-radius:6px; padding:7px 14px; cursor:pointer;';
      return b;
    };
    const cancel = mk('Cancel', false);
    const go = mk('Start new slip', true);
    let done = false;
    const finish = (v) => { if (done) return; done = true; close(); resolve(v); };
    cancel.addEventListener('click', () => finish(false));
    go.addEventListener('click', () => finish(true));
    new MutationObserver((m, o) => { if (!modal.isConnected) { o.disconnect(); finish(false); } }).observe(document.body, { childList: true });
    row.appendChild(cancel);
    row.appendChild(go);
    body.appendChild(p);
    body.appendChild(row);
    if (!modal.isConnected) document.body.appendChild(modal);
    go.focus();
  });
}

// Same game parlay: what the Devigger link can and can't do
function cnoSlipConfirmSgpDevig() {
  return new Promise(resolve => {
    const { modal, body, close } = createSavedFilterModal(`${cnoIconSvg('devig', 17)} Same game parlay`, 460, 1000003);
    const p = document.createElement('div');
    p.style.cssText = 'font-size:0.88rem; color:#334155; line-height:1.5; display:flex; flex-direction:column; gap:8px;';
    [
      'Same game parlays take extra work to devig: the legs are correlated, so multiplying their fair odds overstates or understates the true chance.',
      "The book's parlay odds can't be filled in, so Final Odds will be left blank for you to enter.",
      "Each leg goes in with CNO's fair odds. Using them (or sharp odds) for the parlay needs a correlation adjustment or another method to get a fair value."
    ].forEach(t => { const d = document.createElement('div'); d.textContent = t; p.appendChild(d); });
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:flex-end; gap:8px;';
    const mk = (label, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = primary
        ? 'background:#0284c7; color:#fff; border:none; border-radius:6px; padding:7px 14px; font-weight:600; cursor:pointer;'
        : 'background:#fff; color:#334155; border:1px solid #cbd5e1; border-radius:6px; padding:7px 14px; cursor:pointer;';
      return b;
    };
    const cancel = mk('Cancel', false);
    const go = mk('Open in Devigger', true);
    let done = false;
    const finish = (v) => { if (done) return; done = true; close(); resolve(v); };
    cancel.addEventListener('click', () => finish(false));
    go.addEventListener('click', () => finish(true));
    new MutationObserver((m, o) => { if (!modal.isConnected) { o.disconnect(); finish(false); } }).observe(document.body, { childList: true });
    row.appendChild(cancel);
    row.appendChild(go);
    body.appendChild(p);
    body.appendChild(row);
    if (!modal.isConnected) document.body.appendChild(modal);
    go.focus();
  });
}

// Ctrl+Alt+S (Ctrl+Cmd+S on a Mac): clear the slip
document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyS' || e.repeat || !cnoSlipOnPage()) return;
  const combo = typeof cnoIsMac === 'function' && cnoIsMac()
    ? (e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey)
    : (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey);
  if (!combo) return;
  e.preventDefault();
  e.stopPropagation();
  if (cnoSlip.legs.length || cnoSlip.boost) cnoSlipClear();
}, true);

function cnoSlipToast(kind, message) {
  if (message === undefined) { message = kind; kind = ''; }
  const old = document.getElementById('cno-slip-toast');
  if (old) old.remove();
  const box = document.querySelector('#cno-slip-dock .cno-slip-box');
  const t = document.createElement('div');
  t.id = 'cno-slip-toast';
  t.dataset.kind = kind;
  t.textContent = message;
  (box || document.body).appendChild(t);
  setTimeout(() => { if (t.isConnected) t.remove(); }, 7000);
}

// ---------- the + / checkmark on each row ----------

const CNO_SLIP_PLUS_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
const CNO_SLIP_CHECK_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>';
const CNO_SLIP_REMOVE_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>';
const CNO_SLIP_QR_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M20 14v2M14 20h6M18 18v2"/></svg>';
const CNO_SLIP_OPEN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const CNO_SLIP_MIN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>';
const CNO_SLIP_REFRESH_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>';

function cnoSlipMakeAdd(cls, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `cno-slip-add ${cls}`;
  b.title = title;
  b.innerHTML = CNO_SLIP_PLUS_SVG;
  b.addEventListener('mousedown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const row = b.closest('tr');
    if (!row) return;
    const heads = cnoSlipHeads(row.closest('table'));
    const id = cnoSlipRowLineId(row, heads);
    if (id && cnoSlipHas(id)) { cnoSlipRemove(id); return; }
    const leg = cnoSlipLegFromRow(row);
    if (!leg) { cnoSlipToast("Couldn't read this bet's odds or link."); return; }
    cnoSlipToggle(leg);
  });
  return b;
}

const cnoSlipRowSig = new WeakMap(); // row -> "odds|fair" last seen (selected rows only)

function processEvSlipRows(table) {
  const heads = cnoSlipHeads(table);
  if (!heads.length || !/ev%$/.test(heads[0])) return;
  const nameIdx = heads.indexOf('bet name');
  const oddsIdx = heads.indexOf('odds');
  const fairIdx = heads.indexOf('fair odds');
  const selected = new Map(cnoSlip.legs.map(l => [l.lineId, l]));
  let changed = false;
  table.querySelectorAll('tbody > tr:not(.footable-row-detail)').forEach(row => {
    if (row.children.length < 3) return;
    const id = cnoSlipRowLineId(row, heads);
    if (!id) return;
    const leg = selected.get(id);
    const on = !!leg;

    const evCell = row.children[0];
    let ev = evCell.querySelector(':scope > .cno-slip-ev');
    if (!ev) { ev = cnoSlipMakeAdd('cno-slip-ev', 'Add to EV Bet Slip'); evCell.insertBefore(ev, evCell.firstChild); }
    const nameCell = nameIdx >= 0 ? row.children[nameIdx] : null;
    let nm = nameCell && nameCell.querySelector(':scope > .cno-slip-name');
    if (nameCell && !nm) { nm = cnoSlipMakeAdd('cno-slip-name', 'Add to EV Bet Slip'); nameCell.appendChild(nm); }

    if (row.dataset.cnoSlip !== (on ? '1' : '0')) {
      row.dataset.cnoSlip = on ? '1' : '0';
      ev.classList.toggle('cno-slip-on', on);
      ev.innerHTML = on ? CNO_SLIP_CHECK_SVG : CNO_SLIP_PLUS_SVG;
      ev.title = on ? 'In your EV Bet Slip (click to remove)' : 'Add to EV Bet Slip';
      if (nm) nm.hidden = on;
      row.classList.toggle('cno-slip-row-on', on);
    }

    // A leg's row in the current results: keep its odds and fair odds up to date (quietly)
    if (on && oddsIdx >= 0 && fairIdx >= 0) {
      const odds = extractAmericanOdds(cnoCellText(row.children[oddsIdx]));
      const fair = extractAmericanOdds(cnoCellText(row.children[fairIdx]));
      const sig = `${odds}|${fair}`;
      if (cnoSlipRowSig.get(row) !== sig) {
        cnoSlipRowSig.set(row, sig);
        if (odds && fair && (odds !== leg.odds || fair !== leg.fair)) {
          if (odds !== leg.odds) leg.prevOdds = leg.odds;
          leg.odds = odds;
          leg.fair = fair;
          cnoSlipSharp.delete(id); // its sharp FV is redone if Sharps is on
          changed = true;
        }
      }
    }
  });
  if (changed) {
    cnoSlipSave();
    if (cnoSlipUi.sharp) cnoSlipLoadSharp();
    cnoSlipRender(true);
  }
}

// ---------- Calc popup: "Add to EV Bet Slip" ----------

function cnoSyncCalcSlipBtn(container) {
  if (!cnoSlipOnPage() || !document.getElementById(CNO_CALC_ODDS_INPUT_ID)) return;
  const table = container.parentNode && container.parentNode.querySelector(':scope > table');
  const btn = cnoLastCalcBtn && cnoLastCalcBtn.isConnected ? cnoLastCalcBtn : null;
  const row = btn && btn.closest('tr');
  let wrap = container.parentNode ? container.parentNode.querySelector(':scope > .cno-calc-slip') : null;
  if (!row || !table) { if (wrap) wrap.remove(); return; }
  if (!wrap) {
    wrap = cnoSlipEl('div', 'cno-calc-slip');
    const a = document.createElement('a');
    a.className = 'cno-devigger-btn cno-calc-slip-btn';
    a.href = '#';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = cnoLastCalcBtn && cnoLastCalcBtn.isConnected ? cnoLastCalcBtn.closest('tr') : null;
      if (!r) return;
      const id = cnoSlipRowLineId(r, cnoSlipHeads(r.closest('table')));
      if (id && cnoSlipHas(id)) { cnoSlipRemove(id); cnoSyncCalcSlipBtn(container); return; }
      const leg = cnoSlipLegFromRow(r);
      if (!leg) { cnoSlipToast("Couldn't read this bet's odds or link."); return; }
      // The odds typed in the popup, if changed
      const input = document.getElementById(CNO_CALC_ODDS_INPUT_ID);
      const typed = input ? extractAmericanOdds(input.value.trim()) || (/^\d{3,}$/.test(input.value.trim()) ? `+${input.value.trim()}` : '') : '';
      if (typed) leg.odds = typed;
      cnoSlipToggle(leg).then(() => cnoSyncCalcSlipBtn(container));
    });
    wrap.appendChild(a);
  }
  // Right under the calculator, so Copy for Discord follows it
  if (table.nextElementSibling !== wrap) table.parentNode.insertBefore(wrap, table.nextSibling);
  const a = wrap.querySelector('a');
  const id = cnoSlipRowLineId(row, cnoSlipHeads(row.closest('table')));
  const on = !!id && cnoSlipHas(id);
  const key = on ? 'on' : 'off';
  if (a.dataset.state !== key) {
    a.dataset.state = key;
    a.innerHTML = `${on ? CNO_SLIP_CHECK_SVG : CNO_SLIP_PLUS_SVG}<span>${on ? 'In EV Bet Slip' : 'Add to EV Bet Slip'}</span>`;
    a.title = on ? 'Remove this bet from your EV Bet Slip' : 'Add this bet to your EV Bet Slip';
  }
}

// ---------- the math ----------

function cnoSlipDec(american) {
  const n = Number(String(american || '').replace('+', ''));
  if (!isFinite(n) || Math.abs(n) < 100) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function cnoSlipAmerican(dec) {
  if (!(dec > 1)) return '—';
  const a = dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
  return `${a > 0 ? '+' : ''}${a}`;
}

function cnoSlipBoostPct() {
  const v = parseFloat(String(cnoSlip.boost || '').replace(/[^0-9.]/g, ''));
  return v > 0 ? v : 0;
}

// Each leg's fair win chance (and where it came from), then the parlay
function cnoSlipCalc() {
  const legs = cnoSlip.legs.map(l => {
    const d = cnoSlipDec(l.odds);
    const cnoP = cnoSlipDec(l.fair) ? 1 / cnoSlipDec(l.fair) : NaN;
    const sh = cnoSlipUi.sharp ? cnoSlipSharp.get(l.lineId) : null;
    const useSharp = !!(sh && sh.status === 'ok' && isFinite(sh.p));
    const p = useSharp ? sh.p : cnoP;
    return { leg: l, d, p, src: useSharp ? 'sharp' : 'cno', sharp: sh, ev: d && isFinite(p) ? p * d - 1 : NaN };
  });
  const product = legs.reduce((t, x) => t * (x.d || NaN), legs.length ? 1 : NaN);
  const dec = product;
  const boost = cnoSlipBoostPct();
  const bd = dec > 1 ? 1 + (dec - 1) * (1 + boost / 100) : NaN;
  const P = legs.reduce((t, x) => t * x.p, legs.length ? 1 : NaN);
  const ev = P * bd - 1;
  return {
    legs, product, dec, bd, boost, P, ev,
    fb: P * (bd - 1),
    kellyFull: ev > 0 ? ev / (bd - 1) * 100 : 0, // % of bankroll = units
    sharpCount: legs.filter(x => x.src === 'sharp').length,
    loading: legs.some(x => x.sharp && x.sharp.status === 'loading'),
    sgp: cnoSlipIsSgp()
  };
}

// ---------- Sharps ----------

function cnoSlipSharpAvailable() {
  return !!(userSettings.customSharpDevig && typeof cnoSharpConfig !== 'undefined' && cnoSharpConfig);
}

function cnoSlipSharpInfo(leg) {
  if (!cnoSlipSharpAvailable() || !leg.gameUrl || !leg.fvUrl) return null;
  const set = cnoFindSharpSet(cnoSharpConfig, leg.sport, leg.league, leg.market);
  if (!set) return null;
  return {
    sport: leg.sport, league: leg.league, set, fvUrl: leg.fvUrl, gameUrl: leg.gameUrl,
    devigMethod: cnoSharpConfig.devigMethod || 'worstcase',
    event: leg.event, market: leg.market, betName: leg.betName, bookName: leg.book,
    tableOdds: leg.odds, cnoFair: leg.fair, dateText: ''
  };
}

function cnoSlipLoadSharp(force) {
  if (force) cnoSlipSharp.clear();
  cnoSlip.legs.forEach(leg => {
    if (cnoSlipSharp.has(leg.lineId)) return;
    const info = cnoSlipSharpInfo(leg);
    if (!info) { cnoSlipSharp.set(leg.lineId, { status: 'none' }); return; }
    const entry = { status: 'loading' };
    cnoSlipSharp.set(leg.lineId, entry);
    cnoComputeSharp(info)
      .then(r => (r.usable ? cnoSharpFinals(r, 0) : r))
      .then(r => {
        if (cnoSlipSharp.get(leg.lineId) !== entry) return;
        if (r.usable && isFinite(r.fair) && r.fair > 0 && r.fair < 1) Object.assign(entry, { status: 'ok', p: r.fair, r });
        else Object.assign(entry, { status: 'none', r });
      })
      .catch(() => { if (cnoSlipSharp.get(leg.lineId) === entry) entry.status = 'none'; })
      .finally(() => cnoSlipRender(true));
  });
  cnoSlipRender(true);
}

function cnoSlipKellyLoad() {
  if (cnoSlipKelly || typeof getSiteDefaults !== 'function') return;
  cnoSlipKelly = { mult: 0.25, bankroll: null };
  try {
    getSiteDefaults((v) => {
      const mult = v ? cnoSharpNumber(v.TextBoxKellyMultiplier) : null;
      const bank = v ? cnoSharpNumber(v.TextBoxKellyBankroll) : null;
      cnoSlipKelly = { mult: mult > 0 ? mult : 0.25, bankroll: bank > 0 ? bank : null };
      cnoSlipRender(true);
    });
  } catch (e) { /* ignore */ }
}

// ---------- links and copies ----------

function cnoSlipBetUrl() {
  return `https://crazyninjaodds.com/site/redirect/deeplink.aspx?line_id=${cnoSlip.legs.map(l => l.lineId).join(',')}`;
}

function cnoSlipShownOdds(c) {
  return cnoSlipAmerican(c.product);
}

function cnoSlipDeviggerUrl(c) {
  // Same game parlay: CNO's fair odds for each leg only (no sharps), and nothing in Final Odds
  const sgp = c.sgp;
  const fairs = c.legs.map(x => (!sgp && x.src === 'sharp' ? cnoExactAmerican(x.p) : x.leg.fair));
  const desc = c.legs.map(x => {
    const l = x.leg;
    const s = cnoBuildDeviggerLegOdds('x', l.event, l.market, l.betName, [l.sport, l.league].filter(Boolean).join(' - '));
    return (s.split('//')[1] || '').trim();
  }).filter(Boolean).join(' | ') + (!sgp && c.sharpCount ? ' | Sharps' : '');
  const legOdds = `${fairs.join(',')}     // ${desc}`.replace(/%/g, '_PCT_');
  const p = new URLSearchParams({ autofill: '1', LegOdds: legOdds });
  if (!sgp) {
    // Each leg's odds, comma separated (the Devigger builds the parlay from them)
    p.set('FinalOdds', c.legs.map(x => cnoShareSignedOdds(x.leg.odds)).join(','));
    if (c.boost > 0) { p.set('Boost_Bool', '1'); p.set('Boost_Text', String(c.boost)); p.set('Boost_Type', '0'); }
  }
  return `http://crazyninjamike.com/Public/sportsbooks/sportsbook_devigger.aspx?${p.toString()}`;
}

function cnoSlipShareText(c) {
  const pct1 = (x) => `${(x * 100).toFixed(1)}%`;
  const sign1 = (x) => `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  const n = cnoSlip.legs.length;
  const odds = cnoSlipShownOdds(c);
  const boosted = c.boost > 0 ? cnoSlipAmerican(c.bd) : '';
  const lines = cnoShareHeaderLines({
    book: cnoSlip.book, betName: `${n}-leg parlay`, market: '', odds, boosted, boostPct: c.boost,
    url: cnoSlipBetUrl(), event: '', dateText: ''
  });
  lines.push('', `Odds: ${boosted || odds}; **EV: ${pct1(c.ev)}**`, '');

  const abbr = cnoDevigMethodAbbrev();
  const sharpRs = c.legs.filter(x => x.src === 'sharp').map(x => x.sharp.r);
  let head = `CNO${abbr ? ' ' + abbr : ''}`;
  if (c.sharpCount) {
    const kinds = new Set(sharpRs.map(r => `${r.mode}|${r.method}`));
    if (kinds.size === 1) {
      const r = sharpRs[0];
      head = `Sharps, ${r.mode === 'weighted' ? 'weighted' : 'average'}, ${(CNO_DEVIG_METHOD_NAMES[r.method] || r.method).toLowerCase()}`;
    } else head = 'Sharps';
  }
  lines.push(`**Legs** (${head}):`);
  const names = c.legs.map(x => {
    const l = x.leg;
    const bet = String(l.betName || '').replace(/\bOver\s+(?=[+-]?\d)/gi, 'o').replace(/\bUnder\s+(?=[+-]?\d)/gi, 'u');
    return cnoShareBetTitle(bet, cnoAbbreviateMarket(l.market));
  });
  const nameW = Math.max(...names.map(s => s.length));
  const oddsW = Math.max(...c.legs.map(x => cnoShareSignedOdds(x.leg.odds).length));
  c.legs.forEach((x, i) => {
    const l = x.leg;
    const fv = cnoSlipAmerican(1 / x.p);
    const w = cnoSlipWhenParts(l);
    const when = cnoShareWhen(`${w.day} at ${w.time}`);
    const ev = cnoAbbreviateEvent(l.event, [l.sport, l.league].filter(Boolean).join(' - '));
    const tag = c.sharpCount && x.src !== 'sharp' ? '  (CNO)' : '';
    lines.push(`\`${names[i].padEnd(nameW)}  ${cnoShareSignedOdds(l.odds).padStart(oddsW)}  FV ${fv}  EV ${sign1(x.ev)}\`  ${[ev, when].filter(Boolean).join(' · ')}${tag}`);
    if (x.src === 'sharp' && x.sharp.r) {
      const r = x.sharp.r;
      const books = r.books.filter(b => b.usable).map(b => `${b.code} ${cnoProbabilityToAmerican(b.fair) || '?'} ${Math.round(b.share * 1000) / 10}%`).join(', ');
      const vig = isFinite(r.juice) ? ` · vig ${(r.juice * 100).toFixed(1)}%` : '';
      if (books) lines.push(`-# ${books}${vig}`);
    }
  });
  lines.push('');
  const fairAm = cnoSlipAmerican(1 / c.P);
  const parts = c.sharpCount
    ? [`**Sharps** FV: ${fairAm} (${pct1(c.P)})`, `CNO${abbr ? ' ' + abbr : ''} FV: ${cnoSlipAmerican(1 / c.legs.reduce((t, x) => t / cnoSlipDec(x.leg.fair), 1))}`]
    : [`**CNO${abbr ? ' ' + abbr : ''}** FV: ${fairAm} (${pct1(c.P)})`];
  parts.push(cnoShareKelly(c.kellyFull, pct1(c.fb)));
  lines.push(parts.join('; '));
  return lines.concat(cnoShareFooterLines(cnoSlipDeviggerUrl(c))).join('\n');
}

// ---------- the dock (closed pill + open panel) ----------

function cnoSlipEnsureDock(table) {
  let dock = document.getElementById('cno-slip-dock');
  if (!dock) {
    dock = document.createElement('div');
    dock.id = 'cno-slip-dock';
    dock.innerHTML = '<div class="cno-slip-box"><div class="cno-slip-bar" role="button" tabindex="0"></div>'
      + '<div class="cno-slip-body"><div class="cno-slip-body-in"></div></div></div>';
    const box = dock.querySelector('.cno-slip-box');
    const bar = dock.querySelector('.cno-slip-bar');
    bar.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      // Click the bar to open the slip; click its title line again to minimize it
      if (cnoSlipUi.open) { cnoSlipClose(); return; }
      cnoSlipOpen();
    });
    bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (cnoSlipUi.open) cnoSlipClose(); else cnoSlipOpen(); } });
    cnoSlipRenderSig = ''; // a new dock (e.g. after Update) needs drawing
  }
  // Just before CNO's results panel, so it's level with the line above the table (the injury /
  // rows hidden line) and an Update, which redraws that panel, doesn't remove it
  const up = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelGridView');
  const before = up && up.contains(table) ? up : table;
  if (dock.nextElementSibling !== before) before.parentNode.insertBefore(dock, before);
  return dock;
}

// Click elsewhere closes it (the QR / switch modals and the mini sharp popup don't count)
document.addEventListener('mousedown', (e) => {
  if (!cnoSlipUi.open) return;
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('#cno-slip-dock, #cno-slip-mini, #cno-qr-overlay')) return;
  if (t.closest('[style*="z-index: 1000003"]')) return;
  cnoSlipClose();
}, true);

function cnoSlipOpen() {
  if (cnoSlipUi.open) return;
  cnoSlipUi.open = true;
  if (cnoSlipUi.sharp) cnoSlipLoadSharp();
  cnoSlipKellyLoad();
  cnoSlipRender(true);
}

function cnoSlipClose() {
  cnoSlipUi.open = false;
  cnoSlipUi.pinned = false;
  cnoSlipMiniHide();
  cnoSlipRender(true);
}

function cnoSlipEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function cnoSlipOddsHtml(odds, boosted) {
  return boosted ? `<span class="cno-slip-was">${odds}</span><span class="cno-slip-boosted">${boosted}</span>` : `<span>${odds}</span>`;
}

function cnoSlipRender(force) {
  const dock = document.getElementById('cno-slip-dock');
  if (!dock || !cnoSlipLoaded) return;
  const c = cnoSlipCalc();
  const sig = JSON.stringify([cnoSlip, !!userSettings.hideEvSlipWhenEmpty, cnoSlipUi.open, cnoSlipUi.sharp, cnoSharpShowBetSize, cnoSlipKelly,
    Array.from(cnoSlipSharp.entries()).map(([k, v]) => [k, v.status, v.p])]);
  if (!force && sig === cnoSlipRenderSig) return;
  cnoSlipRenderSig = sig;

  const n = cnoSlip.legs.length;
  if (!c.sgp) { const st = document.querySelector('#cno-slip-toast[data-kind="sgp"]'); if (st) st.remove(); }
  dock.hidden = !n && !!userSettings.hideEvSlipWhenEmpty;
  const box = dock.querySelector('.cno-slip-box');
  const bar = dock.querySelector('.cno-slip-bar');
  box.classList.toggle('cno-open', cnoSlipUi.open);
  dock.classList.toggle('cno-slip-is-open', cnoSlipUi.open);

  // The bar: closed = book, legs, odds, EV; open = the slip's title line
  bar.textContent = '';
  bar.appendChild(cnoSlipEl('span', 'cno-slip-num', String(n)));
  if (cnoSlipUi.open) {
    bar.appendChild(cnoSlipEl('span', 'cno-slip-ttl-text', 'EV Bet Slip'));
    if (n) bar.appendChild(cnoSlipEl('span', 'cno-slip-ttl-book', cnoSlipBookDisplay(cnoSlip.book)));
    const tools = cnoSlipEl('span', 'cno-slip-head-tools');
    if (n) {
      const clr = cnoSlipEl('button', 'cno-slip-link-btn', 'Clear all');
      clr.type = 'button';
      clr.title = `Clear the slip (${cnoSwapShortcutLabel('S')})`;
      clr.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cnoSlipClear(); });
      tools.appendChild(clr);
    }
    const min = cnoSlipEl('button', 'cno-slip-icon-btn');
    min.type = 'button';
    min.title = 'Minimize';
    min.innerHTML = CNO_SLIP_MIN_SVG;
    min.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cnoSlipClose(); });
    tools.appendChild(min);
    bar.appendChild(tools);
  } else if (!n) {
    bar.appendChild(cnoSlipEl('span', 'cno-slip-ttl-text', 'EV Bet Slip'));
    bar.appendChild(cnoSlipEl('span', 'cno-slip-bar-hint', 'Add bets with +'));
  } else {
    bar.appendChild(cnoSlipEl('span', 'cno-slip-ttl-text', 'EV Bet Slip'));
    bar.appendChild(cnoSlipEl('span', 'cno-slip-pill-book', cnoSlip.bookCode));
    const right = cnoSlipEl('span', 'cno-slip-bar-right');
    if (c.sgp) right.appendChild(cnoSlipEl('span', 'cno-slip-sgp', 'SGP'));
    else {
      const odds = cnoSlipShownOdds(c);
      const boosted = c.boost > 0 ? cnoSlipAmerican(c.bd) : '';
      const o = cnoSlipEl('span', 'cno-slip-pill-odds');
      o.innerHTML = cnoSlipOddsHtml(odds, boosted);
      right.appendChild(o);
      right.appendChild(cnoSlipEl('span', 'cno-slip-pill-ev ' + (c.ev > 0 ? 'cno-pos' : (c.ev < 0 ? 'cno-neg' : '')), isFinite(c.ev) ? cnoFmtPct(c.ev, true) : '—'));
    }
    bar.appendChild(right);
    bar.appendChild(cnoSlipQuickClear(n));
  }
  bar.title = cnoSlipUi.open ? '' : (n ? 'EV Bet Slip' : "EV Bet Slip: add bets with the + next to a bet's EV% or name");
  if (cnoSlipUi.pulse) {
    cnoSlipUi.pulse = false;
    box.classList.remove('cno-slip-pulse');
    void box.offsetWidth;
    box.classList.add('cno-slip-pulse');
  }

  const panel = dock.querySelector('.cno-slip-body-in');
  if (!cnoSlipUi.open) { panel.textContent = ''; return; }
  const legsOld = panel.querySelector('.cno-slip-legs');
  const keepScroll = legsOld ? legsOld.scrollTop : 0;
  const focused = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.dataset.slipField : '';
  const caret = focused && document.activeElement.selectionStart;
  panel.textContent = '';
  cnoSlipBuildPanel(panel, c);
  const legsEl = panel.querySelector('.cno-slip-legs');
  if (legsEl) legsEl.scrollTop = keepScroll;
  if (focused) {
    const f = panel.querySelector(`[data-slip-field="${focused}"]`);
    if (f) { f.focus(); try { f.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } }
  }
}

// Closed bar: a faint ✕ at the far right (on hover). Click once for "Clear N legs?", again to clear;
// moving away or 3 seconds puts it back.
function cnoSlipQuickClear(n) {
  const b = cnoSlipEl('button', 'cno-slip-quick-clear', '✕');
  b.type = 'button';
  const tip = `Clear the slip (${cnoSwapShortcutLabel('S')})`;
  b.title = tip;
  let timer = null;
  const reset = () => { clearTimeout(timer); b.classList.remove('cno-confirm'); b.textContent = '✕'; b.title = tip; };
  b.addEventListener('mousedown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (b.classList.contains('cno-confirm')) { reset(); cnoSlipClear(); return; }
    b.classList.add('cno-confirm');
    b.textContent = `Clear ${n} leg${n === 1 ? '' : 's'}?`;
    b.title = 'Click again to clear the slip';
    clearTimeout(timer);
    timer = setTimeout(reset, 3000);
  });
  b.addEventListener('mouseleave', reset);
  return b;
}

function cnoSlipBoostField() {
  const bl = cnoSlipEl('label', 'cno-slip-boost');
  bl.appendChild(document.createTextNode('Profit boost '));
  const field = cnoSlipEl('span', 'cno-calc-boost-field');
  const bi = document.createElement('input');
  bi.type = 'number';
  bi.min = '0';
  bi.step = '1';
  bi.placeholder = '0';
  bi.dataset.slipField = 'boost';
  bi.value = cnoSlip.boost || '';
  let bt = null;
  bi.addEventListener('input', () => {
    clearTimeout(bt);
    bt = setTimeout(() => { cnoSlip.boost = bi.value.trim(); cnoSlipSave(); cnoSlipRender(true); }, 400);
  });
  const bx = cnoSlipEl('button', 'cno-calc-boost-clear', '✕');
  bx.type = 'button';
  bx.title = 'Clear the boost';
  bx.hidden = !cnoSlip.boost;
  bx.addEventListener('mousedown', (e) => e.preventDefault());
  bx.addEventListener('click', (e) => { e.preventDefault(); cnoSlip.boost = ''; cnoSlipSave(); cnoSlipRender(true); });
  field.appendChild(bi);
  field.appendChild(bx);
  bl.appendChild(field);
  bl.appendChild(document.createTextNode(' %'));
  return bl;
}

function cnoSlipBuildPanel(panel, c) {
  const n = cnoSlip.legs.length;
  if (!n) {
    panel.appendChild(cnoSlipEl('div', 'cno-slip-empty', "Add bets with the + next to a bet's EV% or name, or from its Calc popup."));
    return;
  }

  // The parlay's odds (editable) and the boosted odds
  const top = cnoSlipEl('div', 'cno-slip-parlay');
  const left = cnoSlipEl('span', 'cno-slip-parlay-left');
  left.appendChild(cnoSlipEl('span', 'cno-slip-parlay-ttl', c.sgp ? `${n} pick SGP` : `${n} pick parlay`));
  left.appendChild(cnoSlipBoostField());
  top.appendChild(left);
  if (!c.sgp) {
    const right = cnoSlipEl('span', 'cno-slip-parlay-odds');
    right.innerHTML = cnoSlipOddsHtml(cnoSlipShownOdds(c), c.boost > 0 ? cnoSlipAmerican(c.bd) : '');
    top.appendChild(right);
  }
  panel.appendChild(top);
  // Tiles: EV%, QK, FBC, Fair odds
  if (c.sgp) {
    panel.appendChild(cnoSlipEl('div', 'cno-slip-sgp-note', 'Same game parlay: the book prices these legs together, so combined odds and EV% aren\'t shown.'));
  } else {
    const tiles = cnoSlipEl('div', 'cno-sharp-tiles cno-slip-tiles');
    const tile = (label, value, cls, sub, tileCls) => {
      const tl = cnoSlipEl('div', 'cno-sharp-tile' + (tileCls ? ' ' + tileCls : ''));
      tl.appendChild(cnoSlipEl('div', 'cno-sharp-tile-label', label));
      tl.appendChild(cnoSlipEl('div', 'cno-sharp-tile-value' + (cls ? ' ' + cls : ''), value));
      if (sub !== undefined) tl.appendChild(cnoSlipEl('div', 'cno-sharp-tile-sub', sub));
      tiles.appendChild(tl);
      return tl;
    };
    const evLabel = c.sharpCount ? (c.sharpCount === n ? 'Sharp EV%' : `Sharp EV% (${c.sharpCount} of ${n})`) : 'EV%';
    const evTile = tile(evLabel, isFinite(c.ev) ? cnoFmtPct(c.ev, true) : '—', c.ev > 0 ? 'cno-pos' : (c.ev < 0 ? 'cno-neg' : ''), c.loading ? 'Loading sharps…' : undefined, 'cno-sharp-tile-main');
    if (c.boost > 0) evTile.querySelector('.cno-sharp-tile-label').appendChild(cnoSlipEl('div', 'cno-sharp-tile-boost', `(${c.boost}% boost)`));
    const k = cnoSlipKelly || { mult: 0.25, bankroll: null };
    const units = c.kellyFull * k.mult;
    const kTile = tile(cnoKellyLabel(k.mult), units > 0 ? `${units.toFixed(units < 0.1 ? 3 : 2)}u` : '—', '', units > 0 ? undefined : 'No bet');
    if (units > 0 && k.bankroll > 0) {
      const sub = cnoSlipEl('div', 'cno-sharp-tile-sub cno-sharp-betsize');
      const amt = cnoSlipEl('span', 'cno-sharp-betsize-amt', cnoSharpShowBetSize ? cnoFmtMoney(units / 100 * k.bankroll).replace(/\.\d+$/, '') : '$—');
      const eye = cnoSlipEl('button', 'cno-sharp-eye');
      eye.type = 'button';
      eye.innerHTML = cnoSharpShowBetSize ? CNO_SHARP_ICON_EYE : CNO_SHARP_ICON_EYE_OFF;
      eye.title = cnoSharpShowBetSize ? 'Hide bet size' : 'Show bet size';
      eye.addEventListener('click', (e) => {
        e.preventDefault();
        cnoSharpShowBetSize = !cnoSharpShowBetSize;
        try { chrome.storage.local.set({ [CNO_SHARP_SHOW_BETSIZE_KEY]: cnoSharpShowBetSize }); } catch (err) { /* ignore */ }
        cnoSlipRender(true);
      });
      sub.appendChild(amt);
      sub.appendChild(eye);
      kTile.appendChild(sub);
    }
    tile('FBC', isFinite(c.fb) ? `${(c.fb * 100).toFixed(1)}%` : '—');
    tile('Fair odds', isFinite(c.P) ? cnoSlipAmerican(1 / c.P) : '—', '', isFinite(c.P) ? `${(c.P * 100).toFixed(c.P < 0.01 ? 2 : 1)}% to hit` : '');
    panel.appendChild(tiles);
  }

  // Profit boost, and CNO / Sharps
  const opts = cnoSlipEl('div', 'cno-slip-opts');
  if (cnoSlipSharpAvailable()) {
    const sw = cnoSlipEl('span', 'cno-slip-switch');
    [['cno', 'CNO'], ['sharp', 'Sharps']].forEach(([key, label]) => {
      const b = cnoSlipEl('button', 'cno-slip-switch-btn' + ((key === 'sharp') === cnoSlipUi.sharp ? ' cno-on' : ''), label);
      b.type = 'button';
      b.title = key === 'sharp' ? 'EV% from your custom sharp books (CNO\'s fair odds for legs without a sharp set)' : "EV% from CNO's fair odds";
      b.addEventListener('click', (e) => {
        e.preventDefault();
        cnoSlipUi.sharp = key === 'sharp';
        if (cnoSlipUi.sharp) cnoSlipLoadSharp();
        cnoSlipRender(true);
      });
      sw.appendChild(b);
    });
    if (cnoSlipUi.sharp) {
      const rf = cnoSlipEl('button', 'cno-slip-icon-btn');
      rf.type = 'button';
      rf.title = 'Refresh the sharp prices';
      rf.innerHTML = CNO_SLIP_REFRESH_SVG;
      rf.addEventListener('click', (e) => { e.preventDefault(); cnoSlipLoadSharp(true); });
      sw.appendChild(rf);
    }
    opts.appendChild(sw);
  }
  if (opts.childElementCount) panel.appendChild(opts);

  // The legs (scrolls past 4)
  const list = cnoSlipEl('div', 'cno-slip-legs');
  c.legs.forEach(x => {
    const l = x.leg;
    const row = cnoSlipEl('div', 'cno-slip-leg');
    const rm = cnoSlipEl('button', 'cno-slip-remove');
    rm.type = 'button';
    rm.title = 'Remove this leg';
    rm.innerHTML = CNO_SLIP_REMOVE_SVG;
    rm.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cnoSlipRemove(l.lineId); });
    row.appendChild(rm);
    const mid = cnoSlipEl('div', 'cno-slip-leg-mid');
    const w = cnoSlipWhenParts(l);
    mid.appendChild(cnoSlipEl('div', 'cno-slip-leg-event', [l.event, [w.day, w.time].filter(Boolean).join(' ')].filter(Boolean).join(' · ')));
    const bet = cnoSlipEl('div', 'cno-slip-leg-bet');
    bet.appendChild(cnoSlipEl('span', 'cno-slip-leg-name', l.betName));
    if (l.market) bet.appendChild(cnoSlipEl('span', 'cno-slip-leg-market', ` | ${l.market}`));
    mid.appendChild(bet);
    row.appendChild(mid);
    const right = cnoSlipEl('div', 'cno-slip-leg-right');
    const oddsLine = cnoSlipEl('div', 'cno-slip-leg-odds');
    if (cnoSlipUi.sharp && x.src !== 'sharp') {
      const st = x.sharp ? x.sharp.status : '';
      oddsLine.appendChild(cnoSlipEl('span', 'cno-slip-cno-badge', st === 'loading' ? '…' : 'CNO'));
    }
    oddsLine.appendChild(cnoSlipEl('span', 'cno-slip-leg-oddsval', cnoShareSignedOdds(l.odds)));
    if (l.prevOdds && l.prevOdds !== l.odds) {
      const up = (cnoSlipDec(l.odds) || 0) > (cnoSlipDec(l.prevOdds) || 0);
      const arrow = cnoSlipEl('span', 'cno-slip-move ' + (up ? 'cno-up' : 'cno-down'), up ? '▲' : '▼');
      arrow.title = `Was ${l.prevOdds}`;
      oddsLine.appendChild(arrow);
    }
    if (x.src === 'sharp') {
      oddsLine.classList.add('cno-slip-has-mini');
      oddsLine.addEventListener('mouseenter', () => cnoSlipMiniShow(oddsLine, x));
      oddsLine.addEventListener('mouseleave', cnoSlipMiniHide);
    }
    right.appendChild(oddsLine);
    right.appendChild(cnoSlipEl('div', 'cno-slip-leg-ev ' + (x.ev > 0 ? 'cno-pos' : (x.ev < 0 ? 'cno-neg' : '')), isFinite(x.ev) ? cnoFmtPct(x.ev, true) : '—'));
    row.appendChild(right);
    list.appendChild(row);
  });
  panel.appendChild(list);
  if (n > 4) {
    requestAnimationFrame(() => {
      const rows = Array.from(list.children).slice(0, 4);
      const h = rows.reduce((t, r) => t + r.getBoundingClientRect().height, 0);
      if (h > 0) list.style.maxHeight = `${Math.ceil(h)}px`;
    });
  }

  // Links
  const url = cnoSlipBetUrl();
  const book = cnoSlipBookDisplay(cnoSlip.book);
  const a1 = cnoSlipEl('div', 'cno-slip-actions cno-slip-actions-main');
  const open = cnoSlipEl('a', 'cno-slip-action cno-slip-action-big');
  open.href = url;
  open.target = '_blank';
  open.rel = 'noopener';
  open.innerHTML = `${CNO_SLIP_OPEN_SVG}<span>Open at ${book}</span>`;
  a1.appendChild(open);
  const qr = cnoSlipEl('button', 'cno-slip-action cno-slip-action-big');
  qr.type = 'button';
  qr.innerHTML = `${CNO_SLIP_QR_SVG}<span>QR</span>`;
  qr.addEventListener('click', (e) => {
    e.preventDefault();
    openQrPopup(url, book, { event: `${n}-leg ${c.sgp ? 'same game parlay' : 'parlay'}`, betName: cnoSlip.legs.map(l => l.betName).join(', '), odds: c.sgp ? '' : (c.boost > 0 ? cnoSlipAmerican(c.bd) : cnoSlipShownOdds(c)) });
  });
  a1.appendChild(qr);
  panel.appendChild(a1);

  const a2 = cnoSlipEl('div', 'cno-slip-actions');
  const off = c.sgp || !isFinite(c.ev);
  const dvOff = !c.sgp && !isFinite(c.ev);
  const dv = cnoSlipEl('a', 'cno-slip-action' + (dvOff ? ' cno-off' : ''));
  dv.innerHTML = `${cnoIconSvg('devig')}<span>Open in Devigger</span><span aria-hidden="true">↗</span>`;
  if (!dvOff) { dv.href = cnoSlipDeviggerUrl(c); dv.target = '_blank'; dv.rel = 'noopener'; }
  dv.title = c.sgp ? "Open the legs in the Devigger (CNO's fair odds; you'll need to finish the same game parlay devig yourself)" : 'Check this parlay in the Devigger';
  if (c.sgp) {
    dv.addEventListener('click', (e) => {
      e.preventDefault();
      const url = dv.href;
      cnoSlipConfirmSgpDevig().then(ok => { if (ok) window.open(url, '_blank', 'noopener'); });
    });
  }
  a2.appendChild(dv);
  const cp = cnoSlipEl('button', 'cno-slip-action' + (off ? ' cno-off' : ''));
  cp.type = 'button';
  cp.innerHTML = `${cnoIconSvg('discord')}<span>Copy for Discord</span>`;
  cp.title = c.sgp ? 'Not available for a same game parlay' : 'Copy this parlay as a Discord post';
  cp.addEventListener('click', (e) => {
    e.preventDefault();
    if (off) return;
    const label = cp.querySelector('span');
    const done = (ok) => {
      label.textContent = ok ? 'Copied ✓' : 'Copy failed';
      setTimeout(() => { if (label.isConnected) label.textContent = 'Copy for Discord'; }, 1600);
    };
    try { navigator.clipboard.writeText(cnoSlipShareText(c)).then(() => done(true), () => done(false)); } catch (err) { done(false); }
  });
  a2.appendChild(cp);
  panel.appendChild(a2);
}

// Hovering a sharp leg's odds: the sharp books behind its fair value
function cnoSlipMiniShow(anchor, x) {
  cnoSlipMiniHide();
  const r = x.sharp && x.sharp.r;
  if (!r) return;
  const el = cnoSlipEl('div', 'cno-sharp-popup cno-slip-mini');
  el.id = 'cno-slip-mini';
  const method = (CNO_DEVIG_METHOD_NAMES[r.method] || r.method).toLowerCase();
  el.appendChild(cnoSlipEl('div', 'cno-slip-mini-ttl', `Sharp FV ${cnoSlipAmerican(1 / x.p)} · ${r.mode === 'weighted' ? 'weighted' : 'average'}, ${method}`));
  const tbl = cnoSlipEl('table', 'cno-sharp-books');
  const hr = document.createElement('tr');
  ['Book', 'Odds', 'FV', 'Juice', r.mode === 'weighted' ? 'Weight' : 'Used'].forEach((h, i) => hr.appendChild(cnoSlipEl('th', i >= 2 ? 'cno-r' : '', h)));
  tbl.appendChild(hr);
  r.books.forEach(b => {
    const tr = document.createElement('tr');
    if (!b.usable) tr.className = 'cno-sharp-unused';
    tr.appendChild(cnoSlipEl('td', '', b.name));
    tr.appendChild(cnoSlipEl('td', '', b.cells.map(cl => (cl ? cl.odds : '—')).join(' / ')));
    tr.appendChild(cnoSlipEl('td', 'cno-r cno-sharp-fv', b.usable && isFinite(b.fair) ? (cnoProbabilityToAmerican(b.fair) || '—') : '—'));
    tr.appendChild(cnoSlipEl('td', 'cno-r', b.juice !== undefined ? cnoFmtPct(b.juice) : '—'));
    tr.appendChild(cnoSlipEl('td', 'cno-r', b.usable ? (r.mode === 'weighted' ? `${Math.round(b.share * 1000) / 10}%` : '✓') : (r.mode === 'weighted' ? '0%' : '—')));
    tbl.appendChild(tr);
  });
  el.appendChild(tbl);
  document.body.appendChild(el);
  const ar = anchor.getBoundingClientRect();
  const panel = anchor.closest('.cno-slip-box');
  const pr = panel ? panel.getBoundingClientRect() : ar;
  const w = el.offsetWidth;
  let left = pr.left - w - 8;
  if (left < 8) left = Math.min(window.innerWidth - w - 8, ar.right + 8);
  let top = ar.top - 10;
  if (top + el.offsetHeight > window.innerHeight - 8) top = Math.max(8, window.innerHeight - 8 - el.offsetHeight);
  el.style.left = `${left + window.scrollX}px`;
  el.style.top = `${top + window.scrollY}px`;
}

function cnoSlipMiniHide() {
  const m = document.getElementById('cno-slip-mini');
  if (m) m.remove();
}

// ---------- each pass ----------

// Where the slip sits: just above the table at the right (bottom 4px above the header row). Once the
// page scrolls past that, it stays at the top of the window, with a white band behind it the
// width of the table, and the table's sticky header row sits just under it.
const CNO_SLIP_BAR_H = 42;
// While CNO redraws the results (Update, Refresh, auto refresh), the table's place moves around:
// the slip stays hidden until the new table is in and has been still for a moment
let cnoSlipSettleUntil = 0;
let cnoSlipWaitTable = null; // the old table, after Update / Refresh is clicked
let cnoSlipWaitUntil = 0;
document.addEventListener('click', (e) => {
  const t = e.target && e.target.closest ? e.target.closest('input[type="submit"], input[type="button"], button') : null;
  if (!t || !/^(update|refresh)$/i.test((t.value || t.textContent || '').trim())) return;
  cnoSlipWaitTable = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  cnoSlipWaitUntil = Date.now() + 20000;
  cnoSlipSyncStuck();
}, true);
let cnoSlipPanelObs = null;
function cnoSlipWatchPanel(table) {
  const up = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelGridView');
  if (!up || (cnoSlipPanelObs && cnoSlipPanelObs.table === table)) return;
  if (cnoSlipPanelObs) cnoSlipPanelObs.obs.disconnect();
  const obs = new MutationObserver(() => { cnoSlipSettleUntil = Date.now() + 350; cnoSlipSyncStuck(); });
  obs.observe(up, { childList: true });
  if (table.parentNode && table.parentNode !== up) obs.observe(table.parentNode, { childList: true });
  cnoSlipPanelObs = { obs, table };
  cnoSlipSettleUntil = Date.now() + 350;
}
function cnoSlipSyncStuck() {
  const dock = document.getElementById('cno-slip-dock');
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!dock || !table) return;
  const box = dock.querySelector('.cno-slip-box');
  let band = dock.querySelector('.cno-slip-band');
  if (!band) { band = cnoSlipEl('div', 'cno-slip-band'); dock.insertBefore(band, dock.firstChild); }
  table.classList.toggle('cno-slip-has-dock', !dock.hidden);
  if (dock.hidden || !box) return;
  // Until CNO's results (and the line above them) are in, the table's place isn't final: wait
  const banner = document.getElementById('cno-injury-refresh-banner');
  const settled = Date.now() >= cnoSlipSettleUntil && (!cnoSlipWaitTable || cnoSlipWaitTable !== table || Date.now() > cnoSlipWaitUntil);
  if (settled) cnoSlipWaitTable = null;
  const ready = settled && !!(banner && banner.nextElementSibling === table && table.tBodies[0] && table.tBodies[0].rows.length);
  box.style.visibility = ready ? '' : 'hidden';
  if (!ready) return;
  const dr = dock.getBoundingClientRect();
  const tr = table.getBoundingClientRect();
  const natural = tr.top - CNO_SLIP_BAR_H - 4; // the bar's top, in the window
  const stuck = natural < 4 && tr.bottom > CNO_SLIP_BAR_H + 60;
  if (stuck) {
    box.style.position = 'fixed';
    box.style.top = '4px';
    box.style.right = `${Math.max(0, window.innerWidth - dr.right)}px`;
    band.style.cssText = `display:block; left:${Math.max(0, tr.left)}px; width:${Math.min(tr.width, window.innerWidth)}px;`;
  } else {
    box.style.position = '';
    box.style.right = '';
    box.style.top = `${Math.round(natural - dr.top)}px`;
    band.style.cssText = '';
  }
  dock.classList.toggle('cno-slip-stuck', stuck);
}
window.addEventListener('scroll', cnoSlipSyncStuck, { passive: true });
window.addEventListener('resize', cnoSlipSyncStuck, { passive: true });

function processEvBetSlip() {
  if (!cnoSlipOnPage()) return;
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table || !table.querySelector('thead')) return;
  if (!cnoSlipLoaded) return;
  cnoSlipEnsureDock(table);
  processEvSlipRows(table);
  cnoSlipRender(false);
  cnoSlipWatchPanel(table);
  cnoSlipSyncStuck();
}
