// ====================================================
// MAIN TABLE CONVERSION & GAME HEADER TOOLTIPS
// ====================================================

const BOOK_HEADER_FULLNAME_MAP = {
  'FD': 'FanDuel',
  'FDYW': 'FanDuel YourWay',
  'DK': 'DraftKings',
  'CZR': 'Caesars',
  'MGM': 'BetMGM',
  'MGM-ON': 'BetMGM (ON)',
  'BR': 'BetRivers',
  'BB': 'Bally Bet',
  'TSB': 'theScore Bet',
  'B365': 'Bet365',
  'PB': 'PointsBet',
  'FN': 'Fanatics',
  'HR-IN': 'Hard Rock (AZ, CO, IN, MI, ON, NJ, TN, VA)',
  'HR-FL': 'Hard Rock (FL)',
  'HR-IL': 'Hard Rock (IL)',
  'HR-OH': 'Hard Rock (OH)',
  'FL': 'Fliff',
  'BV': 'Bovada',
  'BO': 'BetOnline',
  'CS': 'Circa Sports (NV)',
  'PN': 'Pinnacle',
  'PX': 'ProphetX',
  'NV': 'Novig',
  'KI': 'Kalshi',
  'KM': 'Kambi',
  'ST-NJ': 'SportsTrade (NJ)',
  'ST-CO': 'SportsTrade (CO)',
  'ST-IA': 'SportsTrade (IA)',
  'ST-AZ': 'SportsTrade (AZ)',
  'ST-VA': 'SportsTrade (VA)',
  'PPF': 'PrizePicks (5/6 Leg Flex)',
  'PPP': 'PrizePicks (2 Leg Power)'
};

function annotateGameHeaderTooltips() {
  if (!window.location.pathname.toLowerCase().includes('game.aspx')) return;

  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table) return;

  const headerCells = table.querySelectorAll('thead th');
  headerCells.forEach(th => {
    if (th.dataset.hasHeaderTooltip) return;

    const shortCode = th.textContent.trim().toUpperCase();
    const fullName = BOOK_HEADER_FULLNAME_MAP[shortCode];

    if (fullName) {
      th.title = fullName;
      th.style.cursor = 'help';
    }
    th.dataset.hasHeaderTooltip = "true";
  });
}

function processOddsTable() {
  // Percentage badges were removed from the table pages (including game.aspx);
  // they now only appear in the calculator popups (see injectModalBadges).
  annotateGameHeaderTooltips();
}

// ====================================================
// MODAL ENHANCEMENTS & DEVIGGER LINK
// ====================================================

function processCalcPopup() {
  const popup = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_PanelPopupCalc');
  if (!popup || popup.style.display === 'none' || popup.offsetWidth === 0) return;

  updateDeviggerLink(popup);
  
  if (userSettings.enablePctBadges) {
    injectModalBadges();
  } else {
    popup.querySelectorAll('.cno-badge').forEach(b => b.remove());
  }
}

// Returns only the element's own text nodes, ignoring child elements such as
// the injected .cno-badge. Prevents the badge text from being read back as odds.
function getOwnText(el) {
  let t = '';
  el.childNodes.forEach(n => {
    if (n.nodeType === Node.TEXT_NODE) t += n.textContent;
  });
  return t.trim();
}

