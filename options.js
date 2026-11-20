// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    enableFilterModernization: true,
    enablePctBadges: true,
    enableInjuryBadges: true,
    enableMlbWeather: true,
    enableApRankings: true,
    hideShareLinkPane: false,
    hideReadmePane: false,
    hideUnusedExtraColumn: false,
    hideUnwantedGameBooks: false,
    modernizeGameTable: true,
    modernizeMainTables: true,
    mainTableDensity: 'standard',
    customSharpDevig: false,
    excludePlayerUndersDefault: false
  }, (items) => {
    document.getElementById('enableFilterModernization').checked = items.enableFilterModernization;
    document.getElementById('enablePctBadges').checked = items.enablePctBadges;
    document.getElementById('enableInjuryBadges').checked = items.enableInjuryBadges;
    document.getElementById('enableMlbWeather').checked = items.enableMlbWeather;
    document.getElementById('enableApRankings').checked = items.enableApRankings;
    document.getElementById('hideShareLinkPane').checked = items.hideShareLinkPane;
    document.getElementById('hideReadmePane').checked = items.hideReadmePane;
    document.getElementById('hideUnusedExtraColumn').checked = items.hideUnusedExtraColumn;
    document.getElementById('hideUnwantedGameBooks').checked = items.hideUnwantedGameBooks;
    document.getElementById('modernizeGameTable').checked = items.modernizeGameTable;
    document.getElementById('modernizeMainTables').checked = items.modernizeMainTables;
    document.getElementById('mainTableDensity').value = items.mainTableDensity || 'standard';
    document.getElementById('customSharpDevig').checked = items.customSharpDevig;
    document.getElementById('excludePlayerUndersDefault').checked = items.excludePlayerUndersDefault;
    syncDensityEnabled();
  });

  // Bind change listeners to auto-save settings
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', saveOptions);
  });

  // Row spacing: only usable while "Restyle Results Tables" is on
  const densitySelect = document.getElementById('mainTableDensity');
  densitySelect.addEventListener('click', (e) => e.stopPropagation()); // it sits inside the setting's <label>
  densitySelect.addEventListener('change', saveOptions);
  document.getElementById('modernizeMainTables').addEventListener('change', syncDensityEnabled);

  // Check GitHub for a newer release every time the options page opens
  checkForUpdates();

  // Bind popup viewers
  document.getElementById('viewChangeLog').addEventListener('click', () => {
    openTextFileModal('📋 Change Log', 'CNOsLittleHelperChangeLog.txt');
  });

  document.getElementById('viewRoadMap').addEventListener('click', () => {
    openTextFileModal('🗺️ Roadmap', 'CNOsLittleHelperRoadMap.txt');
  });

  document.getElementById('specifyShownBooks').addEventListener('click', (e) => {
    // The link sits inside the setting's <label>; don't let the click toggle the checkbox
    e.preventDefault();
    e.stopPropagation();
    openShownBooksModal();
  });

  // Backup / restore and import / export open in their own tab
  document.getElementById('openBackup').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('transfer.html') }));
  document.getElementById('openShare').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('transfer.html#share') }));

  // Sharp books editor opens in its own tab (it's too big for a popup)
  document.getElementById('setupSharpBooks').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.tabs.create({ url: chrome.runtime.getURL('sharp-books.html') });
  });

  document.getElementById('requestFeature').addEventListener('click', () => openFeedbackEmail('feature'));
  document.getElementById('reportBug').addEventListener('click', () => openFeedbackEmail('bug'));
});

