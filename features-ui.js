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
      th.removeAttribute('title');
      th.style.cursor = 'pointer';
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
  // Promo calculators (Free Bet, Risk-Free, Bet & Get, Win & Get) show Hit% (the fair win chance)
  // instead of Fair Odds; the fair odds follow from it (its exact value is in a "percentage" attribute)
  let hitPct = NaN;
  const hitEl = !fairOdds ? activeTab.querySelector('#PopupCalc_EVTab_FairPercentage') : null;
  if (hitEl) {
    hitPct = parseFloat(hitEl.getAttribute('percentage'));
    if (!(hitPct > 0 && hitPct < 1)) hitPct = parseFloat(getOwnText(hitEl).replace(/[^0-9.]/g, '')) / 100;
    if (hitPct > 0 && hitPct < 1) {
      const dec = 1 / hitPct;
      const am = dec >= 2 ? (dec - 1) * 100 : -100 / (dec - 1);
      fairOdds = String(Math.round(am)); // whole odds, like CNO's Fair Odds
    } else {
      hitPct = NaN;
    }
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

  // Positive EV page: a profit boost typed into the popup's "Add profit boost" box (filter-ui.js)
  if (!boostVal && typeof cnoCalcBoostPct === 'function') {
    const extra = cnoCalcBoostPct(popup);
    if (extra > 0) boostVal = String(extra);
  }

  const popupText = (suffix) => {
    const el = activeTab.querySelector(`[id^="PopupCalc"][id$="${suffix}"]`) || popup.querySelector(`[id^="PopupCalc"][id$="${suffix}"]`);
    return el ? getOwnText(el).trim() : '';
  };
  const legOdds = cnoBuildDeviggerLegOdds(fairOdds, popupText('EventName'), popupText('_Market'), popupText('BetName'), popupText('SportLeague'));

  let deviggerUrl = `http://crazyninjamike.com/Public/sportsbooks/sportsbook_devigger.aspx?autofill=1&LegOdds=${encodeURIComponent(legOdds)}&FinalOdds=${encodeURIComponent(finalOdds)}`;
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

  const existingLink = linkContainer.querySelector('a.cno-devigger-btn:not(.cno-calc-sharp-btn)');
  if (!existingLink || existingLink.getAttribute('href') !== deviggerUrl) {
    linkContainer.innerHTML = `<a href="${deviggerUrl}" target="_blank" rel="noopener" class="cno-devigger-btn">${cnoIconSvg('devig')} Open in Devigger <span aria-hidden="true">↗</span></a>`;
  }
  // "Custom Sharp EV" to its right (filter-ui.js), when that row has a sharp-book set
  if (typeof cnoSyncCalcSharpBtn === 'function') cnoSyncCalcSharpBtn(linkContainer);
  if (typeof cnoSyncCalcBoost === 'function') cnoSyncCalcBoost(linkContainer, fairOdds, finalOdds);
  // "Copy for Discord" under the calculator's last line (filter-ui.js)
  if (typeof cnoSyncCalcShare === 'function') {
    const fairEl = activeTab.querySelector('#PopupCalc_EVTab_FairOdds, #PopupCalc_FairOdds');
    const textOf = (suffix) => {
      const el = activeTab.querySelector(`[id^="PopupCalc"][id$="${suffix}"]`) || popup.querySelector(`[id^="PopupCalc"][id$="${suffix}"]`);
      if (!el) return '';
      return (typeof getCleanCellText === 'function' ? getCleanCellText(el) : el.textContent).replace(/\s+/g, ' ').trim();
    };
    cnoSyncCalcShare(table, {
      fairOdds, finalOdds, boostVal, deviggerUrl,
      fairPct: fairEl ? parseFloat(fairEl.getAttribute('percentage')) : hitPct,
      promoType: hitEl ? textOf('EVTab_Type') : '', promoEv: hitEl ? textOf('EVTab_EVPercentage') : '',
      reward: hitEl ? textOf('EVTab_Reward') : '',
      event: textOf('EventName'), market: textOf('_Market'), betName: textOf('BetName'), dateText: textOf('_Date'),
      book: textOf('SportsbookSite').replace(/\s*\([^)]*\)\s*$/, '')
    });
  }
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

  const isChecked = userSettings.enableRightClickDevig !== false;

  const wrapper = document.createElement('span');
  wrapper.id = 'cno-wrap-rightclick-devig';
  wrapper.style.cssText = 'margin-left: 14px; display: inline; vertical-align: middle;';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'cno-checkbox-rightclick-devig';
  checkbox.checked = isChecked;
  checkbox.style.cssText = 'margin: 0 3px 0 0; vertical-align: middle; cursor: pointer;';

  checkbox.addEventListener('change', () => {
    cnoSetUserSetting('enableRightClickDevig', checkbox.checked);
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

// Game page: "Hockey - NHL" (for the Devigger comment's team abbreviations)
function cnoGamePageLeague() {
  const el = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_LabelSportLeague');
  return el ? el.textContent.trim() : '';
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
    const isEnabled = userSettings.enableRightClickDevig !== false;
    if (!isEnabled) return;

    const targetCell = e.target.closest('td');
    if (!targetCell) return;

    const row = targetCell.closest('tr');
    if (!row) return;

    // Not on the Fair Odds column itself (there's nothing to devig against)
    if (!row.classList.contains('footable-row-detail')) {
      const th = targetTable.querySelectorAll('thead th')[targetCell.cellIndex];
      if (th && th.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'fair odds') return;
    } else {
      const detailItem = e.target.closest('.footable-row-detail-inner > div');
      if (detailItem && /fair odds/i.test(detailItem.textContent)) return;
    }

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

    const mainRow = row.classList.contains('footable-row-detail') ? row.previousElementSibling : row;
    const nameCell = mainRow ? mainRow.children[0] : null;
    const gameEventEl = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_LabelEventName');
    const gameMarketEl = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_DropDownListMarket');
    const legOdds = cnoBuildDeviggerLegOdds(
      fairOdds,
      gameEventEl ? gameEventEl.textContent : '',
      gameMarketEl && gameMarketEl.selectedIndex >= 0 ? gameMarketEl.options[gameMarketEl.selectedIndex].text : '',
      nameCell && typeof getCleanCellText === 'function' ? getCleanCellText(nameCell) : (nameCell ? nameCell.textContent : ''),
      typeof cnoGamePageLeague === 'function' ? cnoGamePageLeague() : ''
    );

    const deviggerUrl = `http://crazyninjamike.com/Public/sportsbooks/sportsbook_devigger.aspx?autofill=1&LegOdds=${encodeURIComponent(legOdds)}&FinalOdds=${encodeURIComponent(cellOdds)}`;

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
    menuItem.innerHTML = `${cnoIconSvg('devig', 14)}<span>Devig to FV</span>`;
    menuItem.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
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
  if (typeof CNO_IS_FIREFOX_BUILD !== 'undefined' && CNO_IS_FIREFOX_BUILD) return;

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
  document.documentElement.classList.toggle('cno-game-page', window.location.pathname.toLowerCase().includes('game.aspx'));
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

// ====================================================
// GAME PAGE: HIDE UNWANTED BOOK COLUMNS (option)
// Columns whose header matches the ShortCode of an unchecked book are hidden.
// ====================================================

let cnoGameBooks = null;          // from the Google Sheet
let cnoGameBookVisibility = {};   // user choices
let cnoGameBooksRequested = false;

let cnoGameBookVisLoaded = false;

function ensureGameBookData() {
  if (cnoGameBooksRequested) return;
  cnoGameBooksRequested = true;
  // Start from the saved copy of the book list (instant), then refresh it from the sheet
  chrome.storage.local.get({ [CNO_GAME_BOOK_VIS_KEY]: {}, [CNO_BOOKS_CACHE_KEY]: '' }, (d) => {
    cnoGameBookVisibility = d[CNO_GAME_BOOK_VIS_KEY] || {};
    cnoGameBookVisLoaded = true;
    const cached = parseBooksCsv(d[CNO_BOOKS_CACHE_KEY]);
    if (cached.length && !cnoGameBooks) cnoGameBooks = cached;
    cnoRunGameTablePass();
  });
  loadBooksList((books) => {
    if (books && books.length) cnoGameBooks = books;
    else if (!cnoGameBooks) cnoGameBooks = []; // nothing available: don't hold the table back
    processGameBookColumns();
    cnoRunGameTablePass();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CNO_GAME_BOOK_VIS_KEY]) {
      cnoGameBookVisibility = changes[CNO_GAME_BOOK_VIS_KEY].newValue || {};
      processGameBookColumns();
    }
  });
}

function processGameBookColumns() {
  if (!window.location.pathname.toLowerCase().includes('game.aspx')) return;
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const on = !!(typeof userSettings !== 'undefined' && userSettings.hideUnwantedGameBooks);

  if (!on || !table) {
    if (table) table.querySelectorAll('.cno-col-hidden.cno-book-col').forEach(el => el.classList.remove('cno-col-hidden', 'cno-book-col'));
    return;
  }

  ensureGameBookData();
  if (!cnoGameBooks) return;

  const hiddenCodes = new Set(cnoGameBooks.filter(b => !isBookShown(b, cnoGameBookVisibility)).map(b => b.shortCode));
  const ths = Array.from(table.querySelectorAll('thead th'));
  const rows = Array.from(table.querySelectorAll('tbody tr:not(.footable-row-detail)'));

  ths.forEach((th, idx) => {
    const code = th.textContent.replace(/\s+/g, '').toUpperCase();
    const hide = hiddenCodes.has(code);
    const cells = [th].concat(rows.map(r => r.children[idx]).filter(Boolean));
    cells.forEach(cell => {
      if (hide) cell.classList.add('cno-col-hidden', 'cno-book-col');
      else if (cell.classList.contains('cno-book-col')) cell.classList.remove('cno-col-hidden', 'cno-book-col');
    });
  });
}

// ====================================================
// GAME PAGE: FILTER BY A BOOK'S COLUMN (header menu)
// Hover (or click) a book's header: Filter to Best Odds / >= FV / Best Odds or >= FV.
// Rows come in groups (2 per line, or 3 for "3-way" markets); a group is kept when any of its
// rows matches, so the other side(s) of a line always come along.
// ====================================================

let cnoGameColFilter = null; // { code, mode: 'nonblank' | 'best' | 'fv' | 'either' | 'ev' }

const GAME_FILTER_MODES = [
  { mode: 'nonblank', label: 'Refine to non-blank', short: 'Non-blank' },
  { mode: 'best', label: 'Refine to Best Odds', short: 'Best Odds' },
  { mode: 'fv', label: 'Refine to >= FV', short: '>= FV' },
  { mode: 'either', label: 'Refine to Best Odds or >= FV', short: 'Best Odds or >= FV' },
  // Not a refine: adds a "<BOOK> EV%" column and sorts by it (high to low); no rows are hidden
  { mode: 'ev', label: 'Sort by EV %', short: 'EV %' }
];

function getGameTable() {
  if (!window.location.pathname.toLowerCase().includes('game.aspx')) return null;
  return document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
}

function getGameColumns(table) {
  const ths = Array.from(table.querySelectorAll('thead th'));
  const cols = { betName: -1, best: -1, fair: -1, books: [] };
  ths.forEach((th, i) => {
    if (th.classList.contains('cno-ev-col')) return; // the extension's "<BOOK> EV%" column
    const txt = th.textContent.replace(/\s+/g, ' ').trim();
    const low = txt.toLowerCase();
    if (low === 'bet name') cols.betName = i;
    else if (low === 'best') cols.best = i;
    else if (low === 'fair odds') cols.fair = i;
    else if (txt) cols.books.push({ idx: i, code: txt.replace(/\s+/g, '').toUpperCase(), th });
  });
  return cols;
}

function getGameBookFullName(code) {
  return BOOK_HEADER_FULLNAME_MAP[code] || code;
}

function getGameMarketName() {
  const sel = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_DropDownListMarket');
  return sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text.trim() : '';
}

function americanToDecimal(odds) {
  const n = parseInt(odds, 10);
  if (isNaN(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function cellOdds(cell) {
  if (!cell) return null;
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('[class^="cno-"], [class*=" cno-"]').forEach(el => el.remove());
  return extractAmericanOdds(clone.textContent);
}

function getGameDataRows(table) {
  // Skip the "no results" row (a single cell spanning the table)
  return Array.from(table.querySelectorAll('tbody tr:not(.footable-row-detail)'))
    .filter(r => r.children.length > 1);
}

function setGameColFilter(code, mode) {
  cnoGameColFilter = { code, mode };
  // Sorting by EV % turns "Pair 2-/3-way lines" off (pairs would break up the sort)
  if (mode === 'ev') {
    if (cnoGamePairLines) {
      cnoGamePairLines = false;
      try { chrome.storage.local.set({ [CNO_GAME_PAIR_KEY]: false }); } catch (e) { /* ignore */ }
      const bar = document.getElementById('cno-gt-toolbar');
      if (bar) bar.remove(); // rebuilt with the toggle shown off
    }
    processGameColFilter();
    processGameTableModern();
    processGameRowOrdering();
    // Bring the top (highest EV) row into view, with the table header and banner above it
    const table = getGameTable();
    const first = table && getGameDataRows(table)[0];
    if (first) {
      const head = table.querySelector('thead');
      const headH = head ? head.getBoundingClientRect().height : 0;
      const y = first.getBoundingClientRect().top + window.scrollY - headH - 70;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    return;
  }
  // Filtering turns "Pair 2-/3-way lines" on (if the table restyle is on), so each kept line
  // shows next to its other side(s). The user can switch pairing back off from the toolbar.
  if (typeof isGameTableModern === 'function' && isGameTableModern() && !cnoGamePairLines) {
    cnoGamePairLines = true;
    try { chrome.storage.local.set({ [CNO_GAME_PAIR_KEY]: true }); } catch (e) { /* ignore */ }
    const bar = document.getElementById('cno-gt-toolbar');
    if (bar) bar.remove(); // rebuilt with the toggle shown on
    processGameTableModern();
    processGameRowOrdering();
  }
  processGameColFilter();
}

function clearGameColFilter() {
  cnoGameColFilter = null;
  processGameColFilter();
  processGameTableModern();
  processGameRowOrdering();
}

// EV% for one book on each row, from that book's odds and the row's Fair Odds:
// EV = fair win chance x decimal odds - 1
function cnoGameRowEv(row, cols, book) {
  if (!book || cols.fair === -1) return null;
  const v = cellOdds(row.children[book.idx]);
  const fair = cellOdds(row.children[cols.fair]);
  const dv = v ? americanToDecimal(v) : null;
  const df = fair ? americanToDecimal(fair) : null;
  if (!dv || !df) return null;
  return dv / df - 1;
}

// The "<BOOK> EV%" column, right after Fair Odds
function cnoUpdateGameEvColumn(table, cols, book) {
  const code = cnoGameColFilter ? cnoGameColFilter.code : '';
  const anchorIdx = cols.fair !== -1 ? cols.fair : (cols.best !== -1 ? cols.best : cols.betName);
  const headerRow = cols.betName !== -1 ? table.querySelectorAll('thead th')[cols.betName].parentNode : null;
  if (!headerRow || anchorIdx === -1) return;
  let th = headerRow.querySelector('th.cno-ev-col');
  if (!th) {
    th = document.createElement('th');
    th.className = 'cno-ev-col';
    headerRow.insertBefore(th, headerRow.children[anchorIdx + 1] || null);
  }
  const title = `${code} EV%`;
  if (th.textContent !== title) th.textContent = title;
  getGameDataRows(table).forEach(row => {
    let td = row.querySelector(':scope > td.cno-ev-col');
    if (!td) {
      td = document.createElement('td');
      td.className = 'cno-ev-col';
      row.insertBefore(td, row.children[anchorIdx + 1] || null);
    }
    const ev = cnoGameRowEv(row, cols, book);
    row.dataset.cnoEv = ev === null ? '' : String(ev);
    const text = ev === null ? '' : `${ev > 0 ? '+' : ''}${(ev * 100).toFixed(2)}%`;
    if (td.textContent !== text) td.textContent = text;
    td.classList.toggle('cno-ev-pos', ev !== null && ev > 0);
    td.classList.toggle('cno-ev-neg', ev !== null && ev < 0);
  });
}

function processGameColFilter() {
  const table = getGameTable();
  let banner = document.getElementById('cno-game-filter-banner');

  if (!cnoGameColFilter || !table) {
    if (!cnoGameColFilter) {
      if (banner) banner.remove();
      document.querySelectorAll('.cno-game-hidden').forEach(el => el.classList.remove('cno-game-hidden'));
      document.querySelectorAll('.cno-ev-col').forEach(el => el.remove());
    }
    return;
  }

  const cols = getGameColumns(table);
  const book = cols.books.find(b => b.code === cnoGameColFilter.code);
  const rows = getGameDataRows(table);
  const groupSize = /3-way/i.test(getGameMarketName()) ? 3 : 2;

  // Sort by EV %: nothing is hidden; the "<BOOK> EV%" column is added (rows are ordered in
  // processGameRowOrdering)
  const evMode = cnoGameColFilter.mode === 'ev';
  if (evMode) {
    table.querySelectorAll('.cno-game-hidden').forEach(el => el.classList.remove('cno-game-hidden'));
    cnoUpdateGameEvColumn(table, cols, book);
  } else {
    table.querySelectorAll('.cno-ev-col').forEach(el => el.remove());
  }

  const rowMatches = (row) => {
    if (!book) return false;
    const v = cellOdds(row.children[book.idx]);
    if (!v) return false;
    if (cnoGameColFilter.mode === 'nonblank') return true; // any odds in this book's cell
    const best = cols.best !== -1 ? cellOdds(row.children[cols.best]) : null;
    const fair = cols.fair !== -1 ? cellOdds(row.children[cols.fair]) : null;
    const isBest = !!best && parseInt(v, 10) === parseInt(best, 10);
    const dv = americanToDecimal(v), df = fair ? americanToDecimal(fair) : null;
    const beatsFv = dv !== null && df !== null && dv >= df;
    if (cnoGameColFilter.mode === 'best') return isBest;
    if (cnoGameColFilter.mode === 'fv') return beatsFv;
    return isBest || beatsFv;
  };

  const groups = groupGameRows(rows, cols, groupSize); // row order is handled by processGameRowOrdering()

  if (!evMode) for (const group of groups) {
    const keep = group.some(rowMatches);
    group.forEach(row => {
      row.classList.toggle('cno-game-hidden', !keep);
      const next = row.nextElementSibling;
      if (next && next.classList.contains('footable-row-detail')) next.classList.toggle('cno-game-hidden', !keep);
    });
  }

  // Notice pinned with the table header (same style as the hedge sportsbook notice)
  if (!banner) {
    banner = document.createElement('tr');
    banner.id = 'cno-game-filter-banner';
    const cell = document.createElement('td');
    cell.className = 'cno-game-filter-cell';
    cell.style.cssText = 'text-align: left; padding: 4px 0 5px 0; background: #ffffff; border: none;';
    const pill = document.createElement('span');
    pill.style.cssText = `
      display: inline-flex; align-items: center; gap: 8px; padding: 4px 6px 4px 10px;
      background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 6px;
      color: #0369a1; font-size: 0.8rem; font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    const label = document.createElement('span');
    label.className = 'cno-game-filter-label';
    const pillIcon = document.createElement('span');
    pillIcon.innerHTML = ROWS_FILTER_ICON_SVG;
    pillIcon.style.cssText = 'display:inline-flex; margin-right:-2px;';
    pill.appendChild(pillIcon);
    const x = document.createElement('span');
    x.setAttribute('role', 'button');
    x.title = 'Remove this refinement';
    x.textContent = '✕';
    x.style.cssText = 'cursor:pointer; padding:0 5px; border-radius:3px; font-weight:700; line-height:1.3;';
    x.addEventListener('mouseover', () => { x.style.background = '#bae6fd'; });
    x.addEventListener('mouseout', () => { x.style.background = 'none'; });
    x.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearGameColFilter(); });
    pill.appendChild(label);
    pill.appendChild(x);
    cell.appendChild(pill);
    banner.appendChild(cell);
  }
  const modeInfo = GAME_FILTER_MODES.find(m => m.mode === cnoGameColFilter.mode);
  const text = evMode
    ? `Sorted by ${cnoGameColFilter.code} EV% (${getGameBookFullName(cnoGameColFilter.code)})`
    : `Refined to ${getGameBookFullName(cnoGameColFilter.code)}: ${modeInfo ? modeInfo.short : ''}`;
  const label = banner.querySelector('.cno-game-filter-label');
  if (label.textContent !== text) label.textContent = text;

  const thead = table.querySelector('thead');
  if (!thead) return;
  const cell = banner.querySelector('.cno-game-filter-cell');
  const count = Math.max(1, table.querySelectorAll('thead th').length);
  if (String(cell.colSpan) !== String(count)) cell.colSpan = count;
  if (banner.parentNode !== thead || thead.firstElementChild !== banner) thead.insertBefore(banner, thead.firstChild);
}

// Groups a line with its other side(s). Rows aren't always in neat pairs (a line can be missing
// its partner), so group by content instead of position:
//   1) Over/Under/Yes/No lines: same name once that word and the number are removed, plus the
//      same |number| ("Zach Edey Over 7.5" + "Zach Edey Under 7.5", "Over 145.5" + "Under 145.5")
//   2) spreads: the same |number| with opposite signs on two different teams
//      ("Utah Mammoth -1.5" + "Anaheim Ducks +1.5"; never "Utah Mammoth -1.5" + "Utah Mammoth +1.5")
//   3) lines with no number: all together (moneyline sides, or Home/Tie/Away in a 3-way market)
function groupGameRows(rows, cols, groupSize) {
  const info = rows.map(row => {
    const nameCell = cols.betName !== -1 ? row.children[cols.betName] : row.children[0];
    const name = nameCell ? getCleanCellText(nameCell) : '';
    const m = name.match(/([+-]?\d+(?:\.\d+)?)\s*$/);
    const signed = m ? m[1] : '';
    const num = m ? String(Math.abs(parseFloat(m[1]))) : '';
    const sign = !m ? '' : (signed.startsWith('-') ? '-' : (signed.startsWith('+') ? '+' : ''));
    const noNumber = name.replace(/([+-]?\d+(?:\.\d+)?)\s*$/, '');
    const hasOU = /\b(over|under|yes|no)\b/i.test(noNumber);
    const residual = noNumber.replace(/\b(over|under|yes|no)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
    return { row, residual, num, sign, hasOU };
  });

  const groups = [];
  const used = new Set();

  // 1) Over/Under, Yes/No
  const byKey = new Map();
  info.filter(x => x.hasOU).forEach(x => {
    const key = `${x.residual}|${x.num}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(x);
  });
  byKey.forEach(list => { groups.push(list.map(x => x.row)); list.forEach(x => used.add(x)); });

  // 2) Spreads: pair each - line with the nearest + line of the same size on another team
  const byNum = new Map();
  info.filter(x => !used.has(x) && x.num !== '' && x.sign).forEach(x => {
    if (!byNum.has(x.num)) byNum.set(x.num, []);
    byNum.get(x.num).push(x);
  });
  byNum.forEach(list => {
    const minus = list.filter(x => x.sign === '-');
    const plus = list.filter(x => x.sign === '+');
    minus.forEach(a => {
      const ai = info.indexOf(a);
      let best = null, bestDist = Infinity;
      plus.forEach(b => {
        if (used.has(b) || b.residual === a.residual) return;
        const d = Math.abs(info.indexOf(b) - ai);
        if (d < bestDist) { best = b; bestDist = d; }
      });
      if (best) {
        const pair = [a, best].sort((x, y) => info.indexOf(x) - info.indexOf(y));
        groups.push(pair.map(x => x.row));
        used.add(a); used.add(best);
      }
    });
  });

  // 3) Everything else: no-number lines together; anything still unmatched on its own
  const noNum = info.filter(x => !used.has(x) && x.num === '');
  if (noNum.length) { groups.push(noNum.map(x => x.row)); noNum.forEach(x => used.add(x)); }
  info.filter(x => !used.has(x)).forEach(x => groups.push([x.row]));
  return groups;
}

// Header hover menu
let cnoGameHeaderMenu = null;
let cnoGameHeaderHideTimer = null;

function hideGameHeaderMenu() {
  if (cnoGameHeaderHideTimer) { clearTimeout(cnoGameHeaderHideTimer); cnoGameHeaderHideTimer = null; }
  if (cnoGameHeaderMenu) { cnoGameHeaderMenu.remove(); cnoGameHeaderMenu = null; }
}

function scheduleHideGameHeaderMenu() {
  if (cnoGameHeaderHideTimer) clearTimeout(cnoGameHeaderHideTimer);
  cnoGameHeaderHideTimer = setTimeout(hideGameHeaderMenu, 180);
}

function showGameHeaderMenu(th, code) {
  if (!isGameTableModern()) return; // classic table: headers just show the book's name on hover
  if (cnoGameHeaderHideTimer) { clearTimeout(cnoGameHeaderHideTimer); cnoGameHeaderHideTimer = null; }
  if (cnoGameHeaderMenu && cnoGameHeaderMenu.dataset.code === code) return;
  hideGameHeaderMenu();

  const menu = document.createElement('div');
  menu.dataset.code = code;
  menu.style.cssText = `
    position: fixed; z-index: 1000001; min-width: 210px;
    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;
    box-shadow: 0 10px 24px rgba(15,23,42,0.16); overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  const head = document.createElement('div');
  head.textContent = getGameBookFullName(code);
  head.style.cssText = 'padding: 7px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b;';
  menu.appendChild(head);

  const list = document.createElement('div');
  list.style.cssText = 'padding: 4px;';
  GAME_FILTER_MODES.forEach(m => {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = m.label;
    const active = cnoGameColFilter && cnoGameColFilter.code === code && cnoGameColFilter.mode === m.mode;
    item.style.cssText = `display:block; width:100%; text-align:left; background:${active ? '#e0f2fe' : 'none'}; border:none; padding:7px 10px; border-radius:5px; font-size:0.84rem; font-weight:600; color:#0369a1; cursor:pointer;`;
    item.addEventListener('mouseover', () => item.style.background = '#f0f9ff');
    item.addEventListener('mouseout', () => item.style.background = active ? '#e0f2fe' : 'none');
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideGameHeaderMenu();
      setGameColFilter(code, m.mode);
    });
    list.appendChild(item);
  });
  menu.appendChild(list);

  menu.addEventListener('mouseenter', () => { if (cnoGameHeaderHideTimer) { clearTimeout(cnoGameHeaderHideTimer); cnoGameHeaderHideTimer = null; } });
  menu.addEventListener('mouseleave', scheduleHideGameHeaderMenu);
  document.body.appendChild(menu);
  cnoGameHeaderMenu = menu;

  const r = th.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${r.bottom + 2}px`;
}

function processGameHeaderFilterMenus() {
  const table = getGameTable();
  if (!table) return;
  const modern = isGameTableModern();
  getGameColumns(table).books.forEach(({ th, code }) => {
    // Classic table: the book's full name as a hover tooltip, no filter menu.
    // Enhanced table: no tooltip (the filter menu shows the name).
    const fullName = getGameBookFullName(code);
    if (!modern && fullName !== code) {
      if (th.title !== fullName) th.title = fullName;
    } else if (th.hasAttribute('title')) {
      th.removeAttribute('title');
    }
    th.style.cursor = modern ? 'pointer' : 'help';
    if (th.dataset.cnoFilterMenu) return;
    th.dataset.cnoFilterMenu = 'true';
    th.addEventListener('mouseenter', () => showGameHeaderMenu(th, code));
    th.addEventListener('mouseleave', scheduleHideGameHeaderMenu);
    th.addEventListener('click', () => showGameHeaderMenu(th, code));
  });
}

window.addEventListener('scroll', hideGameHeaderMenu, true);

// ====================================================
// GAME PAGE: QR BUTTON ON ODDS CELLS (when Deeplinks is on)
// ====================================================

function processGameQrButtons() {
  const table = getGameTable();
  if (!table) return;
  const deep = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_CheckBoxDeepLinkOddsScreen');
  if (!deep || !deep.checked) {
    table.querySelectorAll('.cno-game-qr').forEach(el => el.remove());
    return;
  }
  if (typeof createQrBtn !== 'function' || typeof getHoverTray !== 'function') return;

  const cols = getGameColumns(table);
  getGameDataRows(table).forEach(row => {
    cols.books.forEach(({ idx, code }) => {
      const cell = row.children[idx];
      if (!cell || cell.querySelector('.cno-qr-btn')) return;
      const link = cell.querySelector('a[href]');
      if (!link || !/^https?:/i.test(link.href)) return;
      const btn = createQrBtn(link, () => getGameBookFullName(code), () => {
        const nameCell = cols.betName !== -1 ? row.children[cols.betName] : null;
        const eventEl = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_LabelEventName');
        return {
          event: eventEl ? eventEl.textContent.trim() : '',
          market: getGameMarketName(),
          betName: nameCell ? getCleanCellText(nameCell) : '',
          odds: cellOdds(cell) || ''
        };
      });
      btn.classList.add('cno-game-qr');
      const tray = getHoverTray(cell);
      tray.classList.add('cno-hover-tray-above'); // sits on the cell's top edge so the odds stay visible
      tray.appendChild(btn);
    });
  });
}

// While a game filter is on, move each line's other side(s) right under it, so pairs stay
// together even when the site lists them apart. The original order is restored when cleared.
function keepGameGroupsTogether(table, rows, groups) {
  const tbody = table.querySelector('tbody');
  if (!tbody || !rows.length) return;

  rows.forEach((row, i) => { if (row.dataset.cnoOrigIndex === undefined) row.dataset.cnoOrigIndex = String(i); });

  const ordered = groups
    .map(g => g.slice().sort((a, b) => +a.dataset.cnoOrigIndex - +b.dataset.cnoOrigIndex))
    .sort((a, b) => +a[0].dataset.cnoOrigIndex - +b[0].dataset.cnoOrigIndex)
    .flat();

  const current = Array.from(tbody.querySelectorAll(':scope > tr:not(.footable-row-detail)')).filter(r => r.children.length > 1);
  if (current.length === ordered.length && current.every((r, i) => r === ordered[i])) return; // already in place

  ordered.forEach(row => {
    const detail = row.nextElementSibling && row.nextElementSibling.classList.contains('footable-row-detail') ? row.nextElementSibling : null;
    tbody.appendChild(row);
    if (detail) tbody.appendChild(detail);
  });
}

function restoreGameRowOrder(table) {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll(':scope > tr[data-cno-orig-index]'));
  if (!rows.length) return;
  // Nothing to do if they're already in the original order
  const inOrder = rows.every((r, i) => i === 0 || +rows[i - 1].dataset.cnoOrigIndex < +r.dataset.cnoOrigIndex);
  if (inOrder) return;
  rows.sort((a, b) => +a.dataset.cnoOrigIndex - +b.dataset.cnoOrigIndex).forEach(row => {
    const detail = row.nextElementSibling && row.nextElementSibling.classList.contains('footable-row-detail') ? row.nextElementSibling : null;
    tbody.appendChild(row);
    if (detail) tbody.appendChild(detail);
  });
}

// ====================================================
// GAME PAGE: COMPACT FILTER CARD (Modernized UI only)
// Gathers Market / Sub-market / Devig Method / Deeplinks / right-click devig / Update into a
// two-row card instead of one control per line. The site redraws this area on every update,
// so it's rebuilt each time (the controls themselves are the site's own, just moved).
// ====================================================

function processGameFilterLayout() {
  if (!window.location.pathname.toLowerCase().includes('game.aspx')) return;
  if (typeof userSettings === 'undefined' || !userSettings.enableFilterModernization) return;

  const panel = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelGridView');
  if (!panel || panel.querySelector('#cno-game-filter-card')) return;

  const byId = (id) => document.getElementById(`ContentPlaceHolderMain_ContentPlaceHolderRight_${id}`);
  const market = byId('DropDownListMarket');
  if (!market || market.parentNode !== panel) return;
  const sub = byId('DropDownListSubMarket');
  const devig = panel.querySelector('select[id$="DropDownListDevigMethod"]');
  const deep = byId('CheckBoxDeepLinkOddsScreen');
  const deepLabel = deep ? panel.querySelector(`label[for="${deep.id}"]`) : null;
  const rightClick = document.getElementById('cno-wrap-rightclick-devig');
  const helpLink = panel.querySelector('a[href*="cno-devig-methods"]');
  const updateBtn = byId('ButtonUpdate');
  const updateFaux = byId('ButtonUpdate_Faux');

  const card = document.createElement('div');
  card.id = 'cno-game-filter-card';
  panel.insertBefore(card, market);

  const field = (labelText, control, extra) => {
    const f = document.createElement('div');
    f.className = 'cno-gf-field';
    const l = document.createElement('span');
    l.className = 'cno-gf-label';
    l.textContent = labelText;
    if (extra) l.appendChild(extra);
    f.appendChild(l);
    f.appendChild(control);
    return f;
  };

  const row1 = document.createElement('div');
  row1.className = 'cno-gf-row';
  row1.appendChild(field('Market', market));
  if (sub) row1.appendChild(field('Sub-market', sub));

  const row2 = document.createElement('div');
  row2.className = 'cno-gf-row';
  if (devig) {
    let help = null;
    if (helpLink) {
      help = helpLink;
      help.textContent = '(Help)';
      help.className = 'cno-gf-help';
      help.target = '_blank';
      help.tabIndex = -1;
    }
    row2.appendChild(field('Devig Method', devig, help));
  }

  const checks = document.createElement('div');
  checks.className = 'cno-gf-checks';
  if (deep) {
    const wrap = document.createElement('span');
    wrap.className = 'cno-gf-check';
    wrap.appendChild(deep);
    if (deepLabel) wrap.appendChild(deepLabel);
    checks.appendChild(wrap);
  }
  if (rightClick) {
    rightClick.style.marginLeft = '0';
    rightClick.classList.add('cno-gf-check');
    checks.appendChild(rightClick);
  }
  if (checks.children.length) row2.appendChild(checks);

  card.appendChild(row1);
  card.appendChild(row2);

  // Update button sits just below the card, on the left
  if (updateBtn) {
    card.insertAdjacentElement('afterend', updateBtn);
    if (updateFaux) updateBtn.insertAdjacentElement('afterend', updateFaux);
  }

  // Clean up the line breaks and leftover labels ("Devig Method:", "(See: ... )") the controls left behind
  let n = card.nextSibling;
  while (n) {
    const next = n.nextSibling;
    if (n.nodeType === Node.ELEMENT_NODE) {
      if (n.id === 'ContentPlaceHolderMain_ContentPlaceHolderRight_TimerAjaxDelayedLoad') break;
      if (n.tagName === 'BR') n.remove();
      else if (n.tagName === 'SPAN' || n.tagName === 'DIV' || n.tagName === 'TABLE') break;
    } else if (n.nodeType === Node.TEXT_NODE) {
      if (/devig method:|\(see:|^\s*\)\s*$|^\s*$/i.test(n.textContent)) n.remove();
    }
    n = next;
  }
}

// ====================================================
// PAGE HEADER (Modernized UI only)
// - Tool pages: "Last Updated ... [Refresh]" moves onto the title line, right-aligned and muted.
// - Game pages: Sport-League / Event / Start time become a compact two-line banner, with
//   "Last Updated ... [Refresh]" on the right of the Sport-League line.
// The site's own elements are moved, not copied (the Last Updated box keeps refreshing itself).
// ====================================================

function processPageHeaderLayout() {
  if (typeof userSettings === 'undefined' || !userSettings.enableFilterModernization) return;
  const serverInfo = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelServerInfo');
  if (!serverInfo || serverInfo.dataset.cnoPlaced) return;

  const removeBrsBetween = (start, stopEl) => {
    let n = start;
    while (n && n !== stopEl) {
      const next = n.nextSibling;
      if ((n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BR') ||
          (n.nodeType === Node.TEXT_NODE && !n.textContent.trim())) n.remove();
      n = next;
    }
  };

  const byId = (id) => document.getElementById(`ContentPlaceHolderMain_ContentPlaceHolderRight_${id}`);
  const sportLeague = byId('LabelSportLeague');
  const eventName = byId('LabelEventName');
  const startDate = byId('LabelStartDate');

  if (window.location.pathname.toLowerCase().includes('game.aspx') && sportLeague && eventName) {
    const grid = byId('UpdatePanelGridView');
    const header = document.createElement('div');
    header.id = 'cno-game-header';
    sportLeague.parentNode.insertBefore(header, sportLeague);

    const top = document.createElement('div');
    top.className = 'cno-gh-top';
    sportLeague.classList.add('cno-gh-league');
    top.appendChild(sportLeague);
    top.appendChild(serverInfo);

    const main = document.createElement('div');
    main.className = 'cno-gh-main';
    eventName.classList.add('cno-gh-event');
    main.appendChild(eventName);
    if (startDate) {
      startDate.classList.add('cno-gh-date');
      main.appendChild(startDate);
    }

    header.appendChild(top);
    header.appendChild(main);
    serverInfo.dataset.cnoPlaced = 'true';

    // Drop the line breaks that used to separate these lines
    removeBrsBetween(header.nextSibling, grid || null);
    let p = header.previousSibling;
    while (p && ((p.nodeType === Node.ELEMENT_NODE && p.tagName === 'BR') || (p.nodeType === Node.TEXT_NODE && !p.textContent.trim()))) {
      const prev = p.previousSibling;
      p.remove();
      p = prev;
    }
    return;
  }

  // Tool pages: put it on the title (h1) line
  const h1 = serverInfo.parentNode ? serverInfo.parentNode.querySelector(':scope > h1') : null;
  if (!h1) return;
  const row = document.createElement('div');
  row.id = 'cno-title-row';
  h1.parentNode.insertBefore(row, h1);
  removeBrsBetween(serverInfo.nextSibling, row);
  row.appendChild(h1);
  row.appendChild(serverInfo);
  serverInfo.dataset.cnoPlaced = 'true';

  // The title used to be followed by a blank line; the card's own margin is enough
  let n = row.nextSibling;
  while (n && n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) n = n.nextSibling;
  if (n && n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BR') n.remove();
}

// Game page: keep the header banner and filter card exactly as wide as the odds table
// (the table's width changes with the number of book columns shown)
function processGameHeaderWidths() {
  if (!window.location.pathname.toLowerCase().includes('game.aspx')) return;
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const boxes = [document.getElementById('cno-game-header'), document.getElementById('cno-game-filter-card')].filter(Boolean);
  if (!boxes.length) return;
  const width = table ? Math.round(table.getBoundingClientRect().width) : 0;
  boxes.forEach(box => {
    const want = width > 0 ? `${width}px` : '';
    if (box.style.width !== want) box.style.width = want;
  });
}

// ====================================================
// GAME PAGE: MODERNIZED ODDS TABLE (Modernized UI only)
// - Toolbar above the table: [Hide empty books] (off each visit), [Pair 2-/3-way lines]
//   (remembered), "Highlight liquidity under $[100]" (remembered)
// - Exchange cells: odds on top, "$liquidity · price¢" in small grey below (amber when
//   liquidity is under the threshold), so those columns are much narrower
// - Cells centered and top-aligned; Bet Name column tinted; Best / Fair Odds set apart
// The site's cell colors (best / EV highlights) are left as they are.
// ====================================================

const CNO_GAME_PAIR_KEY = 'cno_game_pair_lines';
const CNO_GAME_LIQ_KEY = 'cno_game_liq_threshold';
let cnoGamePairLines = false;
let cnoGameLiqThreshold = 100;
let cnoGameHideEmpty = false; // per visit, on purpose: you usually want to see which books are missing
let cnoGamePrefsLoaded = false;
let cnoGamePrefsReady = false; // the table isn't revealed until these are known (no reorder jump)

function loadGameTablePrefs() {
  if (cnoGamePrefsLoaded) return;
  cnoGamePrefsLoaded = true;
  try {
    chrome.storage.local.get({ [CNO_GAME_PAIR_KEY]: false, [CNO_GAME_LIQ_KEY]: 100 }, (d) => {
      cnoGamePairLines = !!d[CNO_GAME_PAIR_KEY];
      const n = Number(d[CNO_GAME_LIQ_KEY]);
      cnoGameLiqThreshold = isFinite(n) && n >= 0 ? n : 100;
      cnoGamePrefsReady = true;
      const box = document.getElementById('cno-gt-toolbar');
      if (box) box.remove(); // rebuild with the loaded values
      cnoRunGameTablePass();
    });
  } catch (e) { cnoGamePrefsReady = true; }
}

function isGameTableModern() {
  return window.location.pathname.toLowerCase().includes('game.aspx') &&
    typeof userSettings !== 'undefined' && userSettings.modernizeGameTable !== false;
}

function makeGameToolbarToggle(label, on, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cno-gt-toggle' + (on ? ' is-on' : '');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.innerHTML = '<span class="cno-gt-check" aria-hidden="true"></span>';
  b.appendChild(document.createTextNode(label));
  b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
  return b;
}

function ensureGameTableToolbar(table) {
  // The toolbar is a row inside the table's (sticky) header, just above the column headings,
  // so it stays in view while scrolling. It uses a <td>, so "thead th" column lookups are unaffected.
  const thead = table.querySelector('thead');
  const firstTh = thead ? thead.querySelector('th') : null;
  const headerRow = firstTh ? firstTh.parentElement : null;
  if (!thead || !headerRow) return;
  const colCount = Math.max(1, thead.querySelectorAll('th').length);

  let bar = document.getElementById('cno-gt-toolbar');
  if (bar && bar.parentNode === thead && bar.nextElementSibling === headerRow) {
    const cell = bar.firstElementChild;
    if (cell && String(cell.colSpan) !== String(colCount)) cell.colSpan = colCount;
    return;
  }
  if (bar) bar.remove();

  bar = document.createElement('tr');
  bar.id = 'cno-gt-toolbar';
  const barCell = document.createElement('td');
  barCell.className = 'cno-gt-cell';
  barCell.colSpan = colCount;
  const inner = document.createElement('div');
  inner.className = 'cno-gt-inner';
  barCell.appendChild(inner);
  bar.appendChild(barCell);

  const rebuild = () => { const b = document.getElementById('cno-gt-toolbar'); if (b) b.remove(); processGameTableModern(); };

  inner.appendChild(makeGameToolbarToggle('Hide empty books', cnoGameHideEmpty, () => {
    cnoGameHideEmpty = !cnoGameHideEmpty;
    rebuild();
  }));
  inner.appendChild(makeGameToolbarToggle('Pair 2-/3-way lines', cnoGamePairLines, () => {
    cnoGamePairLines = !cnoGamePairLines;
    try { chrome.storage.local.set({ [CNO_GAME_PAIR_KEY]: cnoGamePairLines }); } catch (e) { /* ignore */ }
    rebuild();
  }));

  const liq = document.createElement('label');
  liq.className = 'cno-gt-liq';
  liq.appendChild(document.createTextNode('Highlight liquidity under $'));
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '10';
  input.value = String(cnoGameLiqThreshold);
  input.dataset.hasEnterSubmit = 'true';
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); input.blur(); } });
  input.addEventListener('input', () => {
    const n = Number(input.value);
    if (input.value === '' || !isFinite(n) || n < 0) return;
    cnoGameLiqThreshold = n;
    try { chrome.storage.local.set({ [CNO_GAME_LIQ_KEY]: n }); } catch (e) { /* ignore */ }
    processGameTableModern();
  });
  liq.appendChild(input);
  inner.appendChild(liq);

  const classic = document.createElement('button');
  classic.type = 'button';
  classic.className = 'cno-gt-switch';
  cnoSetIconLabel(classic, 'classic', 'Show classic table');
  classic.title = 'Show the table the way CNO draws it (same as turning off "Restyle Game Odds Table" in the options)';
  classic.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setGameTableRestyle(false); });
  inner.appendChild(classic);

  thead.insertBefore(bar, headerRow);
}

// "+326 ($59 @ 23.5¢)" -> odds line + small "$59 · 23.5¢" line (class names avoid the "cno-" prefix
// on purpose: helpers that read a cell's odds skip anything the extension added with that prefix)
function splitExchangeCell(td) {
  if (td.dataset.lhSplit) return;
  const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    // Skip text inside things the extension added (QR tray, badges). Only look at elements
    // *inside* the cell: the cell itself carries extension classes (e.g. cno-has-hover-tray).
    let addedByExtension = false;
    for (let el = node.parentElement; el && el !== td; el = el.parentElement) {
      if (/(^|\s)cno-/.test(el.getAttribute('class') || '')) { addedByExtension = true; break; }
    }
    if (addedByExtension) continue;
    // "+326 ($59 @ 23.5¢)" (exchanges) or "-110 ($2,000)" (liquidity only, e.g. Pinnacle)
    const m = node.textContent.match(/^(\s*)([+-]\d+)\s*\(\$([\d,]+)(?:\s*@\s*([\d.]+)¢)?\)(\s*)$/);
    if (!m) continue;
    const frag = document.createDocumentFragment();
    const odds = document.createElement('span');
    odds.className = 'lh-odds';
    odds.textContent = m[2];
    const sub = document.createElement('span');
    sub.className = 'lh-sub';
    sub.dataset.liq = m[3].replace(/,/g, '');
    const liq = document.createElement('span');
    liq.className = 'lh-liq';
    liq.textContent = `$${m[3]}`;
    sub.appendChild(liq);
    if (m[4]) {
      const price = document.createElement('span');
      price.className = 'lh-price';
      price.textContent = `${m[4]}¢`;
      sub.appendChild(document.createTextNode('\u2009·\u2009')); // thin spaces keep the column narrow
      sub.appendChild(price);
    }
    frag.appendChild(odds);
    frag.appendChild(sub);
    td.dataset.lhOrigText = node.textContent; // to put the cell back for the classic table
    node.parentNode.replaceChild(frag, node);
    td.dataset.lhSplit = 'true';
    return;
  }
}

function processGameTableModern() {
  const table = getGameTable();
  if (!table) return;
  if (!isGameTableModern()) {
    // Option turned off: put the table back the way the site draws it
    table.classList.remove('lh-modern');
    const bar = document.getElementById('cno-gt-toolbar');
    if (bar) bar.remove();
    table.querySelectorAll('.lh-empty-hidden').forEach(el => el.classList.remove('lh-empty-hidden'));
    const pendingStyle = document.getElementById('cno-gt-pending-style'); // restyle off: show the site's table as-is
    if (pendingStyle) pendingStyle.remove();
    restoreSplitCells(table);
    if (cnoGameColFilter) clearGameColFilter(); // book filters are part of the enhanced table
    ensureEnhancedTableButton(table);
    return;
  }
  const classicBtn = document.getElementById('cno-gt-enhanced-btn');
  if (classicBtn) classicBtn.remove();
  loadGameTablePrefs();
  table.classList.add('lh-modern');
  ensureGameTableToolbar(table);

  const cols = getGameColumns(table);
  const ths = Array.from(table.querySelectorAll('thead th'));
  const rows = getGameDataRows(table);

  // Column roles
  ths.forEach((th, i) => {
    th.classList.toggle('lh-ref', i === cols.best || i === cols.fair);
    th.classList.toggle('lh-ref-end', i === cols.fair);
    th.classList.toggle('lh-name', i === cols.betName);
  });

  // Which book columns have any odds in the rows being shown (a refine can hide the rest)
  const hasOdds = new Set();
  rows.filter(r => !r.classList.contains('cno-game-hidden')).forEach(row => {
    cols.books.forEach(({ idx }) => {
      const cell = row.children[idx];
      if (cell && cellOdds(cell)) hasOdds.add(idx);
    });
  });

  const threshold = cnoGameLiqThreshold;
  const narrowCols = new Set();
  rows.forEach(row => {
    Array.from(row.children).forEach((td, i) => {
      td.classList.toggle('lh-name', i === cols.betName);
      td.classList.toggle('lh-ref', i === cols.best || i === cols.fair);
      td.classList.toggle('lh-ref-end', i === cols.fair);
      if (i !== cols.betName) splitExchangeCell(td);
      const sub = td.querySelector('.lh-sub');
      if (sub) {
        sub.classList.toggle('lh-low', Number(sub.dataset.liq) < threshold);
        narrowCols.add(i);
      }
    });
  });

  // Columns with liquidity lines: keep them as narrow as their contents (the table still fills
  // the page; the spare width goes to the other columns)
  ths.forEach((th, i) => th.classList.toggle('lh-narrow', narrowCols.has(i)));
  rows.forEach(row => Array.from(row.children).forEach((td, i) => td.classList.toggle('lh-narrow', narrowCols.has(i))));
  balanceNarrowColumns(table, cols);

  // Hide empty books (header + cells)
  cols.books.forEach(({ idx, th }) => {
    const hide = cnoGameHideEmpty && !hasOdds.has(idx);
    th.classList.toggle('lh-empty-hidden', hide);
    rows.forEach(row => { const c = row.children[idx]; if (c) c.classList.toggle('lh-empty-hidden', hide); });
  });
}

// Row order: lines are moved next to their other side(s), and each group banded, only when
// "Pair 2-/3-way lines" is on. Otherwise the site's own order, even while a book filter is on
// (the filter still keeps or hides each line together with its other side(s)).
function processGameRowOrdering() {
  const table = getGameTable();
  if (!table) return;
  const rows = getGameDataRows(table);

  // Sort by EV %: highest first; rows with no EV for that book keep their order at the bottom
  if (isGameTableModern() && cnoGameColFilter && cnoGameColFilter.mode === 'ev') {
    rows.forEach((row, i) => { if (row.dataset.cnoOrigIndex === undefined) row.dataset.cnoOrigIndex = String(i); });
    const evOf = (r) => { const v = parseFloat(r.dataset.cnoEv); return isFinite(v) ? v : null; };
    const sorted = rows.slice().sort((a, b) => {
      const ea = evOf(a), eb = evOf(b);
      if (ea === null && eb === null) return +a.dataset.cnoOrigIndex - +b.dataset.cnoOrigIndex;
      if (ea === null) return 1;
      if (eb === null) return -1;
      return (eb - ea) || (+a.dataset.cnoOrigIndex - +b.dataset.cnoOrigIndex);
    });
    const tbody = table.querySelector('tbody');
    if (tbody && !rows.every((r, i) => r === sorted[i])) {
      sorted.forEach(row => {
        const detail = row.nextElementSibling && row.nextElementSibling.classList.contains('footable-row-detail') ? row.nextElementSibling : null;
        tbody.appendChild(row);
        if (detail) tbody.appendChild(detail);
      });
    }
    rows.forEach(r => r.classList.remove('lh-band-a', 'lh-band-b', 'lh-group-end'));
    table.classList.remove('lh-paired');
    if (cnoCanRevealGameTable()) table.classList.add('lh-ready');
    return;
  }

  const pairing = isGameTableModern() && cnoGamePairLines;

  if (!pairing) {
    restoreGameRowOrder(table);
    rows.forEach(r => r.classList.remove('lh-band-a', 'lh-band-b', 'lh-group-end'));
    table.classList.remove('lh-paired');
    if (isGameTableModern() && cnoCanRevealGameTable()) table.classList.add('lh-ready'); // restyle done: reveal
    return;
  }

  const cols = getGameColumns(table);
  const groups = groupGameRows(rows, cols, 2);
  keepGameGroupsTogether(table, rows, groups);

  table.classList.add('lh-paired');
  if (cnoCanRevealGameTable()) table.classList.add('lh-ready');
  groups
    .map(g => g.slice().sort((a, b) => +a.dataset.cnoOrigIndex - +b.dataset.cnoOrigIndex))
    .sort((a, b) => +a[0].dataset.cnoOrigIndex - +b[0].dataset.cnoOrigIndex)
    .forEach((g, gi) => {
      g.forEach((row, ri) => {
        row.classList.toggle('lh-band-a', gi % 2 === 0);
        row.classList.toggle('lh-band-b', gi % 2 === 1);
        row.classList.toggle('lh-group-end', ri === g.length - 1);
      });
    });
}

// ====================================================
// GAME PAGE: KEEP THE LINKED-TO LINE IN VIEW
// Links into a game page (side_id=...) make the site scroll that line to the very top of the
// window, which puts it behind the pinned table header (taller now with the toolbar), and
// pairing can move rows after that scroll. For a few seconds after each table appears, if the
// linked line is hidden behind the header, scroll just enough to show it below the header.
// ====================================================

function processGameFocusRow() {
  const table = getGameTable();
  if (!table) return;
  let sideId = null;
  try {
    const params = new URLSearchParams(window.location.search);
    sideId = params.get('side_id') || params.get('sideid');
  } catch (e) { return; }
  if (!sideId) return;

  if (!table.dataset.lhBorn) table.dataset.lhBorn = String(Date.now());
  if (Date.now() - Number(table.dataset.lhBorn) > 6000) return; // only right after it loads

  const row = document.getElementById(sideId);
  const thead = table.querySelector('thead');
  if (!row || !thead || !table.contains(row)) return;

  const headerBottom = thead.getBoundingClientRect().bottom;
  const r = row.getBoundingClientRect();
  // Hidden (fully or partly) behind the pinned header, but not scrolled far away
  if (r.top < headerBottom && r.bottom > -5 && r.top > -r.height - 5) {
    window.scrollBy(0, r.top - headerBottom - 8);
  }
}

// ====================================================
// GAME PAGE: RESTYLE THE TABLE THE MOMENT IT APPEARS
// The regular 500ms pass can run late (or a slow step earlier in it can delay it), which let the
// site's original table show briefly. A DOM observer restyles a new table right away, before the
// browser paints it. It only acts while the page is waiting on a table (cno-gt-pending).
// ====================================================

// Reveal only once the remembered settings are known AND the page has finished loading. On the
// first load the table arrives with the page's HTML and its rows are still being added while the
// page loads; revealing it then showed the not-yet-restyled rows (the first-load flash).
// Also wait for the extension's settings and, when "Hide unwanted books" is on, the book list:
// otherwise the table showed every book first and then dropped the hidden ones (a big jump).
function cnoCanRevealGameTable() {
  if (!cnoGamePrefsReady || document.readyState === 'loading') return false;
  if (typeof userSettingsLoaded !== 'undefined' && !userSettingsLoaded) return false;
  if (typeof userSettings !== 'undefined' && userSettings.hideUnwantedGameBooks) {
    if (!cnoGameBookVisLoaded || !cnoGameBooks) return false;
  }
  return true;
}

let cnoGameTablePassBusy = false;
function cnoRunGameTablePass() {
  if (cnoGameTablePassBusy) return;
  cnoGameTablePassBusy = true;
  try {
    // Page layout around the table, done in the same pass so nothing above it jumps afterwards
    processGameFilterLayout();
    processPageHeaderLayout();
    const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
    if (table) {
      processGameBookColumns();
      processGameColFilter();
      processGameTableModern();
      processGameRowOrdering();
      processGameHeaderWidths();
      processGameFocusRow();
    }
  } catch (e) {
    console.warn('CNO Helper: game table restyle error', e);
  } finally {
    cnoGameTablePassBusy = false;
  }
}

if (/game\.aspx/i.test(window.location.pathname)) {
  loadGameTablePrefs();
  document.addEventListener('DOMContentLoaded', () => cnoRunGameTablePass());
  // While a table is waiting to be revealed (settings or book list still loading), retry often
  setInterval(() => {
    const t = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
    if (t && !t.classList.contains('lh-ready') && document.getElementById('cno-gt-pending-style')) cnoRunGameTablePass();
  }, 50);
  new MutationObserver(() => {
    if (document.readyState === 'loading') return; // wait for the full table (see cnoCanRevealGameTable)
    if (!document.getElementById('cno-gt-pending-style')) return;
    const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
    if (!table || table.classList.contains('lh-ready')) return;
    cnoRunGameTablePass();
  }).observe(document.documentElement, { childList: true, subtree: true });
}

// ====================================================
// GAME PAGE: SWITCH BETWEEN CLASSIC AND ENHANCED TABLE
// The buttons flip the same setting as the options page ("Restyle Game Odds Table").
// ====================================================

function setGameTableRestyle(on) {
  if (!on) { hideGameHeaderMenu(); if (cnoGameColFilter) clearGameColFilter(); } // the filters are part of the enhanced table
  if (typeof userSettings !== 'undefined') userSettings.modernizeGameTable = on;
  try { chrome.storage.local.set({ modernizeGameTable: on }); } catch (e) { /* ignore */ }
  const bar = document.getElementById('cno-gt-toolbar');
  if (bar) bar.remove();
  cnoRunGameTablePass();
}

// Put split cells back to the site's own text ("+326 ($59 @ 23.5¢)")
function restoreSplitCells(table) {
  table.querySelectorAll('td[data-lh-split]').forEach(td => {
    const odds = td.querySelector('.lh-odds');
    const sub = td.querySelector('.lh-sub');
    if (odds && td.dataset.lhOrigText !== undefined) {
      odds.parentNode.replaceChild(document.createTextNode(td.dataset.lhOrigText), odds);
    }
    if (sub) sub.remove();
    delete td.dataset.lhSplit;
    delete td.dataset.lhOrigText;
  });
  table.querySelectorAll('.lh-narrow, .lh-name, .lh-ref, .lh-ref-end').forEach(el =>
    el.classList.remove('lh-narrow', 'lh-name', 'lh-ref', 'lh-ref-end'));
}

// Classic table: a small "Show enhanced table" button just above it
function ensureEnhancedTableButton(table) {
  const host = table.parentElement;
  if (!host || !host.parentNode) return;
  let btn = document.getElementById('cno-gt-enhanced-btn');
  if (btn && btn.nextElementSibling === host) return;
  if (btn) btn.remove();
  btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'cno-gt-enhanced-btn';
  btn.className = 'cno-gt-switch';
  cnoSetIconLabel(btn, 'enhanced', 'Show enhanced table');
  btn.title = 'Turn the restyled table back on (same as "Restyle Game Odds Table" in the options)';
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); btn.remove(); setGameTableRestyle(true); });
  host.parentNode.insertBefore(btn, host);
}
// Liquidity columns are kept narrow so they don't soak up spare width, but when only a few books
// are shown the regular book columns get wide and the liquidity ones looked squeezed next to them.
// Make each liquidity column at least as wide as a regular book column (and never narrower than
// its own contents). A few quick passes let the widths settle, since they affect each other.
function balanceNarrowColumns(table, cols) {
  const visible = (th) => th.offsetWidth > 0;
  const narrow = cols.books.map(b => b.th).filter(th => th.classList.contains('lh-narrow') && visible(th));
  const regular = cols.books.map(b => b.th).filter(th => !th.classList.contains('lh-narrow') && visible(th));
  cols.books.forEach(b => { if (!b.th.classList.contains('lh-narrow') && b.th.style.width) b.th.style.width = ''; });
  if (!narrow.length) return;

  // Natural width: the CSS floor or the contents, whichever is wider
  narrow.forEach(th => { th.style.width = ''; });
  const natural = new Map(narrow.map(th => [th, th.offsetWidth]));
  if (!regular.length) return;

  for (let pass = 0; pass < 4; pass++) {
    const avgRegular = regular.reduce((sum, th) => sum + th.offsetWidth, 0) / regular.length;
    let changed = false;
    narrow.forEach(th => {
      const target = Math.round(Math.max(natural.get(th), avgRegular));
      if (Math.abs(th.offsetWidth - target) > 1) {
        th.style.width = `${target}px`;
        changed = true;
      }
    });
    if (!changed) break;
  }
}