function updateDeviggerLink(popup) {
  const activeTab = popup.querySelector('.ajax__tab_panel[style*="visible"], .ajax__tab_panel[style*="block"]') || popup;

  // Two-bet (hedge) calculators, as on Low Hold, Arbitrage or a Hedge profit strategy, have no fair
  // value, so there's nothing to devig: only show the button when the visible calculator has Fair Odds.
  let fairOdds = '';
  const fairEl = activeTab.querySelector('#PopupCalc_EVTab_FairOdds, #PopupCalc_FairOdds');
  if (fairEl) {
    fairOdds = getOwnText(fairEl).replace('+', '').trim();
    if (!/^-?\d+$/.test(fairOdds)) fairOdds = '';
  }

  if (!fairOdds) {
    popup.querySelectorAll('.cno-devigger-link').forEach(el => el.remove());
    return;
  }

  let finalOdds = '';
  const oddsInput = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_EV_TextBoxPopupCalc_EVTab_BetOdds') ||
                    document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_EV_TextBoxPopupCalc_BetOdds') ||
                    document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_Hedge_TextBoxPopupCalc_HedgeTab_Primary_BetOdds') ||
                    document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_TextBoxPopupCalc_LowHold_BetOdds');

  if (oddsInput) {
    finalOdds = oddsInput.value.trim().replace('+', '');

    if (!oddsInput.dataset.hasDeviggerListener) {
      oddsInput.addEventListener('input', () => processCalcPopup());
      oddsInput.dataset.hasDeviggerListener = "true";
    }
  }

  let boostVal = '';
  const boostEl = document.getElementById('SpanPopupCalc_EVTab_Boost') || 
                  document.getElementById('SpanPopupCalc_HedgeTab_Primary_Boost') ||
                  document.getElementById('SpanPopupCalc_Boost');

  if (boostEl) {
    const txt = boostEl.textContent.trim();
    if (txt && txt !== '-' && !isNaN(parseFloat(txt))) {
      boostVal = txt;
    }
  }

  if (!fairOdds || !finalOdds) return;

  let deviggerUrl = `http://crazyninjamike.com/Public/sportsbooks/sportsbook_devigger.aspx?autofill=1&LegOdds=${encodeURIComponent(fairOdds)}&FinalOdds=${encodeURIComponent(finalOdds)}`;
  if (boostVal) {
    deviggerUrl += `&Boost_Bool=1&Boost_Text=${encodeURIComponent(boostVal)}&Boost_Type=0`;
  }

  const table = activeTab.querySelector('table');
  if (!table) return;

  let linkContainer = activeTab.querySelector('.cno-devigger-link');
  if (!linkContainer) {
    linkContainer = document.createElement('div');
    linkContainer.className = 'cno-devigger-link';
    linkContainer.style.cssText = 'margin: 4px 0 8px 0; text-align: center;';
    table.parentNode.insertBefore(linkContainer, table);
  }

  // The popup puts a blank line (two <br>s) before its table; drop the second one so the
  // button sits right under the market line instead of after an empty line.
  const prevElementSkippingText = (node) => {
    let n = node.previousSibling;
    while (n && n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) n = n.previousSibling;
    return n;
  };
  const brBefore = prevElementSkippingText(linkContainer);
  if (brBefore && brBefore.tagName === 'BR') {
    const brBeforeThat = prevElementSkippingText(brBefore);
    if (brBeforeThat && brBeforeThat.tagName === 'BR') brBefore.style.display = 'none';
  }

  const existingLink = linkContainer.querySelector('a.cno-devigger-btn');
  if (existingLink && existingLink.getAttribute('href') === deviggerUrl) return;
  linkContainer.innerHTML = `<a href="${deviggerUrl}" target="_blank" rel="noopener" class="cno-devigger-btn">Open in Devigger <span aria-hidden="true">↗</span></a>`;
}

