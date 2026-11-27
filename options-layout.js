// Options page layout: one section at a time (picked in the sidebar, kept in the address as
// #section), a search box that shows matching settings from every section, and the version
// status mirrored in the sidebar.
(function () {
  const sections = Array.from(document.querySelectorAll('.opt-section'));
  const navLinks = Array.from(document.querySelectorAll('[data-section]'));
  const search = document.getElementById('optSearch');
  const empty = document.getElementById('searchEmpty');
  const content = document.querySelector('.content');

  // Number of settings in each section, next to its name
  document.querySelectorAll('.side-nav a[data-section]').forEach(a => {
    const sec = document.getElementById(a.dataset.section);
    const n = sec ? sec.querySelectorAll('input.switch').length : 0;
    const c = a.querySelector('.nav-count');
    if (c) c.textContent = n ? String(n) : '';
  });

  function show(key) {
    if (!sections.some(s => s.id === key)) key = sections[0].id;
    sections.forEach(s => s.classList.toggle('shown', s.id === key));
    navLinks.forEach(a => a.classList.toggle('active', a.dataset.section === key && a.closest('.side-nav')));
    return key;
  }

  // From the address: a section (#tables) or something inside one (#cno-version-card)
  function fromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    const sec = el ? (el.classList.contains('opt-section') ? el : el.closest('.opt-section')) : null;
    show(sec ? sec.id : sections[0].id);
    if (el && sec && el !== sec) setTimeout(() => el.scrollIntoView({ block: 'start' }), 0);
  }

  navLinks.forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    if (search.value) { search.value = ''; runSearch(); }
    const key = show(a.dataset.section);
    history.replaceState(null, '', `#${key}`);
    window.scrollTo(0, 0);
  }));
  window.addEventListener('hashchange', fromHash);

  // Search: every section, only the matching settings
  function runSearch() {
    const q = search.value.trim().toLowerCase();
    content.classList.toggle('searching', !!q);
    if (!q) {
      document.querySelectorAll('.opt-section .setting-item').forEach(it => { it.hidden = false; });
      document.querySelectorAll('.about-links, .cno-version-card, .cno-support-card').forEach(el => { el.hidden = false; });
      empty.hidden = true;
      fromHash();
      return;
    }
    let any = false;
    navLinks.forEach(a => a.classList.remove('active'));
    sections.forEach(sec => {
      let hit = false;
      sec.querySelectorAll('.setting-item').forEach(it => {
        const m = it.textContent.toLowerCase().includes(q);
        it.hidden = !m;
        if (m) hit = true;
      });
      // About: shown as a whole when its words match
      sec.querySelectorAll('.about-links, .cno-version-card, .cno-support-card').forEach(el => {
        const m = sec.textContent.toLowerCase().includes(q);
        el.hidden = !m;
        if (m) hit = true;
      });
      sec.classList.toggle('shown', hit);
      if (hit) any = true;
    });
    empty.hidden = any;
  }
  search.addEventListener('input', runSearch);
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { search.value = ''; runSearch(); } });

  // Version status in the sidebar (copied from the About section's update card)
  const status = document.getElementById('cno-version-status-text');
  const side = document.querySelector('.side-version');
  const sideText = document.getElementById('sideVersionText');
  const instructions = document.getElementById('cno-update-instructions');
  function syncVersion() {
    if (!status || !side) return;
    const text = status.textContent.replace(/\s+/g, ' ').trim();
    const update = /update available/i.test(text);
    const v = (text.match(/v\d+(?:\.\d+)+/) || [''])[0];
    let short = text;
    if (update) short = `Update available${v ? `: ${v}` : ''}`;
    else if (/up to date/i.test(text)) short = `${v} · up to date`;
    else if (/couldn't check/i.test(text)) short = `${v} · couldn't check for updates`;
    else if (/firefox/i.test(text)) short = `${v} · updates through Firefox Add-ons`;
    sideText.textContent = short;
    side.classList.toggle('update', update);
    side.classList.toggle('ok', !update && /up to date|firefox/i.test(text));
  }
  if (status) {
    new MutationObserver(syncVersion).observe(status, { childList: true, characterData: true, subtree: true });
    if (instructions) new MutationObserver(syncVersion).observe(instructions, { attributes: true, attributeFilter: ['style'] });
    syncVersion();
  }

  fromHash();
})();
