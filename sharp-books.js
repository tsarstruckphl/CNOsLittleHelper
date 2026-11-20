// Custom Sharp Books editor (opened from the Settings page)

let sbBooks = [];          // [{ shortCode, fullName }] from the books sheet
let sbConfig = null;       // working copy
let sbSavedJson = '';      // what's in storage, to tell if there are unsaved changes

const $ = (id) => document.getElementById(id);

function sbEl(tag, props, children) {
  const el = document.createElement(tag);
  if (props) Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  });
  (children || []).forEach(c => c && el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}

function sbBookName(code) {
  const b = sbBooks.find(x => x.shortCode === code);
  return b ? b.fullName : code;
}

function sbIsExchange(code) { return CNO_SHARP_EXCHANGES.includes(code); }

function sbBlankConfig() {
  return { devigMethod: 'worstcase', sets: [] };
}

const SB_TYPE_ORDER = { all: 0, nonplayer: 1, player: 2 };

// All first, then sports, then leagues (grouped by sport), then anything else
function sbSortKey(key) {
  if (key === 'All') return '0';
  const si = CNO_SHARP_SPORTS.findIndex(s => s.toLowerCase() === key.toLowerCase());
  if (si !== -1) return '1' + si;
  for (let i = 0; i < CNO_SHARP_SPORTS.length; i++) {
    const list = CNO_SHARP_LEAGUES[CNO_SHARP_SPORTS[i]] || [];
    const li = list.findIndex(l => l.toLowerCase() === key.toLowerCase());
    if (li !== -1) return '2' + i + String(li).padStart(2, '0');
  }
  return '3' + key.toLowerCase();
}

function sbNormalize(config) {
  const c = (config && typeof config === 'object') ? JSON.parse(JSON.stringify(config)) : sbBlankConfig();
  if (!CNO_SHARP_DEVIG_METHODS.some(m => m.value === c.devigMethod)) c.devigMethod = 'worstcase';
  c.sets = Array.isArray(c.sets) ? c.sets.filter(s => s && s.key) : [];
  c.sets.forEach(s => {
    if (s.key.toLowerCase() === 'all') s.key = 'All';
    s.marketType = cnoSharpMarketType(s.marketType);
    s.mode = s.mode === 'weighted' ? 'weighted' : 'average';
    s.books = Array.isArray(s.books) ? s.books.filter(b => b && b.code) : [];
  });
  c.sets.sort((a, b) => sbSortKey(a.key).localeCompare(sbSortKey(b.key)) || (SB_TYPE_ORDER[a.marketType] - SB_TYPE_ORDER[b.marketType]));
  return c;
}

// What gets stored: only the fields that matter for each set's mode
function sbClean(config) {
  return {
    devigMethod: config.devigMethod,
    sets: config.sets.map(s => ({
      key: s.key,
      marketType: s.marketType,
      mode: s.mode,
      books: s.books.map(b => {
        const out = { code: b.code };
        if (s.mode === 'weighted') out.weight = b.weight;
        if (sbIsExchange(b.code)) out.minLiq = b.minLiq;
        return out;
      })
    }))
  };
}

// ---------- validation ----------

function sbValidateSet(s) {
  const errors = [];
  const bad = new Set(); // "w:CODE" / "l:CODE" inputs to mark red
  if (!s.books.length) errors.push('Choose at least one book, or remove this set.');
  if (s.mode === 'weighted' && s.books.length) {
    s.books.forEach(b => { if (!(b.weight > 0)) bad.add('w:' + b.code); });
    if (bad.size) errors.push('Every chosen book needs a weight above 0%.');
    const total = sbWeightTotal(s);
    if (Math.abs(total - 100) > 0.001) errors.push(`Weights add up to ${sbFmt(total)}%. They must total 100%.`);
  }
  s.books.forEach(b => {
    if (sbIsExchange(b.code) && !(b.minLiq > 0)) {
      bad.add('l:' + b.code);
      errors.push(`Set a minimum liquidity for ${sbBookName(b.code)}.`);
    }
  });
  return { errors, bad };
}