function injectModalBadges() {
  const targetBooks = ['novig', 'kalshi', 'prophetx', 'kambi', 'px', 'km'];

  const checkAndApplyBadge = (bookElementId, fieldId, isInput = false) => {
    const bookEl = document.getElementById(bookElementId);
    if (!bookEl) return;

    const bookText = bookEl.textContent.trim().toLowerCase();
    const isTargetBook = targetBooks.some(b => bookText.includes(b));
    const isProphetX = bookText.includes('prophetx') || bookText.includes('px');
    const el = document.getElementById(fieldId);

    if (!el) return;
    const parent = isInput ? el.parentNode : el;

    if (!isTargetBook) {
      const oldBadge = parent.querySelector('.cno-badge');
      if (oldBadge) oldBadge.remove();
      delete el.dataset.lastSeenOdds;
      return;
    }

    const currentOddsVal = isInput ? el.value.trim() : getOwnText(el);
    const currentPct = americanToPercentage(currentOddsVal);

    if (el.dataset.lastSeenOdds !== currentOddsVal) {
      el.dataset.lastSeenOdds = currentOddsVal;
      let existingBadge = parent.querySelector('.cno-badge');

      if (existingBadge) {
        if (currentPct) {
          if (existingBadge.tagName === 'INPUT') {
            existingBadge.value = `${currentPct}%`;
          } else {
            existingBadge.textContent = `${currentPct}%`;
          }
          if (isProphetX) {
            const preComm = calculatePreCommissionPct(currentPct);
            if (preComm) existingBadge.title = `${preComm}% pre-commission`;
          } else {
            existingBadge.removeAttribute('title');
          }
        } else {
          existingBadge.remove();
        }
      } else if (currentPct) {
        const span = document.createElement('span');
        span.innerHTML = isInput ? createBadgeInput(currentPct, isProphetX) : createBadgeStatic(currentPct, false, isProphetX);
        parent.appendChild(span.firstChild);
      }
    }

    if (isInput && !el.dataset.hasTwoWayBinding) {
      el.dataset.hasTwoWayBinding = "true";

      el.addEventListener('input', () => {
        const newPct = americanToPercentage(el.value.trim());
        const badge = parent.querySelector('.cno-badge');
        if (badge && newPct) {
          if (document.activeElement !== badge) {
            badge.value = `${newPct}%`;
          }
          if (isProphetX) {
            const preComm = calculatePreCommissionPct(newPct);
            if (preComm) badge.title = `${preComm}% pre-commission`;
          }
        }
        el.dataset.lastSeenOdds = el.value.trim();
      });

      const badgeInput = parent.querySelector('input.cno-badge-input');
      if (badgeInput) {
        badgeInput.addEventListener('input', () => {
          const cleanedPct = badgeInput.value.replace('%', '').trim();
          const newAmerican = percentageToAmerican(cleanedPct);
          if (newAmerican) {
            el.value = newAmerican;
            el.dataset.lastSeenOdds = newAmerican;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (isProphetX) {
            const preComm = calculatePreCommissionPct(cleanedPct);
            if (preComm) badgeInput.title = `${preComm}% pre-commission`;
          }
        });

        badgeInput.addEventListener('blur', () => {
          const cleanedPct = badgeInput.value.replace('%', '').trim();
          if (!isNaN(parseFloat(cleanedPct)) && parseFloat(cleanedPct) > 0) {
            badgeInput.value = `${parseFloat(cleanedPct).toFixed(1)}%`;
          }
        });
      }
    }
  };

  checkAndApplyBadge('PopupCalc_EVTab_SportsbookSite', 'PopupCalc_EVTab_FairOdds');
  checkAndApplyBadge('PopupCalc_SportsbookSite', 'PopupCalc_FairOdds');
  
  checkAndApplyBadge('PopupCalc_EVTab_SportsbookSite', 'ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_EV_TextBoxPopupCalc_EVTab_BetOdds', true);
  checkAndApplyBadge('PopupCalc_SportsbookSite', 'ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_EV_TextBoxPopupCalc_BetOdds', true);
  
  checkAndApplyBadge('PopupCalc_EVTab_SportsbookSite', 'SpanPopupCalc_EVTab_BoostedOdds');
  checkAndApplyBadge('PopupCalc_SportsbookSite', 'SpanPopupCalc_BoostedOdds');

  checkAndApplyBadge('PopupCalc_HedgeTab_Primary_SportsbookSite', 'ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_Hedge_TextBoxPopupCalc_HedgeTab_Primary_BetOdds', true);
  checkAndApplyBadge('PopupCalc_HedgeTab_Primary_SportsbookSite', 'SpanPopupCalc_HedgeTab_Primary_BoostedOdds');
  checkAndApplyBadge('PopupCalc_HedgeTab_Primary_SportsbookSite', 'ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_Hedge_TextBoxPopupCalc_HedgeTab_Hedge_BetOdds', true);

  checkAndApplyBadge('PopupCalc_LowHold_SportsbookSite', 'ContentPlaceHolderMain_ContentPlaceHolderRight_TextBoxPopupCalc_LowHold_BetOdds', true);
  checkAndApplyBadge('PopupCalc_Hedge_SportsbookSite', 'ContentPlaceHolderMain_ContentPlaceHolderRight_TextBoxPopupCalc_Hedge_BetOdds', true);
}

// ====================================================
// GAME.ASPX RIGHT-CLICK DEVIGGER
// ====================================================

function extractAmericanOdds(text) {
  if (!text) return null;
  const match = text.match(/([+-]\d{3,5})/);
  return match ? match[1] : null;
}

function addGameDeviggerCheckbox() {
  if (!window.location.pathname.toLowerCase().includes('game.aspx')) return;
  if (document.getElementById('cno-wrap-rightclick-devig')) return;

  const deepLinksInput = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_CheckBoxDeepLinkOddsScreen');
  const deepLinksLabel = document.querySelector('label[for="ContentPlaceHolderMain_ContentPlaceHolderRight_CheckBoxDeepLinkOddsScreen"]');
  if (!deepLinksInput || !deepLinksLabel) return;

  const isChecked = localStorage.getItem('cno_enable_rightclick_devig') !== 'false';

  const wrapper = document.createElement('span');
  wrapper.id = 'cno-wrap-rightclick-devig';
  wrapper.style.cssText = 'margin-left: 14px; display: inline; vertical-align: middle;';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'cno-checkbox-rightclick-devig';
  checkbox.checked = isChecked;
  checkbox.style.cssText = 'margin: 0 3px 0 0; vertical-align: middle; cursor: pointer;';

  checkbox.addEventListener('change', () => {
    localStorage.setItem('cno_enable_rightclick_devig', checkbox.checked.toString());
  });

  const label = document.createElement('label');
  label.htmlFor = 'cno-checkbox-rightclick-devig';
  label.textContent = 'Enable right-click to devig';
  
  const nativeStyle = window.getComputedStyle(deepLinksLabel);
  label.style.cssText = `
    cursor: pointer;
    vertical-align: middle;
    font-family: ${nativeStyle.fontFamily};
    font-size: ${nativeStyle.fontSize};
    font-weight: ${nativeStyle.fontWeight};
    color: ${nativeStyle.color};
  `;

  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);

  deepLinksLabel.parentNode.insertBefore(wrapper, deepLinksLabel.nextSibling);
}

