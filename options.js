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
    hideUnusedExtraColumn: false
  }, (items) => {
    document.getElementById('enableFilterModernization').checked = items.enableFilterModernization;
    document.getElementById('enablePctBadges').checked = items.enablePctBadges;
    document.getElementById('enableInjuryBadges').checked = items.enableInjuryBadges;
    document.getElementById('enableMlbWeather').checked = items.enableMlbWeather;
    document.getElementById('enableApRankings').checked = items.enableApRankings;
    document.getElementById('hideShareLinkPane').checked = items.hideShareLinkPane;
    document.getElementById('hideReadmePane').checked = items.hideReadmePane;
    document.getElementById('hideUnusedExtraColumn').checked = items.hideUnusedExtraColumn;
  });

  // Bind change listeners to auto-save settings
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', saveOptions);
  });

  // Check GitHub for a newer release every time the options page opens
  checkForUpdates();

  // Bind popup viewers
  document.getElementById('viewChangeLog').addEventListener('click', () => {
    openTextFileModal('📋 Change Log', 'CNOsLittleHelperChangeLog.txt');
  });

  document.getElementById('viewRoadMap').addEventListener('click', () => {
    openTextFileModal('🗺️ Roadmap', 'CNOsLittleHelperRoadMap.txt');
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
    hideUnusedExtraColumn: document.getElementById('hideUnusedExtraColumn').checked
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

  statusText.textContent = 'Checking for updates...';
  instructions.style.display = 'none';

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