function sbWeightTotal(s) {
  return Math.round(s.books.reduce((t, b) => t + (b.weight > 0 ? b.weight : 0), 0) * 1000) / 1000;
}

function sbFmt(n) { return String(Math.round(n * 100) / 100); }

function sbAllErrors() {
  return sbConfig.sets.reduce((n, s) => n + sbValidateSet(s).errors.length, 0);
}

// ---------- rendering ----------

function sbRender() {
  $('devigMethod').value = sbConfig.devigMethod;
  const wrap = $('sets');
  wrap.textContent = '';
  sbConfig.sets.forEach(s => wrap.appendChild(sbRenderSet(s)));
  if (!sbConfig.sets.length) {
    wrap.appendChild(sbEl('div', { class: 'empty', text: 'No sharp book sets yet. Add one below, or use "Reset to defaults".' }));
  }
  sbRenderAddSelect();
  sbUpdateSaveBar();
}

function sbRenderSet(s) {
  const kind = cnoSharpSetKind(s.key);
  const card = sbEl('div', { class: 'set' });

  const seg = sbEl('div', { class: 'seg' }, ['average', 'weighted'].map(mode =>
    sbEl('button', {
      type: 'button', class: s.mode === mode ? 'on' : '', text: mode === 'average' ? 'Average' : 'Weighted',
      onclick: () => { if (s.mode !== mode) { s.mode = mode; if (mode === 'weighted') sbFillEqualWeights(s); sbRender(); } }
    })));

  card.appendChild(sbEl('div', { class: 'set-head' }, [
    sbEl('span', { class: 'set-name', text: s.key === 'All' ? 'All sports & leagues' : s.key }),
    sbEl('span', { class: 'set-kind', text: kind === 'all' ? 'Fallback' : kind }),
    sbEl('span', { class: 'set-type type-' + s.marketType, text: cnoSharpMarketLabel(s.marketType) }),
    sbEl('span', { class: 'spacer' }),
    seg,
    sbEl('button', {
      type: 'button', class: 'link', text: 'Remove',
      onclick: () => { sbConfig.sets = sbConfig.sets.filter(x => x !== s); sbRender(); }
    })
  ]));

  const body = sbEl('div', { class: 'set-body' });

  // Book checkboxes
  const codes = sbBooks.map(b => b.shortCode);
  s.books.forEach(b => { if (!codes.includes(b.code)) codes.push(b.code); }); // books no longer in the sheet stay visible
  const grid = sbEl('div', { class: 'book-grid' });
  codes.forEach(code => {
    const on = s.books.some(b => b.code === code);
    const cb = sbEl('input', { type: 'checkbox' });
    cb.checked = on;
    cb.addEventListener('change', () => {
      if (cb.checked) s.books.push({ code });
      else s.books = s.books.filter(b => b.code !== code);
      sbRender();
    });
    grid.appendChild(sbEl('label', { class: on ? 'on' : '' }, [cb, sbBookName(code) + ' ', sbEl('span', { class: 'code', text: code })]));
  });
  body.appendChild(grid);

  // Chosen books: weights and minimum liquidity
  const v = sbValidateSet(s);
  if (s.books.length) {
    const showWeight = s.mode === 'weighted';
    const showLiq = s.books.some(b => sbIsExchange(b.code));
    const head = sbEl('tr', null, [
      sbEl('th', { text: 'Sharp book' }),
      showWeight ? sbEl('th', { text: 'Weight' }) : null,
      showLiq ? sbEl('th', { text: 'Min. liquidity' }) : null
    ]);
    const tbody = sbEl('tbody');
    s.books.forEach(b => {
      const weightInput = showWeight ? sbNumberInput(b, 'weight', v.bad.has('w:' + b.code), s) : null;
      tbody.appendChild(sbEl('tr', null, [
        sbEl('td', { text: sbBookName(b.code) }),
        showWeight ? sbEl('td', null, [weightInput, sbEl('span', { class: 'unit', text: '%' })]) : null,
        showLiq ? (sbIsExchange(b.code)
          ? sbEl('td', null, [sbEl('span', { class: 'unit', text: '$' }), sbNumberInput(b, 'minLiq', v.bad.has('l:' + b.code), s)])
          : sbEl('td', { class: 'muted', text: '—' })) : null
      ]));
    });
    body.appendChild(sbEl('table', { class: 'chosen' }, [sbEl('thead', null, [head]), tbody]));
  } else {
    body.appendChild(sbEl('div', { class: 'empty', text: 'No books chosen yet.' }));
  }

  const foot = sbEl('div', { class: 'set-foot' });
  body.appendChild(foot);
  card.appendChild(body);
  sbUpdateSetFoot(card, foot, s);
  return card;
}