function setupGameRightClickDevigger() {
  if (!window.location.pathname.toLowerCase().includes('game.aspx')) return;

  document.addEventListener('click', () => {
    const existingMenu = document.getElementById('cno-context-menu');
    if (existingMenu) existingMenu.remove();
  });

  const targetTable = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!targetTable || targetTable.dataset.hasRightClick) return;

  targetTable.dataset.hasRightClick = "true";

  targetTable.addEventListener('contextmenu', (e) => {
    const isEnabled = localStorage.getItem('cno_enable_rightclick_devig') !== 'false';
    if (!isEnabled) return;

    const targetCell = e.target.closest('td');
    if (!targetCell) return;

    const row = targetCell.closest('tr');
    if (!row) return;

    let fairOdds = '';
    let cellOdds = extractAmericanOdds(targetCell.textContent);

    if (!cellOdds) return;

    if (!row.classList.contains('footable-row-detail')) {
      const fairCell = row.children[2];
      if (fairCell) {
        fairOdds = extractAmericanOdds(fairCell.textContent);
      }
    } else {
      const detailDivs = row.querySelectorAll('.footable-row-detail-inner > div');
      detailDivs.forEach(div => {
        if (div.textContent.includes('Fair Odds')) {
          fairOdds = extractAmericanOdds(div.textContent);
        }
      });
    }

    if (!fairOdds || !cellOdds) return;

    e.preventDefault();

    const existingMenu = document.getElementById('cno-context-menu');
    if (existingMenu) existingMenu.remove();

    const deviggerUrl = `http://crazyninjamike.com/Public/sportsbooks/sportsbook_devigger.aspx?autofill=1&LegOdds=${encodeURIComponent(fairOdds)}&FinalOdds=${encodeURIComponent(cellOdds)}`;

    const menu = document.createElement('div');
    menu.id = 'cno-context-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${e.clientY}px;
      left: ${e.clientX}px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      z-index: 999999;
      padding: 4px 0;
      min-width: 150px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const menuItem = document.createElement('a');
    menuItem.href = deviggerUrl;
    menuItem.target = '_blank';
    menuItem.textContent = '⚡ Devig to FV';
    menuItem.style.cssText = `
      display: block;
      padding: 6px 12px;
      color: #0369a1;
      font-weight: 600;
      font-size: 0.8rem;
      text-decoration: none;
      cursor: pointer;
    `;

    menuItem.addEventListener('mouseover', () => menuItem.style.background = '#f0f9ff');
    menuItem.addEventListener('mouseout', () => menuItem.style.background = 'transparent');

    menu.appendChild(menuItem);
    document.body.appendChild(menu);
  });
}


