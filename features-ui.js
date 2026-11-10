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
  const isGamePage = window.location.pathname.toLowerCase().includes('game.aspx');
  const targetBooks = ['novig', 'kalshi', 'prophetx', 'kambi', 'nv', 'ki', 'px', 'km'];

  annotateGameHeaderTooltips();

  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (table) {
    const headerCells = Array.from(table.querySelectorAll('thead th'));
    const targetColIndexes = [];

    // 1) Direct book matrix columns (e.g. Game page header columns)
    headerCells.forEach((th, idx) => {
      const txt = th.textContent.trim().toUpperCase();
      if (['NV', 'KI', 'PX', 'KM', 'NOVIG', 'KALSHI', 'PROPHETX', 'KAMBI'].includes(txt)) {
        targetColIndexes.push({
          index: idx,
          isProphetX: (txt === 'PX' || txt === 'PROPHETX')
        });
      }
    });

    const rows = table.querySelectorAll('tbody tr:not(.footable-row-detail)');

    if (targetColIndexes.length > 0) {
      rows.forEach(row => {
        targetColIndexes.forEach(colObj => {
          const cell = row.children[colObj.index];
          if (cell) convertOddsInContainer(cell, isGamePage, colObj.isProphetX);
        });
      });
    } else {
      // 2) Multi-book row-based tables (Free Bet, Risk Free Bet, EV, Low Hold, Boost, Arb, etc.)
      const sbColIndexes = [];
      const oddsColIndexes = [];

      headerCells.forEach((th, idx) => {
        const txt = th.textContent.trim().toLowerCase();
        if (txt.includes('sportsbook') || txt.includes('book') || txt.includes('site')) {
          sbColIndexes.push(idx);
        }
        if (txt.includes('odds') || txt.includes('line') || txt.includes('price')) {
          oddsColIndexes.push(idx);
        }
      });

      // Pair each sportsbook column with its closest odds column (checking both left and right)
      const pairedCols = [];
      if (sbColIndexes.length > 0 && oddsColIndexes.length > 0) {
        sbColIndexes.forEach(sbIdx => {
          let closestOddsIdx = oddsColIndexes[0];
          let minDistance = Math.abs(sbIdx - closestOddsIdx);

          oddsColIndexes.forEach(oIdx => {
            const distance = Math.abs(sbIdx - oIdx);
            if (distance < minDistance) {
              minDistance = distance;
              closestOddsIdx = oIdx;
            }
          });

          pairedCols.push({ sbIdx, oddsIdx: closestOddsIdx });
        });
      } else {
        // Fallback for standard 2-book tables if dynamic pairing falls back
        pairedCols.push({ sbIdx: 9, oddsIdx: 8 });
        pairedCols.push({ sbIdx: 12, oddsIdx: 11 });
      }

      rows.forEach(row => {
        const cells = Array.from(row.children);
        pairedCols.forEach(({ sbIdx, oddsIdx }) => {
          const sportsbookCell = cells[sbIdx];
          const oddsCell = cells[oddsIdx];

          if (sportsbookCell && oddsCell) {
            const bookLink = sportsbookCell.querySelector('a');
            const cellText = (bookLink ? bookLink.textContent : sportsbookCell.textContent).trim().toLowerCase();

            const isTargetBook = targetBooks.some(book => {
              if (cellText === book) return true;
              if (book === 'novig' && cellText.includes('novig')) return true;
              if (book === 'kalshi' && cellText.includes('kalshi')) return true;
              if (book === 'prophetx' && cellText.includes('prophetx')) return true;
              if (book === 'kambi' && cellText.includes('kambi')) return true;
              if (book === 'nv' && (cellText === 'nv' || cellText.startsWith('nv '))) return true;
              if (book === 'ki' && (cellText === 'ki' || cellText.startsWith('ki '))) return true;
              if (book === 'px' && (cellText === 'px' || cellText.startsWith('px '))) return true;
              if (book === 'km' && (cellText === 'km' || cellText.startsWith('km '))) return true;
              return false;
            });

            if (isTargetBook) {
              const isProphetX = cellText.includes('prophetx') || cellText === 'px' || cellText.startsWith('px ');
              convertOddsInContainer(oddsCell, false, isProphetX);
            }
          }
        });
      });
    }
  }

  // 3) Responsive / Footable detail inner rows
  const detailInnerDivs = document.querySelectorAll('.footable-row-detail-inner');
  detailInnerDivs.forEach(container => {
    const divs = Array.from(container.children);
    divs.forEach((d, idx) => {
      const sbText = d.textContent.trim().toLowerCase();
      if (sbText.includes('sportsbook') || sbText.includes('book :')) {
        const isTargetBook = targetBooks.some(book => {
          if (book === 'novig' && sbText.includes('novig')) return true;
          if (book === 'kalshi' && sbText.includes('kalshi')) return true;
          if (book === 'prophetx' && sbText.includes('prophetx')) return true;
          if (book === 'kambi' && sbText.includes('kambi')) return true;
          if (book === 'nv' && sbText.includes('nv')) return true;
          if (book === 'ki' && sbText.includes('ki')) return true;
          if (book === 'px' && sbText.includes('px')) return true;
          if (book === 'km' && sbText.includes('km')) return true;
          return false;
        });

        if (isTargetBook) {
          const isProphetX = sbText.includes('prophetx') || sbText.includes('px');
          // Find closest odds div in responsive detail row (checking adjacent divs)
          let closestOddsDiv = null;
          let minDistance = Infinity;

          divs.forEach((od, oIdx) => {
            if (od.textContent.trim().toLowerCase().includes('odds :')) {
              const dist = Math.abs(idx - oIdx);
              if (dist < minDistance) {
                minDistance = dist;
                closestOddsDiv = od;
              }
            }
          });

          if (closestOddsDiv) {
            convertOddsInContainer(closestOddsDiv, isGamePage, isProphetX);
          }
        }
      }
    });
  });
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