function sbNumberInput(book, field, isBad, set) {
  const input = sbEl('input', { type: 'number', min: '0', step: field === 'weight' ? '0.01' : '1', class: isBad ? 'bad' : '' });
  if (book[field] != null) input.value = book[field];
  input.addEventListener('input', () => {
    book[field] = input.value === '' ? null : cnoSharpNumber(input.value);
    input.classList.toggle('bad', !(book[field] > 0));
    const card = input.closest('.set');
    sbUpdateSetFoot(card, card.querySelector('.set-foot'), set);
    sbUpdateSaveBar();
  });
  return input;
}

function sbUpdateSetFoot(card, foot, s) {
  const v = sbValidateSet(s);
  foot.textContent = '';
  if (s.mode === 'weighted' && s.books.length) {
    const total = sbWeightTotal(s);
    foot.appendChild(sbEl('span', { class: 'total ' + (Math.abs(total - 100) <= 0.001 ? 'ok' : 'bad'), text: `Total: ${sbFmt(total)}%` }));
    foot.appendChild(sbEl('button', { type: 'button', text: 'Split evenly', onclick: () => { sbFillEqualWeights(s, true); sbRender(); } }));
  }
  if (v.errors.length) foot.appendChild(sbEl('span', { class: 'errors', text: v.errors.join(' ') }));
  card.classList.toggle('has-error', v.errors.length > 0);
}

// Equal weights that add up to exactly 100 (the remainder goes to the first book)
function sbFillEqualWeights(s, force) {
  if (!s.books.length) return;
  if (!force && s.books.some(b => b.weight > 0)) return;
  const each = Math.floor(10000 / s.books.length) / 100;
  s.books.forEach(b => { b.weight = each; });
  s.books[0].weight = Math.round((100 - each * (s.books.length - 1)) * 100) / 100;
}

function sbRenderAddSelect() {
  const sel = $('addSet');
  const keep = sel.value;
  sel.textContent = '';
  sel.appendChild(sbEl('option', { value: '', text: 'Sport or league…' }));
  sel.appendChild(sbEl('option', { value: 'All', text: 'All sports & leagues' }));
  const sports = sbEl('optgroup', { label: 'Sports' });
  CNO_SHARP_SPORTS.forEach(sp => sports.appendChild(sbEl('option', { value: sp, text: sp })));
  sel.appendChild(sports);
  CNO_SHARP_SPORTS.forEach(sp => {
    const g = sbEl('optgroup', { label: sp + ' leagues' });
    (CNO_SHARP_LEAGUES[sp] || []).forEach(l => g.appendChild(sbEl('option', { value: l, text: l })));
    sel.appendChild(g);
  });
  sel.value = keep;
  const typeSel = $('addType');
  if (!typeSel.options.length) CNO_SHARP_MARKET_TYPES.forEach(t => typeSel.appendChild(sbEl('option', { value: t.value, text: t.label })));
  sbSyncAddButton();
}

function sbSetExists(key, type) {
  return sbConfig.sets.some(s => s.key.toLowerCase() === String(key).toLowerCase() && s.marketType === type);
}

function sbSyncAddButton() {
  const key = $('addSet').value, type = $('addType').value;
  const exists = key && sbSetExists(key, type);
  $('addBtn').disabled = !key || exists;
  $('addMsg').textContent = exists ? 'That set already exists.' : '';
}