function openInstallInstructionsModal() {
  const existing = document.getElementById('cno-install-instructions-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'cno-install-instructions-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(2px);
    z-index: 1000002; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: #ffffff; border-radius: 8px; width: 440px; max-width: 90vw;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2); border: 1px solid #e2e8f0; overflow: hidden;
  `;
  box.innerHTML = `
    <div style="padding:14px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0; font-size:1.05rem; color:#0284c7; font-weight:700;">How to install the update</h3>
      <button type="button" id="cno-install-modal-close" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;">\u2715</button>
    </div>
    <div style="padding:14px 16px; font-size:0.9rem; color:#334155; line-height:1.5;">
      <ol style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:8px;">
        <li>Download the .zip and extract it to a folder.</li>
        <li>Open <code style="background:#f1f5f9; padding:1px 5px; border-radius:3px;">chrome://extensions/</code> and turn on <strong>Developer mode</strong>.</li>
        <li>Click <strong>Load unpacked</strong> and select the extracted folder (remove the old version first).</li>
      </ol>
    </div>
  `;
  modal.appendChild(box);

  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

  box.querySelector('#cno-install-modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', onKey, true);

  document.body.appendChild(modal);
}

// Compares dotted version strings (e.g. "1.1.8" vs "1.1.7")
function cnoIsVersionHigher(latest, current) {
  if (!latest || !current) return false;
  const p1 = String(latest).split('.').map(Number);
  const p2 = String(current).split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const v1 = p1[i] || 0;
    const v2 = p2[i] || 0;
    if (v1 > v2) return true;
    if (v1 < v2) return false;
  }
  return false;
}

const CNO_UPDATE_DISMISS_KEY = 'cno_dismissed_update_version';

// One-time cleanup of the old permanent dismissal that used to be saved in extension storage
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.remove(CNO_UPDATE_DISMISS_KEY);
}

function cnoGetDismissedUpdateVersion() {
  try { return sessionStorage.getItem(CNO_UPDATE_DISMISS_KEY); } catch (e) { return null; }
}

function processUpdateBannerAlert() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.local.get(['updateAvailable', 'latestVersion', 'releasePageUrl'], (data) => {
    const existingBanner = document.getElementById('cno-update-banner-alert');

    // Judge by the stored latest version against the installed one, not just the stored flag,
    // so a stale flag (e.g. after the installed version changed) can't hide or wrongly show the banner
    const installedVersion = chrome.runtime.getManifest().version;
    if (!data.latestVersion || !cnoIsVersionHigher(data.latestVersion, installedVersion)) {
      if (existingBanner) existingBanner.remove();
      return;
    }

    if (cnoGetDismissedUpdateVersion() === data.latestVersion) {
      if (existingBanner) existingBanner.remove();
      return;
    }

    const targetContainer = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelServerInfo');
    if (!targetContainer || existingBanner) return;

    const currentVersion = chrome.runtime.getManifest().version;
    const iconUrl = chrome.runtime.getURL('icons/icon16.png');
    const releaseUrl = data.releasePageUrl || 'https://github.com/tsarstruckphl/CNOsLittleHelper/releases/latest';

    const banner = document.createElement('div');
    banner.id = 'cno-update-banner-alert';
    banner.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-left: 5px solid #0284c7;
      border-radius: 6px;
      padding: 8px 12px;
      margin: 10px 0 14px 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 0.88rem;
      color: #0c4a6e;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${iconUrl}" width="16" height="16" alt="CNO Helper" style="vertical-align: middle; flex-shrink: 0;" />
        <span>
          <strong>CNO's Little Helper Update Available!</strong> 
          Version <strong>v${data.latestVersion}</strong> is available (Installed: v${currentVersion}).
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
        <a href="#" id="cno-install-instructions-link" style="color: #0369a1; font-weight: 600; font-size: 0.82rem; text-decoration: underline;">Instructions to install</a>
        <a href="${releaseUrl}" target="_blank" style="background: #0284c7; color: #ffffff; padding: 4px 10px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 0.82rem;">Download Update ↗</a>
        <button id="cno-dismiss-update-btn" style="background: none; border: none; font-size: 1.1rem; color: #64748b; cursor: pointer; padding: 0 4px;" title="Dismiss for session">✕</button>
      </div>
    `;

    targetContainer.parentNode.insertBefore(banner, targetContainer.nextSibling);

    document.getElementById('cno-install-instructions-link').addEventListener('click', (e) => {
      e.preventDefault();
      openInstallInstructionsModal();
    });

    document.getElementById('cno-dismiss-update-btn').addEventListener('click', () => {
      try { sessionStorage.setItem(CNO_UPDATE_DISMISS_KEY, data.latestVersion); } catch (e) { /* ignore */ }
      banner.remove();
    });
  });
}

