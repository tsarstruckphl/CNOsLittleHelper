// Backup, Restore, Import & Export (opened from the Settings page)

const $ = (id) => document.getElementById(id);

function el(tag, props, children) {
  const e = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  });
  (children || []).forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

function msg(target, cls, text, extra) {
  const box = typeof target === 'string' ? $(target) : target;
  box.textContent = '';
  if (!text) return;
  const m = el('div', { class: cls, text });
  (extra || []).forEach(x => m.appendChild(x));
  box.appendChild(m);
}

const storageGet = (keys) => new Promise(res => chrome.storage.local.get(keys, res));
const storageSet = (obj) => new Promise(res => chrome.storage.local.set(obj, res));
const storageRemove = (keys) => new Promise(res => chrome.storage.local.remove(keys, res));

const AREAS = [
  { id: 'helper', label: "CNO's Little Helper settings" },
  { id: 'cno', label: "CNO settings (from CNO's Settings page)" },
  { id: 'filters', label: 'Saved filters' },
  { id: 'sharp', label: 'Custom sharp books' }
];

function countFilters(filters) {
  const pages = Object.keys(filters || {}).filter(p => Object.keys(filters[p] || {}).length);
  const n = pages.reduce((t, p) => t + Object.keys(filters[p]).length, 0);
  return { n, pages: pages.length };
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; }

function fileStamp() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Files are XML inside, saved as .cnolh: browsers flag .xml downloads as possibly dangerous.
// Old .xml files still open.
const CNO_FILE_EXT = '.cnolh';