function sbUpdateSaveBar() {
  const json = JSON.stringify(sbClean(sbConfig));
  const dirty = json !== sbSavedJson;
  const errors = sbAllErrors();
  const msg = $('saveMsg');
  $('save').disabled = !dirty || errors > 0;
  $('discard').disabled = !dirty;
  if (errors && dirty) { msg.className = 'msg bad'; msg.textContent = 'Fix the highlighted sets to save.'; }
  else if (dirty) { msg.className = 'msg dirty'; msg.textContent = 'Unsaved changes'; }
  else if (msg.classList.contains('saved')) { /* keep "Saved" showing */ }
  else { msg.className = 'msg'; msg.textContent = errors ? 'Some sets need fixing.' : 'All changes saved.'; }
}

// ---------- actions ----------

function sbSave() {
  if (sbAllErrors()) return;
  const clean = sbClean(sbConfig);
  chrome.storage.local.set({ [CNO_SHARP_CONFIG_KEY]: clean }, () => {
    sbSavedJson = JSON.stringify(clean);
    const msg = $('saveMsg');
    msg.className = 'msg saved';
    msg.textContent = 'Saved!';
    sbUpdateSaveBar();
    setTimeout(() => { if (msg.classList.contains('saved')) { msg.className = 'msg'; sbUpdateSaveBar(); } }, 1800);
  });
}

function sbShowLoadError(text) {
  const n = $('loadNotice');
  n.hidden = !text;
  n.textContent = text || '';
}

function sbInit() {
  const methodSel = $('devigMethod');
  CNO_SHARP_DEVIG_METHODS.forEach(m => methodSel.appendChild(sbEl('option', { value: m.value, text: m.label })));
  methodSel.addEventListener('change', () => { sbConfig.devigMethod = methodSel.value; sbUpdateSaveBar(); });

  $('addSet').addEventListener('change', sbSyncAddButton);
  $('addType').addEventListener('change', sbSyncAddButton);
  $('addBtn').addEventListener('click', () => {
    const key = $('addSet').value, type = $('addType').value;
    if (!key || sbSetExists(key, type)) return;
    sbConfig.sets.push({ key, marketType: type, mode: 'average', books: [] });
    sbConfig = sbNormalize(sbConfig);
    $('addSet').value = '';
    sbRender();
  });

  $('save').addEventListener('click', sbSave);
  $('discard').addEventListener('click', () => {
    sbConfig = sbNormalize(JSON.parse(sbSavedJson || 'null'));
    sbRender();
  });

  $('resetDefaults').addEventListener('click', () => {
    if (!confirm('Replace all of your sharp book sets with the defaults? (Nothing is saved until you click Save.)')) return;
    loadSharpDefaults((defaults) => {
      if (!defaults) { sbShowLoadError("Couldn't load the defaults right now. Please try again in a moment."); return; }
      sbShowLoadError('');
      sbConfig = sbNormalize(defaults);
      sbRender();
    });
  });

  window.addEventListener('beforeunload', (e) => {
    if (JSON.stringify(sbClean(sbConfig)) !== sbSavedJson) { e.preventDefault(); e.returnValue = ''; }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.customSharpDevig) $('offNotice').hidden = !!changes.customSharpDevig.newValue;
  });

  chrome.storage.local.get({ customSharpDevig: false, [CNO_SHARP_CONFIG_KEY]: null }, (items) => {
    $('offNotice').hidden = !!items.customSharpDevig;
    loadBooksList((books) => {
      sbBooks = books || [];
      const stored = items[CNO_SHARP_CONFIG_KEY];
      if (stored) {
        sbConfig = sbNormalize(stored);
        sbSavedJson = JSON.stringify(sbClean(sbConfig));
        sbRender();
        return;
      }
      // Nothing set up yet: start from the defaults sheet and save them
      loadSharpDefaults((defaults) => {
        if (defaults) {
          sbConfig = sbNormalize(defaults);
          const clean = sbClean(sbConfig);
          chrome.storage.local.set({ [CNO_SHARP_CONFIG_KEY]: clean });
          sbSavedJson = JSON.stringify(clean);
        } else {
          sbShowLoadError("Couldn't load the default sharp books, so you're starting from a blank setup. Use \"Reset to defaults\" to try again.");
          sbConfig = sbNormalize(null);
          sbSavedJson = '';
        }
        sbRender();
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', sbInit);