// ====================================================
// DISMISSIBLE CRAZYNINJAMIKE NOTICE (red message after the "+ev bets:" header)
// ====================================================

const CNO_NOTICE_LABEL_ID = 'ContentPlaceHolderMain_ContentPlaceHolderRight_LabelRedMessage';
const CNO_NOTICE_STORAGE_KEY = 'cno_dismissed_notice';
let cnoDismissedNotice = null;
let cnoDismissedNoticeLoaded = false;

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get([CNO_NOTICE_STORAGE_KEY], (data) => {
    cnoDismissedNotice = (data && typeof data[CNO_NOTICE_STORAGE_KEY] === 'string') ? data[CNO_NOTICE_STORAGE_KEY] : null;
    cnoDismissedNoticeLoaded = true;
    processNoticeDismiss();
  });

  // Keep multiple open CNO tabs in sync
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(CNO_NOTICE_STORAGE_KEY in changes)) return;
    const nv = changes[CNO_NOTICE_STORAGE_KEY].newValue;
    cnoDismissedNotice = typeof nv === 'string' ? nv : null;
    processNoticeDismiss();
  });
} else {
  cnoDismissedNoticeLoaded = true;
}

function getNoticeText(label) {
  return label.textContent.replace(/\s+/g, ' ').trim();
}