function updateDeviggerLink(popup) {
  let fairOdds = '';
  const fairEl = document.getElementById('PopupCalc_EVTab_FairOdds') || 
                 document.getElementById('PopupCalc_FairOdds');

  if (fairEl) {
    fairOdds = fairEl.textContent.trim().replace('+', '');
  } else {
    const hedgeInput = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_Hedge_TextBoxPopupCalc_HedgeTab_Hedge_BetOdds') ||
                       document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_TextBoxPopupCalc_Hedge_BetOdds');
    if (hedgeInput) fairOdds = hedgeInput.value.trim().replace('+', '');
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

  const activeTab = popup.querySelector('.ajax__tab_panel[style*="visible"], .ajax__tab_panel[style*="block"]') || popup;
  const table = activeTab.querySelector('table');
  if (!table) return;

  let linkContainer = activeTab.querySelector('.cno-devigger-link');
  if (!linkContainer) {
    linkContainer = document.createElement('div');
    linkContainer.className = 'cno-devigger-link';
    linkContainer.style.cssText = 'margin: 10px 0; text-align: center;';
    table.parentNode.insertBefore(linkContainer, table);
  }

  linkContainer.innerHTML = `<a href="${deviggerUrl}" target="_blank" style="background: #0284c7; color: #ffffff; padding: 4px 10px; border-radius: 4px; text-decoration: none; font-size: 0.9em; font-weight: bold;">Open in Devigger ↗</a>`;
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

    const currentOddsVal = isInput ? el.value.trim() : el.textContent.trim();
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


function processUpdateBannerAlert() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.local.get(['updateAvailable', 'latestVersion', 'releasePageUrl', 'cno_dismissed_update_version'], (data) => {
    const existingBanner = document.getElementById('cno-update-banner-alert');

    if (!data.updateAvailable) {
      if (existingBanner) existingBanner.remove();
      return;
    }

    if (data.cno_dismissed_update_version === data.latestVersion) {
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
        <a href="${releaseUrl}" target="_blank" style="background: #0284c7; color: #ffffff; padding: 4px 10px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 0.82rem;">Download Update ↗</a>
        <button id="cno-dismiss-update-btn" style="background: none; border: none; font-size: 1.1rem; color: #64748b; cursor: pointer; padding: 0 4px;" title="Dismiss for session">✕</button>
      </div>
    `;

    targetContainer.parentNode.insertBefore(banner, targetContainer.nextSibling);

    document.getElementById('cno-dismiss-update-btn').addEventListener('click', () => {
      chrome.storage.local.set({ cno_dismissed_update_version: data.latestVersion });
      banner.remove();
    });
  });
}