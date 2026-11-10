// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({
    enableFilterModernization: true,
    enablePctBadges: true,
    enableInjuryBadges: true,
    enableMlbWeather: true,
    enableApRankings: true
  }, (items) => {
    document.getElementById('enableFilterModernization').checked = items.enableFilterModernization;
    document.getElementById('enablePctBadges').checked = items.enablePctBadges;
    document.getElementById('enableInjuryBadges').checked = items.enableInjuryBadges;
    document.getElementById('enableMlbWeather').checked = items.enableMlbWeather;
    document.getElementById('enableApRankings').checked = items.enableApRankings;
  });

  // Bind change listeners to auto-save settings
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', saveOptions);
  });

  // Bind popup viewers
  document.getElementById('viewChangeLog').addEventListener('click', () => {
    openTextFileModal('📋 Change Log', 'CNOsLittleHelperChangeLog.txt');
  });

  document.getElementById('viewRoadMap').addEventListener('click', () => {
    openTextFileModal('🗺️ Roadmap', 'CNOsLittleHelperRoadMap.txt');
  });
});

function saveOptions() {
  const settings = {
    enableFilterModernization: document.getElementById('enableFilterModernization').checked,
    enablePctBadges: document.getElementById('enablePctBadges').checked,
    enableInjuryBadges: document.getElementById('enableInjuryBadges').checked,
    enableMlbWeather: document.getElementById('enableMlbWeather').checked,
    enableApRankings: document.getElementById('enableApRankings').checked
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