function processNoticeDismiss() {
  if (!cnoDismissedNoticeLoaded) return;

  const label = document.getElementById(CNO_NOTICE_LABEL_ID);
  const existingBtn = document.getElementById('cno-notice-dismiss-btn');
  const existingShow = document.getElementById('cno-notice-show-link');

  const removeControls = () => {
    if (existingBtn) existingBtn.remove();
    if (existingShow) existingShow.remove();
  };

  if (!label) {
    removeControls();
    return;
  }

  // content.css hides the notice until this flag is set, so a dismissed notice never flashes on load.
  label.dataset.cnoNoticeChecked = 'true';

  const text = getNoticeText(label);
  if (!text) {
    removeControls();
    label.style.display = '';
    return;
  }

  // Site error messages (e.g. "Error Code 0: Network error detected...") always show and can't be dismissed.
  // The saved dismissal is left alone, so a dismissed notice stays hidden once the error clears.
  if (/^error\b/i.test(text)) {
    removeControls();
    label.style.display = '';
    return;
  }

  const isDismissed = (text === cnoDismissedNotice);

  if (isDismissed) {
    label.style.display = 'none';
    if (existingBtn) existingBtn.remove();

    if (!existingShow) {
      const link = document.createElement('span');
      link.id = 'cno-notice-show-link';
      link.setAttribute('role', 'button');
      link.textContent = 'Show CrazyNinjaMike notice';
      link.style.cssText = 'color:#0284c7; cursor:pointer; font-size:0.8em; font-weight:600; text-decoration:underline; margin-left:8px;';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        cnoDismissedNotice = null;
        chrome.storage.local.remove(CNO_NOTICE_STORAGE_KEY);
        processNoticeDismiss();
      });
      label.parentNode.insertBefore(link, label);
    }
  } else {
    label.style.display = '';
    if (existingShow) existingShow.remove();

    if (!existingBtn) {
      const btn = document.createElement('span');
      btn.id = 'cno-notice-dismiss-btn';
      btn.setAttribute('role', 'button');
      btn.title = 'Dismiss this notice until it changes';
      btn.textContent = '\u2715';
      btn.style.cssText = 'color:#64748b; cursor:pointer; font-size:0.9em; font-weight:bold; margin-left:8px; padding:0 4px; border:1px solid #cbd5e1; border-radius:3px; background:#f8fafc;';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentLabel = document.getElementById(CNO_NOTICE_LABEL_ID);
        if (!currentLabel) return;
        cnoDismissedNotice = getNoticeText(currentLabel);
        chrome.storage.local.set({ [CNO_NOTICE_STORAGE_KEY]: cnoDismissedNotice });
        processNoticeDismiss();
      });
      label.parentNode.insertBefore(btn, label);
    }
  }
}

// ====================================================
// OPTIONAL HIDING OF "SHARE LINK" / "README" ACCORDION PANES
// ====================================================

// Returns how many of the two panes were found (so callers know when the accordion is fully parsed)
function processAccordionPanes() {
  if (typeof userSettingsLoaded === 'undefined' || !userSettingsLoaded) return 0;

  const accordion = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion');
  if (!accordion) return 0;

  const hideByTitle = {
    'share link': !!userSettings.hideShareLinkPane,
    'readme': !!userSettings.hideReadmePane
  };

  let found = 0;
  Array.from(accordion.children).forEach(child => {
    if (!child.classList.contains('accordionHeader') && !child.classList.contains('accordionHeaderSelected')) return;

    const title = child.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!(title in hideByTitle)) return;
    found++;

    // A class (not inline style) is used so the accordion's own open/close styling is left untouched
    child.classList.toggle('cno-hide-pane', hideByTitle[title]);
    const content = child.nextElementSibling;
    if (content) content.classList.toggle('cno-hide-pane', hideByTitle[title]);
  });

  return found;
}

// Apply as soon as the accordion is parsed, so the panes don't flash before being hidden
(function observeAccordionPanes() {
  if (typeof MutationObserver === 'undefined') return;
  const obs = new MutationObserver(() => {
    if (processAccordionPanes() >= 2) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => obs.disconnect());
})();

// ====================================================
// MODERN UI HELPERS (Update button styling + tighter vertical spacing)
// ====================================================

// Adds/removes a root class that content.css keys off, so the look follows the "Modernized Filter Panel UI" setting
function applyModernUiClass() {
  if (typeof userSettingsLoaded === 'undefined' || !userSettingsLoaded) return;
  document.documentElement.classList.toggle('cno-modern-ui', !!userSettings.enableFilterModernization);
}

// Marks the <br> spacers sitting directly above the Update panel so the modern CSS can collapse them
function processModernSpacing() {
  const panel = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelGridView');
  if (!panel) return;

  let el = panel.previousElementSibling;
  while (el) {
    if (el.tagName === 'BR') {
      el.classList.add('cno-tight-br');
    } else if (!(el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.id === 'cno-support-callout')) {
      break;
    }
    el = el.previousElementSibling;
  }
}