function saveOptions() {
  const settings = {
    enableFilterModernization: document.getElementById('enableFilterModernization').checked,
    enablePctBadges: document.getElementById('enablePctBadges').checked,
    enableInjuryBadges: document.getElementById('enableInjuryBadges').checked,
    enableMlbWeather: document.getElementById('enableMlbWeather').checked,
    enableApRankings: document.getElementById('enableApRankings').checked,
    hideShareLinkPane: document.getElementById('hideShareLinkPane').checked,
    hideReadmePane: document.getElementById('hideReadmePane').checked,
    hideUnusedExtraColumn: document.getElementById('hideUnusedExtraColumn').checked,
    hideUnwantedGameBooks: document.getElementById('hideUnwantedGameBooks').checked,
    modernizeGameTable: document.getElementById('modernizeGameTable').checked,
    modernizeMainTables: document.getElementById('modernizeMainTables').checked,
    mainTableDensity: document.getElementById('mainTableDensity').value,
    customSharpDevig: document.getElementById('customSharpDevig').checked,
    excludePlayerUndersDefault: document.getElementById('excludePlayerUndersDefault').checked
  };

  chrome.storage.local.set(settings, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved!';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
}

function openTextFileModal(title, filename) {
  const existing = document.getElementById('cno-text-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'cno-text-modal';
  modal.className = 'cno-modal';

  const content = document.createElement('div');
  content.className = 'cno-modal-content';

  const header = document.createElement('div');
  header.className = 'cno-modal-header';
  header.innerHTML = `
    <h3>${title}</h3>
    <button class="cno-modal-close" id="cno-text-modal-close">✕</button>
  `;

  const body = document.createElement('div');
  body.className = 'cno-modal-body';
  body.textContent = 'Loading...';

  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);
  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  header.querySelector('#cno-text-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  window.addEventListener('keydown', function escListener(e) {
    if (e.key === 'Escape') {
      closeModal();
      window.removeEventListener('keydown', escListener);
    }
  });

  // Fetch local extension file
  const fileUrl = chrome.runtime.getURL(filename);
  fetch(fileUrl)
    .then(res => {
      if (!res.ok) throw new Error('File not found');
      return res.text();
    })
    .then(text => {
      body.textContent = text;
    })
    .catch(err => {
      body.textContent = `Unable to load ${filename}: ${err.message}`;
    });
}

// ====================================================
// UPDATE CHECK
// ====================================================

function checkForUpdates() {
  const statusText = document.getElementById('cno-version-status-text');
  const instructions = document.getElementById('cno-update-instructions');
  const githubLink = document.getElementById('cno-github-link');
  const currentVersion = chrome.runtime.getManifest().version;

  instructions.style.display = 'none';

  if (typeof CNO_IS_FIREFOX_BUILD !== 'undefined' && CNO_IS_FIREFOX_BUILD) {
    statusText.textContent = `Installed: v${currentVersion}. Updates are delivered automatically through Firefox Add-ons.`;
    return;
  }

  statusText.textContent = 'Checking for updates...';

  chrome.runtime.sendMessage({ type: 'cno-check-update' }, (result) => {
    if (chrome.runtime.lastError || !result || !result.ok) {
      statusText.textContent = `Installed: v${currentVersion}. Couldn't check for updates right now.`;
      return;
    }

    if (result.releasePageUrl) githubLink.href = result.releasePageUrl;

    if (result.updateAvailable) {
      statusText.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = `Update available: v${result.latestVersion}`;
      statusText.appendChild(strong);
      statusText.appendChild(document.createTextNode(` (installed: v${currentVersion})`));

      document.getElementById('cno-download-zip-btn').href = result.downloadUrl || result.releasePageUrl;
      document.getElementById('cno-view-release-notes').href = result.releasePageUrl;
      instructions.style.display = 'block';
    } else {
      statusText.textContent = `You're up to date (v${currentVersion}).`;
    }
  });
}

// ====================================================
// FEEDBACK (opens the Google Form in a new tab)
// ====================================================

const FEEDBACK_FORM_URLS = {
  bug: 'https://docs.google.com/forms/d/e/1FAIpQLSc3fx8DLCU2kTbFORhZIILXpiWOTJ682rasmEbRidXuiDmFsw/viewform',
  feature: 'https://docs.google.com/forms/d/e/1FAIpQLSelyD9hbcT1CJWHP-o371uIMOyRBs9S72BVTs761_PB7sqMVA/viewform?usp=publish-editor'
};

function openFeedbackEmail(kind) {
  window.open(FEEDBACK_FORM_URLS[kind] || FEEDBACK_FORM_URLS.feature, '_blank', 'noopener,noreferrer');
}

// ====================================================
// "SPECIFY SHOWN BOOKS" POPUP (game odds tables)
// ====================================================