// Save a file: the browser's "Save as" picker when it has one, otherwise a normal download
async function saveXmlFile(xml, suggestedName) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'CNO\'s Little Helper file (.cnolh)', accept: { 'application/octet-stream': [CNO_FILE_EXT] } }]
      });
      const w = await handle.createWritable();
      await w.write(xml);
      await w.close();
      return handle.name || suggestedName;
    } catch (e) {
      if (e && e.name === 'AbortError') return null; // cancelled
      // fall through to a plain download
    }
  }
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/octet-stream' }));
  const a = el('a', { href: url, download: suggestedName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return suggestedName;
}

function readFileInput(input) {
  return new Promise((resolve, reject) => {
    const f = input.files && input.files[0];
    if (!f) { resolve(null); return; }
    const r = new FileReader();
    r.onload = () => resolve({ name: f.name, text: String(r.result || '') });
    r.onerror = () => reject(new Error("couldn't read that file"));
    r.readAsText(f);
  });
}

function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? 'unknown date' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// ---------- current data ----------

async function readCurrent() {
  const all = await storageGet(null);
  const helper = {};
  cnoBackupHelperKeys().forEach(k => { if (all[k] !== undefined) helper[k] = all[k]; });
  return { all, helper, filters: all[CNO_BACKUP_FILTERS_KEY] || {}, sharp: all[CNO_BACKUP_SHARP_KEY] || null };
}

// Checkbox list of areas with an "All" box on top
function areaChecklist(container, areas, counts) {
  container.textContent = '';
  const boxes = [];
  const all = el('input', { type: 'checkbox' });
  all.checked = true;
  container.appendChild(el('label', { class: 'all' }, [all, 'All']));
  areas.forEach(a => {
    const cb = el('input', { type: 'checkbox', 'data-area': a.id });
    cb.checked = true;
    boxes.push(cb);
    container.appendChild(el('label', null, [cb, el('span', null, [a.label, counts && counts[a.id] ? el('span', { class: 'count', text: counts[a.id] }) : null])]));
  });
  const sync = () => { all.checked = boxes.every(b => b.checked); all.indeterminate = !all.checked && boxes.some(b => b.checked); };
  all.addEventListener('change', () => { boxes.forEach(b => { b.checked = all.checked; }); all.indeterminate = false; container.dispatchEvent(new Event('change')); });
  boxes.forEach(b => b.addEventListener('change', sync));
  return () => boxes.filter(b => b.checked).map(b => b.dataset.area);
}

// ---------- Backup ----------

let getBackupAreas = () => [];

async function initBackup() {
  const cur = await readCurrent();
  const fc = countFilters(cur.filters);
  getBackupAreas = areaChecklist($('backupAreas'), AREAS, {
    helper: plural(Object.keys(cur.helper).length, 'saved setting'),
    filters: `${plural(fc.n, 'filter')} on ${plural(fc.pages, 'page')}`,
    sharp: cur.sharp ? plural((cur.sharp.sets || []).length, 'set') : 'none set up'
  });
}

async function doBackup() {
  const areas = getBackupAreas();
  if (!areas.length) { msg('backupMsg', 'err', 'Check at least one thing to back up.'); return; }
  const btn = $('backupBtn');
  btn.disabled = true;
  msg('backupMsg', 'fileinfo', 'Gathering…');
  try {
    const cur = await readCurrent();
    const data = {};
    if (areas.includes('helper')) data.helper = cur.helper;
    if (areas.includes('filters')) data.filters = cur.filters;
    if (areas.includes('sharp')) data.sharp = cur.sharp || { devigMethod: 'worstcase', sets: [] };
    if (areas.includes('cno')) data.cno = (await cnoFetchCnoSettings()).fields;
    const name = await saveXmlFile(cnoBuildTransferXml(data, 'backup'), `CNOsLittleHelper-backup-${fileStamp()}${CNO_FILE_EXT}`);
    if (name) msg('backupMsg', 'ok', `Backed up ${areas.map(a => AREAS.find(x => x.id === a).label.replace(/ \(.*\)$/, '')).join(', ')} to ${name}.`);
    else msg('backupMsg', '', '');
  } catch (e) {
    msg('backupMsg', 'err', `Backup failed: ${e.message || e}`);
  } finally {
    btn.disabled = false;
  }
}

// ---------- Restore ----------

async function onRestoreFile() {
  const body = $('restoreBody');
  body.textContent = '';
  let file, data;
  try {
    file = await readFileInput($('restoreFile'));
    if (!file) return;
    data = cnoParseTransferXml(file.text);
  } catch (e) { msg(body, 'err', e.message || String(e)); return; }
  finally { $('restoreFile').value = ''; }

  const present = AREAS.filter(a => data[a.id] !== undefined);
  if (!present.length) { msg(body, 'err', 'That file has nothing this extension can restore.'); return; }
  const fc = data.filters ? countFilters(data.filters) : null;
  body.appendChild(el('div', { class: 'fileinfo', text: `${file.name}: ${data.kind === 'export' ? 'exported' : 'backed up'} ${fmtDate(data.created)}${data.extensionVersion ? ` (version ${data.extensionVersion})` : ''}.` }));
  data.problems.forEach(p => body.appendChild(el('div', { class: 'warn', text: p })));

  const areasBox = el('div', { class: 'areas' });
  body.appendChild(areasBox);
  const getAreas = areaChecklist(areasBox, present, {
    helper: data.helper ? plural(Object.keys(data.helper).length, 'setting') : '',
    cno: data.cno ? plural(data.cno.length, 'field') : '',
    filters: fc ? `${plural(fc.n, 'filter')} on ${plural(fc.pages, 'page')}` : '',
    sharp: data.sharp ? plural(data.sharp.sets.length, 'set') : ''
  });

  // Filters you have that the file doesn't (they'd be removed)
  const cur = await readCurrent();
  const missing = [];
  if (data.filters) {
    Object.keys(cur.filters).forEach(page => Object.keys(cur.filters[page] || {}).forEach(name => {
      if (!(data.filters[page] && data.filters[page][name])) missing.push({ page, name });
    }));
  }
  const warnBox = el('div');
  body.appendChild(warnBox);
  let keepOthers = null;
  if (missing.length) {
    keepOthers = el('input', { type: 'checkbox' });
    const list = el('ul', null, missing.slice(0, 12).map(m => el('li', { text: `${cnoFilterPageName(m.page)}: ${m.name}` })));
    if (missing.length > 12) list.appendChild(el('li', { text: `…and ${missing.length - 12} more` }));
    warnBox.appendChild(el('div', { class: 'warn' }, [
      el('div', { text: `${plural(missing.length, 'of your saved filters', 'of your saved filters')} ${missing.length === 1 ? "isn't" : "aren't"} in this backup and will be removed:` }),
      list,
      el('label', { style: 'display:flex; gap:6px; align-items:center; font-weight:600; cursor:pointer;' }, [keepOthers, "Keep them (only replace filters that are in the backup)"])
    ]));
  }
  const syncWarn = () => { warnBox.hidden = !getAreas().includes('filters'); };
  areasBox.addEventListener('change', syncWarn);
  areasBox.querySelectorAll('input').forEach(i => i.addEventListener('change', syncWarn));

  const result = el('div');
  const go = el('button', { type: 'button', class: 'btn primary', text: 'Restore selected' });
  body.appendChild(el('div', { class: 'row' }, [go]));
  body.appendChild(result);
  go.addEventListener('click', async () => {
    const areas = getAreas();
    if (!areas.length) { msg(result, 'err', 'Check at least one thing to restore.'); return; }
    const names = areas.map(a => AREAS.find(x => x.id === a).label.replace(/ \(.*\)$/, ''));
    if (!confirm(`Replace your ${names.join(', ')} with the ones in this backup?`)) return;
    go.disabled = true;
    msg(result, 'fileinfo', 'Restoring…');
    const done = [], failed = [];
    try {
      if (areas.includes('helper')) {
        await storageRemove(cnoBackupHelperKeys());
        await storageSet(data.helper);
        done.push(`Little Helper settings (${plural(Object.keys(data.helper).length, 'setting')})`);
      }
      if (areas.includes('filters')) {
        let next = JSON.parse(JSON.stringify(data.filters));
        if (keepOthers && keepOthers.checked) {
          const merged = JSON.parse(JSON.stringify(cur.filters));
          Object.keys(next).forEach(p => { merged[p] = Object.assign(merged[p] || {}, next[p]); });
          next = merged;
        }
        await storageSet({ [CNO_BACKUP_FILTERS_KEY]: next });
        done.push(`saved filters (${plural(countFilters(next).n, 'filter')})`);
      }
      if (areas.includes('sharp')) {
        await storageSet({ [CNO_BACKUP_SHARP_KEY]: { devigMethod: data.sharp.devigMethod || 'worstcase', sets: data.sharp.sets } });
        done.push(`custom sharp books (${plural(data.sharp.sets.length, 'set')})`);
      }
      if (areas.includes('cno')) {
        try {
          const r = await cnoRestoreCnoSettings(data.cno);
          const notes = [];
          if (r.notFound.length) notes.push(`not on CNO's page anymore: ${r.notFound.join(', ')}`);
          if (r.mismatches.length) notes.push(`didn't take: ${r.mismatches.join(', ')}`);
          (notes.length ? failed : done).push(`CNO settings${notes.length ? ` (${notes.join('; ')})` : ''}`);
        } catch (e) { failed.push(`CNO settings: ${e.message || e}`); }
      }
      result.textContent = '';
      if (done.length) result.appendChild(el('div', { class: 'ok', text: `Restored ${done.join(', ')}. Reload any open CNO pages to see the changes.` }));
      if (failed.length) result.appendChild(el('div', { class: 'warn', text: `Check these: ${failed.join(' · ')}` }));
      initBackup();
      initExport();
    } catch (e) {
      msg(result, 'err', `Restore failed: ${e.message || e}`);
    } finally {
      go.disabled = false;
    }
  });
}

// ---------- Pick lists (export and import) ----------

const SHARP_GROUP_ORDER = (key) => {
  if (key === 'All') return '0';
  const si = CNO_SHARP_SPORTS.findIndex(s => s.toLowerCase() === key.toLowerCase());
  if (si !== -1) return '1' + si;
  for (let i = 0; i < CNO_SHARP_SPORTS.length; i++) {
    const li = (CNO_SHARP_LEAGUES[CNO_SHARP_SPORTS[i]] || []).findIndex(l => l.toLowerCase() === key.toLowerCase());
    if (li !== -1) return '2' + i + String(li).padStart(2, '0');
  }
  return '3' + key.toLowerCase();
};
const DEVIG_NAME = (v) => (CNO_SHARP_DEVIG_METHODS.find(m => m.value === v) || { label: v }).label;

// Builds checkboxes for filters (by page) and sharp book sets (by sport/league), all checked.
// Returns { getSelection, onChange(fn) }.
function buildPicker(container, src) {
  container.textContent = '';
  const boxes = []; // { cb, kind, page, name, set, devig }
  const listeners = [];
  const changed = () => listeners.forEach(fn => fn());
  const mkItem = (label, info, parent) => {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = true;
    cb.addEventListener('change', changed);
    boxes.push(Object.assign({ cb }, info));
    parent.appendChild(el('label', { class: 'item' }, [cb, label]));
    return cb;
  };
  const groupHead = (parent, text, members) => {
    const cb = el('input', { type: 'checkbox', title: 'Check or clear this group' });
    cb.checked = true;
    cb.addEventListener('change', () => { members().forEach(m => { m.checked = cb.checked; }); changed(); });
    parent.appendChild(el('label', { class: 'group' }, [cb, text]));
    listeners.push(() => { const ms = members(); cb.checked = ms.length > 0 && ms.every(m => m.checked); cb.indeterminate = !cb.checked && ms.some(m => m.checked); });
  };
  const allOrNone = (on) => { boxes.forEach(b => { b.cb.checked = on; }); changed(); };

  const head = el('div', { class: 'subhead' }, [
    el('button', { type: 'button', class: 'link', text: 'Select all', onclick: () => allOrNone(true) }),
    el('button', { type: 'button', class: 'link', text: 'Clear all', onclick: () => allOrNone(false) })
  ]);
  container.appendChild(head);

  // Saved filters
  container.appendChild(el('div', { class: 'subhead' }, [el('h3', { text: 'Saved filters' })]));
  const fBox = el('div', { class: 'pick' });
  container.appendChild(fBox);
  const pages = Object.keys(src.filters || {}).filter(p => Object.keys(src.filters[p] || {}).length)
    .sort((a, b) => cnoFilterPageName(a).localeCompare(cnoFilterPageName(b)));
  if (!pages.length) fBox.appendChild(el('div', { class: 'empty', text: src.filters ? 'No saved filters.' : 'No saved filters in this file.' }));
  pages.forEach(page => {
    const start = boxes.length;
    const holder = el('div');
    Object.keys(src.filters[page]).sort((a, b) => a.localeCompare(b)).forEach(name => mkItem(name, { kind: 'filter', page, name }, holder));
    const mine = boxes.slice(start).map(b => b.cb);
    groupHead(fBox, cnoFilterPageName(page), () => mine);
    fBox.appendChild(holder);
  });

  // Custom sharp books
  container.appendChild(el('div', { class: 'subhead' }, [el('h3', { text: 'Custom sharp books' })]));
  const sBox = el('div', { class: 'pick' });
  container.appendChild(sBox);
  const sharp = src.sharp;
  const sets = (sharp && sharp.sets) || [];
  if (!sets.length && !(sharp && sharp.devigMethod)) sBox.appendChild(el('div', { class: 'empty', text: 'No custom sharp books.' }));
  if (sharp && sharp.devigMethod) mkItem(`Devig method: ${DEVIG_NAME(sharp.devigMethod)}`, { kind: 'devig', devig: sharp.devigMethod }, sBox);
  const keys = Array.from(new Set(sets.map(s => s.key))).sort((a, b) => SHARP_GROUP_ORDER(a).localeCompare(SHARP_GROUP_ORDER(b)));
  keys.forEach(key => {
    const start = boxes.length;
    const holder = el('div');
    sets.filter(s => s.key === key).forEach(s => {
      const books = (s.books || []).map(b => b.code + (s.mode === 'weighted' && b.weight != null ? ` ${b.weight}%` : '')).join(', ');
      mkItem(`${cnoSharpMarketLabel(cnoSharpMarketType(s.marketType))} · ${s.mode === 'weighted' ? 'Weighted' : 'Average'} (${books || 'no books'})`, { kind: 'set', set: s }, holder);
    });
    const mine = boxes.slice(start).map(b => b.cb);
    groupHead(sBox, key === 'All' ? 'All sports & leagues' : key, () => mine);
    sBox.appendChild(holder);
  });

  return {
    onChange: (fn) => listeners.push(fn),
    getSelection: () => {
      const sel = { filters: {}, sharp: { devigMethod: null, sets: [] }, count: 0 };
      boxes.filter(b => b.cb.checked).forEach(b => {
        sel.count++;
        if (b.kind === 'filter') (sel.filters[b.page] = sel.filters[b.page] || {})[b.name] = src.filters[b.page][b.name];
        else if (b.kind === 'devig') sel.sharp.devigMethod = b.devig;
        else if (b.kind === 'set') sel.sharp.sets.push(b.set);
      });
      return sel;
    }
  };
}

// ---------- Export ----------

let exportPicker = null;

async function initExport() {
  const cur = await readCurrent();
  exportPicker = buildPicker($('exportBody'), { filters: cur.filters, sharp: cur.sharp });
}

async function doExport() {
  const sel = exportPicker && exportPicker.getSelection();
  if (!sel || !sel.count) { msg('exportMsg', 'err', 'Check at least one filter or sharp book set to export.'); return; }
  const data = {};
  const fc = countFilters(sel.filters);
  if (fc.n) data.filters = sel.filters;
  if (sel.sharp.sets.length || sel.sharp.devigMethod) data.sharp = sel.sharp;
  try {
    const name = await saveXmlFile(cnoBuildTransferXml(data, 'export'), `CNOsLittleHelper-export-${fileStamp()}${CNO_FILE_EXT}`);
    if (name) {
      const parts = [];
      if (fc.n) parts.push(plural(fc.n, 'filter'));
      if (sel.sharp.sets.length) parts.push(plural(sel.sharp.sets.length, 'sharp book set'));
      if (sel.sharp.devigMethod) parts.push('the devig method');
      msg('exportMsg', 'ok', `Exported ${parts.join(', ')} to ${name}.`);
    }
  } catch (e) { msg('exportMsg', 'err', `Export failed: ${e.message || e}`); }
}

// ---------- Import ----------

async function onImportFile() {
  const body = $('importBody');
  body.textContent = '';
  let file, data;
  try {
    file = await readFileInput($('importFile'));
    if (!file) return;
    data = cnoParseTransferXml(file.text);
  } catch (e) { msg(body, 'err', e.message || String(e)); return; }
  finally { $('importFile').value = ''; }

  if (!data.filters && !data.sharp) { msg(body, 'err', 'That file has no saved filters or custom sharp books to import.'); return; }
  body.appendChild(el('div', { class: 'fileinfo', text: `${file.name}: ${data.kind === 'export' ? 'exported' : 'backed up'} ${fmtDate(data.created)}${data.extensionVersion ? ` (version ${data.extensionVersion})` : ''}.` }));
  data.problems.forEach(p => body.appendChild(el('div', { class: 'warn', text: p })));

  const pickBox = el('div');
  body.appendChild(pickBox);
  const picker = buildPicker(pickBox, { filters: data.filters || {}, sharp: data.sharp || null });
  const warnBox = el('div');
  body.appendChild(warnBox);
  const result = el('div');
  const go = el('button', { type: 'button', class: 'btn primary', text: 'Import selected' });
  body.appendChild(el('div', { class: 'row' }, [go]));
  body.appendChild(result);

  // What would be replaced
  const refreshWarn = async () => {
    const cur = await readCurrent();
    const sel = picker.getSelection();
    const reF = [];
    Object.keys(sel.filters).forEach(p => Object.keys(sel.filters[p]).forEach(n => {
      if (cur.filters[p] && cur.filters[p][n]) reF.push(`${cnoFilterPageName(p)}: ${n}`);
    }));
    const curSets = (cur.sharp && cur.sharp.sets) || [];
    const reS = sel.sharp.sets.filter(s => curSets.some(c => cnoSharpSetId(c) === cnoSharpSetId(s))).map(s => cnoSharpSetLabel(s).replace(/ · (Weighted|Average)$/, ''));
    const reD = sel.sharp.devigMethod && cur.sharp && cur.sharp.devigMethod && cur.sharp.devigMethod !== sel.sharp.devigMethod
      ? [`Devig method: ${DEVIG_NAME(cur.sharp.devigMethod)} → ${DEVIG_NAME(sel.sharp.devigMethod)}`] : [];
    warnBox.textContent = '';
    const all = reF.concat(reS, reD);
    if (!all.length) return;
    const list = el('ul', null, all.slice(0, 14).map(t => el('li', { text: t })));
    if (all.length > 14) list.appendChild(el('li', { text: `…and ${all.length - 14} more` }));
    warnBox.appendChild(el('div', { class: 'warn' }, [el('div', { text: `These will replace ones you already have (same name):` }), list]));
  };
  picker.onChange(refreshWarn);
  refreshWarn();

  go.addEventListener('click', async () => {
    const sel = picker.getSelection();
    if (!sel.count) { msg(result, 'err', 'Check at least one item to import.'); return; }
    go.disabled = true;
    try {
      const cur = await readCurrent();
      const parts = [];
      const fc = countFilters(sel.filters);
      if (fc.n) {
        const merged = JSON.parse(JSON.stringify(cur.filters));
        Object.keys(sel.filters).forEach(p => { merged[p] = Object.assign(merged[p] || {}, JSON.parse(JSON.stringify(sel.filters[p]))); });
        await storageSet({ [CNO_BACKUP_FILTERS_KEY]: merged });
        parts.push(plural(fc.n, 'filter'));
      }
      if (sel.sharp.sets.length || sel.sharp.devigMethod) {
        const next = cur.sharp ? JSON.parse(JSON.stringify(cur.sharp)) : { devigMethod: 'worstcase', sets: [] };
        next.sets = next.sets || [];
        sel.sharp.sets.forEach(s => {
          const copy = JSON.parse(JSON.stringify(s));
          const i = next.sets.findIndex(c => cnoSharpSetId(c) === cnoSharpSetId(copy));
          if (i === -1) next.sets.push(copy); else next.sets[i] = copy;
        });
        if (sel.sharp.devigMethod) next.devigMethod = sel.sharp.devigMethod;
        await storageSet({ [CNO_BACKUP_SHARP_KEY]: next });
        if (sel.sharp.sets.length) parts.push(plural(sel.sharp.sets.length, 'sharp book set'));
        if (sel.sharp.devigMethod) parts.push('the devig method');
      }
      msg(result, 'ok', `Imported ${parts.join(', ')}. Reload any open CNO pages to use them.`);
      refreshWarn();
      initBackup();
      initExport();
    } catch (e) {
      msg(result, 'err', `Import failed: ${e.message || e}`);
    } finally {
      go.disabled = false;
    }
  });
}

// ---------- page ----------

async function checkUnclassified() {
  const all = await storageGet(null);
  const extra = cnoUnclassifiedStorageKeys(all);
  if (!extra.length) return;
  console.warn('CNO Helper: stored keys not covered by backup/restore (add them to a list in config.js):', extra);
  const note = $('devNote');
  note.hidden = false;
  note.textContent = `Note for the developer: these saved items aren't listed in the backup rules yet: ${extra.join(', ')}.`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== `panel-${b.dataset.tab}`; });
  }));
  if (/import|export|share/i.test(location.hash)) document.querySelector('.tabs button[data-tab="share"]').click();

  $('backupBtn').addEventListener('click', doBackup);
  $('restorePick').addEventListener('click', () => $('restoreFile').click());
  $('restoreFile').addEventListener('change', onRestoreFile);
  $('exportBtn').addEventListener('click', doExport);
  $('importPick').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', onImportFile);

  initBackup();
  initExport();
  checkUnclassified();
});