function openShownBooksModal() {
  const existing = document.getElementById('cno-books-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'cno-books-modal';
  modal.className = 'cno-modal';

  const content = document.createElement('div');
  content.className = 'cno-modal-content';
  content.style.width = '440px';

  const header = document.createElement('div');
  header.className = 'cno-modal-header';
  header.innerHTML = `<h3>📚 Shown Books on Game Pages</h3><button class="cno-modal-close" type="button">✕</button>`;

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex; gap:6px; padding:10px 16px; border-bottom:1px solid #e2e8f0; background:#ffffff;';

  const body = document.createElement('div');
  body.className = 'cno-modal-body';
  body.style.cssText = 'font-family: inherit; white-space: normal; padding: 6px 10px 10px;';
  body.textContent = 'Loading books...';

  const footer = document.createElement('div');
  footer.style.cssText = 'padding:8px 16px; font-size:0.76rem; color:#64748b; background:#f8fafc; border-top:1px solid #e2e8f0;';
  footer.textContent = 'Unchecked books are hidden on game pages when "Hide unwanted books" is on. Changes save automatically.';

  content.appendChild(header);
  content.appendChild(toolbar);
  content.appendChild(body);
  content.appendChild(footer);
  modal.appendChild(content);
  document.body.appendChild(modal);

  const closeModal = () => { modal.remove(); window.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  header.querySelector('.cno-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', onKey);

  loadBooksList((books) => {
    if (!books.length) {
      body.textContent = "Couldn't load the book list right now. Please try again later.";
      return;
    }

    chrome.storage.local.get({ [CNO_GAME_BOOK_VIS_KEY]: {} }, (data) => {
      let visibility = data[CNO_GAME_BOOK_VIS_KEY] || {};
      const save = () => {
        chrome.storage.local.set({ [CNO_GAME_BOOK_VIS_KEY]: visibility }, () => {
          const status = document.getElementById('status');
          if (status) {
            status.textContent = 'Settings saved!';
            setTimeout(() => { status.textContent = ''; }, 1500);
          }
        });
      };

      body.innerHTML = '';
      const checks = [];
      books.forEach(book => {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex; align-items:center; gap:9px; padding:6px 8px; border-radius:5px; cursor:pointer; font-size:0.88rem; color:#0f172a;';
        row.addEventListener('mouseover', () => row.style.background = '#f0f9ff');
        row.addEventListener('mouseout', () => row.style.background = 'none');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isBookShown(book, visibility);
        cb.style.cssText = 'width:15px; height:15px; margin:0; accent-color:#0284c7; cursor:pointer;';
        cb.addEventListener('change', () => { visibility[book.shortCode] = cb.checked; save(); });

        const name = document.createElement('span');
        name.textContent = book.fullName;
        name.style.flex = '1';
        const code = document.createElement('span');
        code.textContent = book.shortCode;
        code.style.cssText = 'font-size:0.72rem; color:#94a3b8; font-weight:600;';

        row.appendChild(cb);
        row.appendChild(name);
        row.appendChild(code);
        body.appendChild(row);
        checks.push({ cb, book });
      });

      const makeBtn = (text, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = 'flex:1; padding:5px 8px; font-size:0.78rem; font-weight:700; color:#0369a1; background:#ffffff; border:1px solid #cbd5e1; border-radius:5px; cursor:pointer;';
        b.addEventListener('click', onClick);
        return b;
      };
      toolbar.appendChild(makeBtn('Select all', () => {
        checks.forEach(({ cb, book }) => { cb.checked = true; visibility[book.shortCode] = true; });
        save();
      }));
      toolbar.appendChild(makeBtn('Select none', () => {
        checks.forEach(({ cb, book }) => { cb.checked = false; visibility[book.shortCode] = false; });
        save();
      }));
      toolbar.appendChild(makeBtn('Reset to defaults', () => {
        visibility = {};
        checks.forEach(({ cb, book }) => { cb.checked = book.showByDefault; });
        save();
      }));
    });
  });
}

function syncDensityEnabled() {
  const on = document.getElementById('modernizeMainTables').checked;
  document.getElementById('mainTableDensity').disabled = !on;
}
