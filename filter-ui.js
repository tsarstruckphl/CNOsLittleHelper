// ====================================================
// DYNAMIC FILTER UI RESTYLING & CONDITIONAL CONTROLS
// ====================================================

const VALID_INJURY_LEAGUES = ['MLB', 'NBA', 'NFL', 'WNBA'];
const BET_CONTAINS_STORAGE_KEY = 'cno_user_bet_name_contains';
const AP_TOP25_STORAGE_KEY = 'cno_user_event_name_contains';

const ERASER_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="15" height="15" fill="currentColor" style="display:block;"><path d="M210.5 480L333.5 480L398.8 414.7L225.3 241.2L98.6 367.9L210.6 479.9zM256 544L210.5 544C193.5 544 177.2 537.3 165.2 525.3L49 409C38.1 398.1 32 383.4 32 368C32 352.6 38.1 337.9 49 327L295 81C305.9 70.1 320.6 64 336 64C351.4 64 366.1 70.1 377 81L559 263C569.9 273.9 576 288.6 576 304C576 319.4 569.9 334.1 559 345L424 480L544 480C561.7 480 576 494.3 576 512C576 529.7 561.7 544 544 544L256 544z"/></svg>`;

function getSelectedLeagueName(container = document) {
  const elLeague = container.querySelector('[id$="DropDownListLeague"]') || document.querySelector('[id$="DropDownListLeague"]');
  if (elLeague && elLeague.value && elLeague.value.toLowerCase() !== 'all' && elLeague.value !== '-1' && elLeague.value !== '0') {
    return elLeague.options[elLeague.selectedIndex]?.text?.trim().toUpperCase() || elLeague.value.toUpperCase();
  }
  return 'ALL';
}

function isEligibleInjuryLeagueSelected(container = document) {
  const leagueName = getSelectedLeagueName(container);
  return VALID_INJURY_LEAGUES.includes(leagueName);
}

// ----------------------------------------------------
// TOP-LEVEL HELPER FUNCTIONS
// ----------------------------------------------------

function createInputClearBtn(inputEl) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.tabIndex = -1;
  btn.title = 'Clear text';
  btn.innerHTML = ERASER_SVG_ICON;
  btn.style.cssText = `
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    height: 34px;
    width: 34px;
    padding: 0;
    cursor: pointer;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s, color 0.15s;
    flex-shrink: 0;
  `;

  btn.addEventListener('mouseover', () => {
    btn.style.background = '#e2e8f0';
    btn.style.color = '#0284c7';
  });
  btn.addEventListener('mouseout', () => {
    btn.style.background = '#f1f5f9';
    btn.style.color = '#475569';
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (inputEl) {
      inputEl.value = '';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      inputEl.focus();
    }
  });

  return btn;
}

function wrapField(labelText, inputEl, hintText = '', isImportant = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `cno-field${isImportant ? ' cno-field-important' : ''}`;
  
  const label = document.createElement('label');
  label.textContent = labelText;
  wrapper.appendChild(label);
  if (inputEl) wrapper.appendChild(inputEl);
  if (hintText) {
    const hint = document.createElement('span');
    hint.className = 'cno-hint';
    hint.textContent = hintText;
    wrapper.appendChild(hint);
  }
  return wrapper;
}

// ----------------------------------------------------
// INJURY EXCLUDE SYNTAX BUILDERS
// ----------------------------------------------------

function buildExcludeInjuredSyntax(originalText, names) {
  if (!names || names.length === 0) return originalText;

  const validNames = names.filter(s => s && s.toLowerCase() !== 'player');
  if (validNames.length === 0) return originalText;

  const negativeGroup = `(${validNames.map(s => `-${s}`).join(' and ')})`;
  const trimmed = (originalText || '').trim();

  if (!trimmed) {
    return negativeGroup;
  }

  return `(${trimmed}) and ${negativeGroup}`;
}

function buildInjectInjuredSyntax(originalText, names) {
  if (!names || names.length === 0) return originalText;

  const validNames = names.filter(s => s && s.toLowerCase() !== 'player');
  if (validNames.length === 0) return originalText;

  const orGroup = `(${validNames.join(' or ')})`;
  const trimmed = (originalText || '').trim();

  if (!trimmed) {
    return orGroup;
  }

  return `(${trimmed}) and ${orGroup}`;
}

// ----------------------------------------------------
// TOP 25 FILTER SYNTAX BUILDERS & CONTROLS
// ----------------------------------------------------

function getApRankedTeams(selectedSportKey) {
  const teams = [];
  if (typeof apRankingsMap !== 'undefined' && apRankingsMap) {
    apRankingsMap.forEach((rank, key) => {
      const [sport, normName] = key.split('|');
      if (selectedSportKey === 'ALL' || selectedSportKey === sport) {
        if (normName && normName.length > 2) {
          const schoolName = normName.replace(/\b\w/g, l => l.toUpperCase());
          teams.push(schoolName);
        }
      }
    });
  }
  return Array.from(new Set(teams));
}

function buildTop25InjectSyntax(originalText, teams) {
  if (!teams || teams.length === 0) return originalText;

  const formattedQueries = teams.map(team => `"${team} @*" or "*@ ${team}"`);
  const orGroup = `(${formattedQueries.join(' or ')})`;
  const trimmed = (originalText || '').trim();

  if (!trimmed) {
    return orGroup;
  }

  return `(${trimmed}) and ${orGroup}`;
}

function updateTop25CheckboxState(container = document) {
  const cb = container.querySelector('#cno-top25-cb') || document.querySelector('#cno-top25-cb');
  const cbWrap = container.querySelector('.cno-top25-wrapper') || document.querySelector('.cno-top25-wrapper');
  if (!cb || !cbWrap) return;

  const leagueName = getSelectedLeagueName(container);
  const isEligible = (leagueName === 'NCAAB' || leagueName === 'NCAAF');

  if (!isEligible) {
    cb.checked = false;
    cbWrap.style.display = 'none';
  } else {
    cb.disabled = false;
    cbWrap.style.display = 'inline-flex';
    cbWrap.title = "Filter to current AP Top 25 teams";
    cbWrap.style.opacity = '1.0';
    cbWrap.style.cursor = 'pointer';
    cb.style.cursor = 'pointer';
  }
}

// ----------------------------------------------------
// PRE-UPDATE FORM INTERCEPTOR
// ----------------------------------------------------

function prepareAndExecuteUpdate(container = document) {
  applyLowHoldHedgeBookPickerOnUpdate();
  const elBetContains = document.querySelector('[id$="TextBoxBetNameContains"]');
  const elInjuredOnlyCb = document.querySelector('#cno-injured-only-cb');

  if (elBetContains) {
    const currentVal = elBetContains.value;

    // "Injured Only": add the injured players' full names (alphabetical) for this Update only;
    // the user's own text is kept in sessionStorage and put back after the results load.
    // ("Exclude" doesn't touch the text box: it hides matching rows after the results load.)
    if (elInjuredOnlyCb && elInjuredOnlyCb.checked && !elInjuredOnlyCb.disabled) {
      if (sessionStorage.getItem(BET_CONTAINS_STORAGE_KEY) === null) {
        sessionStorage.setItem(BET_CONTAINS_STORAGE_KEY, currentVal);
      }
      const selectedCategory = getSelectedLeagueName(container);
      const names = (typeof getInjuredPlayerNames === 'function' ? getInjuredPlayerNames(selectedCategory, 'full') : [])
        .slice()
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      elBetContains.value = buildInjectInjuredSyntax(sessionStorage.getItem(BET_CONTAINS_STORAGE_KEY), names);
    } else {
      sessionStorage.removeItem(BET_CONTAINS_STORAGE_KEY);
    }
  }

  const elEventContains = document.querySelector('[id$="TextBoxEventNameContains"]');
  const elTop25Cb = document.querySelector('#cno-top25-cb');

  if (elEventContains) {
    if (elTop25Cb && elTop25Cb.checked && elTop25Cb.style.display !== 'none') {
      if (sessionStorage.getItem(AP_TOP25_STORAGE_KEY) === null) {
        sessionStorage.setItem(AP_TOP25_STORAGE_KEY, elEventContains.value);
        sessionStorage.setItem('cno_top25_cb_active', 'true');
      }

      const rawUserValue = sessionStorage.getItem(AP_TOP25_STORAGE_KEY) ?? '';
      const leagueName = getSelectedLeagueName(container);
      const top25Teams = getApRankedTeams(leagueName);

      elEventContains.value = buildTop25InjectSyntax(rawUserValue, top25Teams);
    } else {
      sessionStorage.removeItem(AP_TOP25_STORAGE_KEY);
      sessionStorage.removeItem('cno_top25_cb_active');
    }
  }
}

function restoreSavedBetNameContains(container = document) {
  const savedVal = sessionStorage.getItem(BET_CONTAINS_STORAGE_KEY);
  if (savedVal !== null) {
    const elBetContains = container.querySelector('[id$="TextBoxBetNameContains"]') || document.querySelector('[id$="TextBoxBetNameContains"]');
    if (elBetContains) {
      elBetContains.value = savedVal;
    }
    sessionStorage.removeItem(BET_CONTAINS_STORAGE_KEY);
  }

  const isTop25Active = sessionStorage.getItem('cno_top25_cb_active') === 'true';
  if (isTop25Active) {
    const savedEventVal = sessionStorage.getItem(AP_TOP25_STORAGE_KEY);
    const elEventContains = container.querySelector('[id$="TextBoxEventNameContains"]') || document.querySelector('[id$="TextBoxEventNameContains"]');
    if (elEventContains && savedEventVal !== null) {
      elEventContains.value = savedEventVal;
    }

    const elTop25Cb = container.querySelector('#cno-top25-cb') || document.querySelector('#cno-top25-cb');
    if (elTop25Cb) {
      elTop25Cb.checked = true;
    }

    sessionStorage.removeItem(AP_TOP25_STORAGE_KEY);
    sessionStorage.removeItem('cno_top25_cb_active');
  }
}

function triggerFilterUpdate(scopeElement = document) {
  prepareAndExecuteUpdate(scopeElement);
  const updateBtn = scopeElement.querySelector('input[type="submit"][id*="ButtonUpdate"]') || 
                    document.querySelector('input[type="submit"][id*="ButtonUpdate"]');
  if (updateBtn) {
    updateBtn.click();
  } else if (typeof __doPostBack === 'function') {
    const mainSelect = scopeElement.querySelector('select');
    if (mainSelect) __doPostBack(mainSelect.name, '');
  }
}

function bindSelectEnterSubmits(container = document) {
  const selects = container.querySelectorAll('select, input[type="text"]');
  selects.forEach(el => {
    if (!el.dataset.hasEnterSubmit) {
      el.dataset.hasEnterSubmit = "true";
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerFilterUpdate(container);
        }
      });
    }
  });
}

function syncBoostUIState(scopeElement = document) {
  const radioList = scopeElement.querySelector('table[id*="RadioButtonListOddsBoostType"]') || document.querySelector('table[id*="RadioButtonListOddsBoostType"]');
  const spanPct = document.getElementById('spanBoostPercentage');
  const spanOdds = document.getElementById('spanBoostOdds');

  if (!spanPct || !spanOdds) return;

  const checkedRadio = radioList ? radioList.querySelector('input[type="radio"]:checked') : null;
  const val = checkedRadio ? checkedRadio.value : 'profit';

  if (val === 'surge') {
    spanPct.classList.remove('cno-show-boost');
    spanPct.classList.add('cno-hide-boost');

    spanOdds.classList.remove('cno-hide-boost');
    spanOdds.classList.add('cno-show-boost');
  } else {
    spanOdds.classList.remove('cno-show-boost');
    spanOdds.classList.add('cno-hide-boost');

    spanPct.classList.remove('cno-hide-boost');
    spanPct.classList.add('cno-show-boost');
  }
}

function bindMainlinesDependency(elIsMain, elHedgeBookIsMain) {
  if (!elIsMain || !elHedgeBookIsMain) return;

  const updateHedgeState = () => {
    const parentLabel = elHedgeBookIsMain.closest('label') || elHedgeBookIsMain.parentElement;

    if (!elIsMain.checked) {
      elHedgeBookIsMain.checked = false;
      elHedgeBookIsMain.disabled = true;
      if (parentLabel) parentLabel.style.opacity = '0.5';
    } else {
      elHedgeBookIsMain.disabled = false;
      if (parentLabel) parentLabel.style.opacity = '1.0';
    }
  };

  if (!elIsMain.dataset.hasHedgeDepListener) {
    elIsMain.addEventListener('change', updateHedgeState);
    elIsMain.dataset.hasHedgeDepListener = "true";
  }

  updateHedgeState();
}

function bindSportLeagueMutualExclusion(elSport, elLeague, container = document) {
  if (!elSport || !elLeague) return;

  const handleLeagueChange = () => {
    updateExcludeInjuredCheckboxState(container);
    updateTop25CheckboxState(container);
  };

  if (!elSport.dataset.hasMutualExclusion) {
    elSport.dataset.hasMutualExclusion = "true";
    elSport.addEventListener('change', () => {
      const isSportAll = !elSport.value || elSport.value.toLowerCase() === 'all' || elSport.value === '-1' || elSport.value === '0';
      if (!isSportAll) {
        for (let opt of elLeague.options) {
          if (!opt.value || opt.value.toLowerCase() === 'all' || opt.value === '-1' || opt.value === '0') {
            elLeague.value = opt.value;
            break;
          }
        }
      }
      handleLeagueChange();
    });
  }

  if (!elLeague.dataset.hasMutualExclusion) {
    elLeague.dataset.hasMutualExclusion = "true";
    elLeague.addEventListener('change', () => {
      const isLeagueAll = !elLeague.value || elLeague.value.toLowerCase() === 'all' || elLeague.value === '-1' || elLeague.value === '0';
      if (!isLeagueAll) {
        for (let opt of elSport.options) {
          if (!opt.value || opt.value.toLowerCase() === 'all' || opt.value === '-1' || opt.value === '0') {
            elSport.value = opt.value;
            break;
          }
        }
      }
      handleLeagueChange();
    });
  }
}

function isExcludeInjuredLeagueAllowed(container = document) {
  const leagueName = getSelectedLeagueName(container);
  return leagueName === 'ALL' || VALID_INJURY_LEAGUES.includes(leagueName);
}

// Exclude: enabled for All + MLB/NBA/NFL/WNBA. Injured Only: enabled for MLB/NBA/NFL/WNBA only.
function updateExcludeInjuredCheckboxState(container = document) {
  const setState = (cbId, enabled, enabledTip, disabledTip) => {
    const cb = container.querySelector(`#${cbId}`) || document.querySelector(`#${cbId}`);
    if (!cb) return;
    const wrap = cb.closest('label') || cb.parentElement;
    if (!enabled) {
      cb.checked = false;
      cb.disabled = true;
      if (wrap) {
        wrap.title = disabledTip;
        wrap.style.opacity = '0.5';
        wrap.style.cursor = 'not-allowed';
      }
      cb.style.cursor = 'not-allowed';
    } else {
      cb.disabled = false;
      if (wrap) {
        wrap.title = enabledTip;
        wrap.style.opacity = '1.0';
        wrap.style.cursor = 'pointer';
      }
      cb.style.cursor = 'pointer';
    }
  };

  setState('cno-exclude-injured-cb', isExcludeInjuredLeagueAllowed(container),
    'Hide rows for players on the injury report (MLB, NBA, NFL, WNBA rows)',
    'Select All, MLB, NBA, NFL, or WNBA from League to enable');
  setState('cno-injured-only-cb', isEligibleInjuryLeagueSelected(container),
    "Only show bets on players on the selected league's injury report",
    'Select MLB, NBA, NFL, or WNBA from League to enable');
}

function updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookWrapper, hedgeMainWrapper, sortByWrapper = null, hedgePickerWrapper = null) {
  if (!elProfitStrategy) return;

  const update = () => {
    const selectedVal = elProfitStrategy.value;
    const selectedText = elProfitStrategy.options[elProfitStrategy.selectedIndex]?.text?.trim().toLowerCase() || elProfitStrategy.value.toLowerCase();
    const isHedge = selectedVal === '0' || selectedText.includes('hedge');

    if (sameBookWrapper) {
      sameBookWrapper.style.display = isHedge ? 'flex' : 'none';
    }
    if (hedgeMainWrapper) {
      hedgeMainWrapper.style.display = isHedge ? 'flex' : 'none';
    }
    if (sortByWrapper) {
      sortByWrapper.style.display = isHedge ? 'flex' : 'none';
    }
    if (hedgePickerWrapper) {
      hedgePickerWrapper.style.display = isHedge ? '' : 'none';
    }
  };

  if (!elProfitStrategy.dataset.hasHedgeVisListener) {
    elProfitStrategy.addEventListener('change', update);
    elProfitStrategy.dataset.hasHedgeVisListener = "true";
  }

  update();
}

function buildCrossToolUrl(targetPage, scopeContainer = document) {
  const getEl = (suffix) => scopeContainer.querySelector(`[id$="${suffix}"]`) || document.querySelector(`[id$="${suffix}"]`);

  const params = new URLSearchParams();

  const elSportsbook = getEl('DropDownListSportsbookSite_All') || getEl('DropDownListSportsbookSite_NonDFS');
  const elSport = getEl('DropDownListSport');
  const elLeague = getEl('DropDownListLeague');
  const elMinOdds = getEl('TextBoxMinimumOdds');
  const elMaxOdds = getEl('TextBoxMaximumOdds');
  const elEventContains = getEl('TextBoxEventNameContains');
  const elMaxHours = getEl('TextBoxMaximumDateHours');
  const elMarketContains = getEl('TextBoxMarketNameContains');
  const elBetContains = getEl('TextBoxBetNameContains');
  const elMinPoints = getEl('TextBoxMinimumBetPoints');
  const elMaxPoints = getEl('TextBoxMaximumBetPoints');
  const elMinLiq = getEl('TextBoxMinimumLiquidity');
  const elIsMain = getEl('CheckBoxIsMain');
  const elIsLive = getEl('CheckBoxIsLive');
  const elMinSides = getEl('TextBoxMinimumSubMarketSideCount');
  const elMaxSides = getEl('TextBoxMaximumSubMarketSideCount');
  const elMinBooks = getEl('TextBoxMinimumOddsProviderCount');
  const elMaxResults = getEl('TextBoxMaximumResultCount');

  if (elSportsbook && elSportsbook.value) params.set('site_id', elSportsbook.value);
  if (elSport && elSport.value) params.set('sport', elSport.value);
  if (elLeague && elLeague.value) params.set('league', elLeague.value);
  if (elMinOdds && elMinOdds.value.trim()) params.set('odds_min', elMinOdds.value.trim());
  if (elMaxOdds && elMaxOdds.value.trim()) params.set('odds_max', elMaxOdds.value.trim());
  if (elEventContains && elEventContains.value.trim()) params.set('event_name', elEventContains.value.trim());
  if (elMaxHours && elMaxHours.value.trim()) params.set('starts_within_h', elMaxHours.value.trim());
  if (elMarketContains && elMarketContains.value.trim()) params.set('market_name', elMarketContains.value.trim());
  if (elBetContains && elBetContains.value.trim()) params.set('bet_name', elBetContains.value.trim());
  if (elMinPoints && elMinPoints.value.trim()) params.set('points_min', elMinPoints.value.trim());
  if (elMaxPoints && elMaxPoints.value.trim()) params.set('points_max', elMaxPoints.value.trim());
  if (elMinLiq && elMinLiq.value.trim()) params.set('liq_min', elMinLiq.value.trim());
  
  if (elIsMain) params.set('main', elIsMain.checked ? '1' : '0');
  if (elIsLive) params.set('live', elIsLive.checked ? '1' : '0');

  if (elMinSides && elMinSides.value.trim()) params.set('sides_min', elMinSides.value.trim());
  if (elMaxSides && elMaxSides.value.trim()) params.set('sides_max', elMaxSides.value.trim());
  if (elMinBooks && elMinBooks.value.trim()) params.set('books_min', elMinBooks.value.trim());
  if (elMaxResults && elMaxResults.value.trim()) params.set('result_max', elMaxResults.value.trim());

  const destKey = (targetPage.match(/\/([a-z0-9-]+)\.aspx/i) || [])[1] || 'positive-ev';

  // Hedge Sportsbook Filter selection (only when it's narrowed down)
  const hedgeSel = getHedgeBookPickerSelection();
  if (hedgeSel && ['low-hold', 'odds-boost', 'free-bet-converter', 'risk-free-bet', 'bet-and-get', 'win-and-get'].includes(destKey)) {
    params.set('cno_hedge_books', hedgeSel.join('|'));
  }

  const hasBoost = destKey === 'odds-boost';
  const hasReward = ['risk-free-bet', 'win-and-get', 'bet-and-get'].includes(destKey);

  // Only carry over fields the destination page actually has
  if (hasBoost) {
    const boostTypeEl = document.querySelector('input[name$="RadioButtonListOddsBoostType"]:checked');
    if (boostTypeEl && boostTypeEl.value) params.set('boost_type', boostTypeEl.value.trim());

    // Only read real boost boxes. (The old fallback searched the whole page when there was no boost
    // box, e.g. on Positive EV, and picked up the first text box: Minimum Odds.)
    const spanPctEl = document.getElementById('spanBoostPercentage');
    const spanOddsEl = document.getElementById('spanBoostOdds');
    const pctEl = getEl('TextBoxBoostPercentage') || (spanPctEl ? spanPctEl.querySelector('input[type="text"]') : null);
    const oddsEl = getEl('TextBoxBoostOdds') || (spanOddsEl ? spanOddsEl.querySelector('input[type="text"]') : null);
    if (pctEl && pctEl.value && pctEl.value.trim()) params.set('boost_pct', pctEl.value.trim());
    if (oddsEl && oddsEl.value && oddsEl.value.trim()) params.set('boost_odds', oddsEl.value.trim());

    params.set('profit_strategy', '1');
  }

  if (hasReward) {
    const rewardEl = getEl('TextBoxReward');
    if (rewardEl && rewardEl.value.trim()) params.set('reward', rewardEl.value.trim());

    const convEl = document.querySelector('input[name$="RadioButtonListFreeCreditConversionRate"]:checked');
    if (convEl && convEl.value) params.set('fccr_type', convEl.value.trim());

    const customEl = getEl('TextBoxFreeCreditConversionRate');
    if (customEl && customEl.value.trim()) params.set('fccr', customEl.value.trim());
  }

  const baseUrl = `/site/tools/${destKey}.aspx`;
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

const SWITCH_PAGES = [
  { key: 'positive-ev', label: 'Positive EV', icon: 'positiveEv', shortcut: 'E' },
  { key: 'odds-boost', label: 'Odds Boost', icon: 'rocket', shortcut: 'B' },
  { key: 'free-bet-converter', label: 'Free Bet', icon: 'gift', shortcut: 'F' },
  { key: 'risk-free-bet', label: 'Risk Free Bet', icon: 'shield', shortcut: 'K' },
  { key: 'bet-and-get', label: 'Bet and Get', icon: 'ticket', shortcut: 'G' },
  { key: 'win-and-get', label: 'Win and Get', icon: 'trophy', shortcut: 'W' },
  { key: 'low-hold', label: 'Low Hold', icon: 'lowHold', shortcut: 'L' }
];

// Swap Page shortcuts: Ctrl+Alt+<letter> (Windows/Linux) or Ctrl+Cmd+<letter> (Mac)
function cnoSwapShortcutLabel(letter) {
  return typeof cnoIsMac === 'function' && cnoIsMac() ? `Ctrl+\u2318+${letter}` : `Ctrl+Alt+${letter}`;
}

// Goes to another tool page, carrying the current selections over (same as the Swap Page menu)
function cnoSwapToPage(key) {
  const container = getFilterAccordionContainer() || document;
  window.location.href = buildCrossToolUrl(`/site/tools/${key}.aspx`, container);
}

document.addEventListener('keydown', (e) => {
  if (e.repeat || !/^Key[A-Z]$/.test(e.code)) return;
  const matches = cnoIsMac()
    ? (e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey)
    : (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey);
  if (!matches) return;
  const page = SWITCH_PAGES.find(p => p.shortcut === e.code.slice(3));
  if (!page) return;
  // Only where the Swap Page button is offered, and not for the page you're on
  if (!document.getElementById('cno-switch-page-btn')) return;
  if (window.location.pathname.toLowerCase().includes(`${page.key}.aspx`)) return;
  e.preventDefault();
  e.stopPropagation();
  cnoSwapToPage(page.key);
}, true);

// Hover (or click) drop-down listing the other tool pages
function attachSwitchPageMenu(btn) {
  let menu = null;
  let hideTimer = null;

  const cancelHide = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
  const hide = () => { cancelHide(); if (menu) { menu.remove(); menu = null; } };
  const scheduleHide = () => { cancelHide(); hideTimer = setTimeout(hide, 180); };

  const show = () => {
    cancelHide();
    if (menu) return;

    const currentPath = window.location.pathname.toLowerCase();
    menu = document.createElement('div');
    menu.id = 'cno-switch-page-menu';
    menu.style.cssText = `
      position: fixed; z-index: 1000001; min-width: 170px;
      background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.18); padding: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    SWITCH_PAGES.filter(p => !currentPath.includes(`${p.key}.aspx`)).forEach(p => {
      const item = document.createElement('button');
      item.type = 'button';
      cnoSetIconLabel(item, p.icon, p.label);
      // The page's shortcut, on the right
      const keys = document.createElement('span');
      keys.textContent = cnoSwapShortcutLabel(p.shortcut);
      keys.style.cssText = 'margin-left:auto; padding-left:18px; font-size:0.72rem; font-weight:500; color:#94a3b8;';
      item.appendChild(keys);
      item.title = `Shortcut: ${cnoSwapShortcutLabel(p.shortcut)}`;
      item.style.cssText = 'display:flex; align-items:center; gap:4px; width:100%; text-align:left; background:none; border:none; padding:7px 10px; font-size:0.85rem; font-weight:600; color:#0369a1; cursor:pointer; border-radius:4px; white-space:nowrap;';
      item.addEventListener('mouseover', () => item.style.background = '#f0f9ff');
      item.addEventListener('mouseout', () => item.style.background = 'none');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        hide();
        cnoSwapToPage(p.key);
      });
      menu.appendChild(item);
    });

    menu.addEventListener('mouseenter', cancelHide);
    menu.addEventListener('mouseleave', scheduleHide);
    document.body.appendChild(menu);

    const rect = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${rect.bottom + 2}px`;
  };

  btn.addEventListener('mouseenter', show);
  btn.addEventListener('mouseleave', scheduleHide);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu) hide(); else show();
  });
}

// Drops the filter values from the address (?site_id=1&league=6...) without reloading, so a
// refresh after Clear Filters doesn't bring them back. The form's own address gets the same
// treatment, since CNO's updates post back to it.
function cnoStripFilterQueryFromUrl() {
  if (!window.location.search) return;
  try { history.replaceState(history.state, '', window.location.pathname + window.location.hash); } catch (e) { /* ignore */ }
  document.querySelectorAll('form[action]').forEach(f => {
    const action = f.getAttribute('action');
    if (action && action.includes('?')) f.setAttribute('action', action.split('?')[0]);
  });
}

function clearAllPageFilters(container = document) {
  cnoStripFilterQueryFromUrl();
  sessionStorage.removeItem(AP_TOP25_STORAGE_KEY);
  sessionStorage.removeItem('cno_top25_cb_active');
  sessionStorage.removeItem(BET_CONTAINS_STORAGE_KEY);

  const currentPath = window.location.pathname.toLowerCase();
  const isOddsBoostPage = currentPath.includes('odds-boost.aspx');
  const isRiskFreeBetPage = currentPath.includes('risk-free-bet.aspx');
  const isBetAndGetPage = currentPath.includes('bet-and-get.aspx');
  const isWinAndGetPage = currentPath.includes('win-and-get.aspx');

  const getEl = (suffix) => container.querySelector(`[id$="${suffix}"]`) || document.querySelector(`[id$="${suffix}"]`);

  const selectsToReset = [
    'DropDownListSportsbookSite_All',
    'DropDownListSportsbookSite_NonDFS',
    'DropDownListSport',
    'DropDownListLeague'
  ];

  selectsToReset.forEach(suffix => {
    const el = getEl(suffix);
    if (el) {
      el.selectedIndex = 0;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  const textInputsToClear = [
    'TextBoxMinimumOdds',
    'TextBoxMaximumOdds',
    'TextBoxEventNameContains',
    'TextBoxMaximumDateHours',
    'TextBoxMarketNameContains',
    'TextBoxBetNameContains',
    'TextBoxMinimumBetPoints',
    'TextBoxMaximumBetPoints'
  ];

  textInputsToClear.forEach(suffix => {
    const el = getEl(suffix);
    if (el) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const elExcludeCb = container.querySelector('#cno-exclude-injured-cb') || document.querySelector('#cno-exclude-injured-cb');
  if (elExcludeCb) {
    elExcludeCb.checked = false;
  }
  const elInjuredOnlyCb = container.querySelector('#cno-injured-only-cb') || document.querySelector('#cno-injured-only-cb');
  if (elInjuredOnlyCb) {
    elInjuredOnlyCb.checked = false;
  }

  // Low Hold hedge sportsbook picker: back to all books (takes effect on the next Update, like the other fields)
  syncLowHoldHedgeBookPicker(null);

  // Multi-league filter: back to all leagues
  setMultiLeagueSelection(null);
  if (typeof setMlbWeatherFilter === 'function') setMlbWeatherFilter('all');

  const elTop25Cb = container.querySelector('#cno-top25-cb') || document.querySelector('#cno-top25-cb');
  if (elTop25Cb) {
    elTop25Cb.checked = false;
  }

  const elIsLive = getEl('CheckBoxIsLive');
  if (elIsLive) {
    elIsLive.checked = false;
  }

  // Minimum Liquidity: the site's default is blank on every page
  const elMinLiq = getEl('TextBoxMinimumLiquidity');
  if (elMinLiq) {
    elMinLiq.value = '';
    elMinLiq.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Mainlines Only / Mainlines Only for Hedge Book
  const elIsMain = getEl('CheckBoxIsMain');
  if (elIsMain && elIsMain.checked) {
    elIsMain.checked = false;
    elIsMain.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const elHedgeIsMain = getEl('CheckBoxHedgeBook_IsMain');
  if (elHedgeIsMain && elHedgeIsMain.checked) {
    elHedgeIsMain.checked = false;
    elHedgeIsMain.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (isOddsBoostPage) {
    const radioTableBoost = getEl('RadioButtonListOddsBoostType');
    if (radioTableBoost) {
      const profitRadio = radioTableBoost.querySelector('input[value="profit"]');
      if (profitRadio) {
        profitRadio.checked = true;
        radioTableBoost.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    const spanBoostPct = document.getElementById('spanBoostPercentage');
    const spanBoostOdds = document.getElementById('spanBoostOdds');
    if (spanBoostPct) {
      const inputPct = spanBoostPct.querySelector('input[type="text"]');
      if (inputPct) inputPct.value = '';
    }
    if (spanBoostOdds) {
      const inputOdds = spanBoostOdds.querySelector('input[type="text"]');
      if (inputOdds) inputOdds.value = '';
    }
    syncBoostUIState(container);
  }

  if (isRiskFreeBetPage || isBetAndGetPage || isWinAndGetPage) {
    const elReward = getEl('TextBoxReward');
    if (elReward) {
      elReward.value = '100%';
      elReward.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const radioListConversion = getEl('RadioButtonListFreeCreditConversionRate');
    if (radioListConversion) {
      const freeBetOption = radioListConversion.querySelector('input[id$="_0"]');
      if (freeBetOption) {
        freeBetOption.checked = true;
        radioListConversion.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  updateExcludeInjuredCheckboxState(container);
  updateTop25CheckboxState(container);

  // Then fill in the defaults the user saved on CNO's Settings page (Defaults section)
  applySiteDefaults(container);
  // ...and the user's default boost amount (Odds Boost page)
  if (isOddsBoostPage) applyBoostDefault(true);
}

function setupFilterToggle() {
  const currentPath = window.location.pathname.toLowerCase();
  const isMarketsPage = currentPath.includes('markets.aspx');
  const isGamesPage = currentPath.includes('games.aspx');
  const isPosEvPage = currentPath.includes('positive-ev.aspx');
  const isOddsBoostPage = currentPath.includes('odds-boost.aspx');
  const isNonAccordionPage = isMarketsPage || isGamesPage;

  const accordion = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion');
  const header = accordion ? accordion.querySelector('.accordionHeaderSelected, .accordionHeader') : document.querySelector('.accordionHeaderSelected, .accordionHeader');
  
  let targetHeader = header;

  if (isNonAccordionPage) {
    const wrapperId = isGamesPage ? 'cno-games-filter-wrapper' : 'cno-markets-filter-wrapper';
    const headerClass = isGamesPage ? '.cno-games-header' : '.cno-markets-header';
    const classicHeaderId = isGamesPage ? 'cno-games-classic-header' : 'cno-markets-classic-header';

    const wrapper = document.getElementById(wrapperId);
    const isClassic = userSettings.useClassicFilterView === true;

    if (!isClassic && wrapper) {
      targetHeader = wrapper.querySelector(headerClass);
    } else {
      let classicHeader = document.getElementById(classicHeaderId);
      const sportSelect = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_WebUserControl_FilterSport_DropDownListSport');
      
      if (sportSelect) {
        if (!classicHeader) {
          classicHeader = document.createElement('div');
          classicHeader.id = classicHeaderId;
          classicHeader.style.cssText = `
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin-bottom: 8px;
            padding: 4px 0;
            width: 100%;
          `;
          
          const parent = sportSelect.parentElement;
          let nodeToInsertBefore = sportSelect;
          if (sportSelect.previousSibling && sportSelect.previousSibling.nodeType === Node.TEXT_NODE && sportSelect.previousSibling.textContent.includes('Sport:')) {
            nodeToInsertBefore = sportSelect.previousSibling;
          }
          parent.insertBefore(classicHeader, nodeToInsertBefore);
        }
        targetHeader = classicHeader;
      }
    }
  }

  if (!targetHeader) return;

  targetHeader.style.display = 'flex';
  targetHeader.style.justify = 'space-between';
  targetHeader.style.alignItems = 'center';

  let btnGroup = targetHeader.querySelector('.cno-header-btn-group');
  if (!btnGroup) {
    btnGroup = document.createElement('div');
    btnGroup.className = 'cno-header-btn-group';
    btnGroup.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-left: auto;';
    targetHeader.appendChild(btnGroup);
  }

  let clearBtn = document.getElementById('cno-clear-filters-btn');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.id = 'cno-clear-filters-btn';
    clearBtn.type = 'button';
    clearBtn.style.cssText = `
      padding: 3px 10px;
      font-size: 0.8rem;
      font-weight: bold;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0369a1;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    `;
    clearBtn.innerHTML = `${ERASER_SVG_ICON} Clear Filters`;
    clearBtn.addEventListener('mouseenter', () => cnoShowUpdateHint(clearBtn, `Shortcut: ${cnoClearShortcutLabel()}`));
    clearBtn.addEventListener('mouseleave', cnoHideUpdateHint);
    clearBtn.addEventListener('click', cnoHideUpdateHint);
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      const container = getFilterAccordionContainer() || 
                        document.getElementById('cno-markets-filter-wrapper') || 
                        document.getElementById('cno-games-filter-wrapper') || 
                        document;
      clearAllPageFilters(container);
    };
  }

  if (!btnGroup.contains(clearBtn)) {
    btnGroup.insertBefore(clearBtn, btnGroup.firstChild);
  }

  if (!isNonAccordionPage) {
    ensureSavedFilterButtons(btnGroup, clearBtn);
  }

  const isClassic = userSettings.useClassicFilterView === true;

  const currentPathForSwitch = window.location.pathname.toLowerCase();
  const isSwitchPage = SWITCH_PAGES.some(p => currentPathForSwitch.includes(`${p.key}.aspx`));

  const oldCrossBtn = document.getElementById('cno-cross-tool-btn');
  if (oldCrossBtn) oldCrossBtn.remove();

  let switchBtn = document.getElementById('cno-switch-page-btn');
  if (isSwitchPage && !isNonAccordionPage) {
    if (!switchBtn) {
      switchBtn = document.createElement('button');
      switchBtn.id = 'cno-switch-page-btn';
      switchBtn.type = 'button';
      cnoSetIconLabel(switchBtn, 'swap', 'Swap Page', '▾');
      switchBtn.style.cssText = `
        padding: 3px 10px;
        font-size: 0.8rem;
        font-weight: bold;
        border-radius: 4px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #0369a1;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      `;
      attachSwitchPageMenu(switchBtn);
    }
    if (!btnGroup.contains(switchBtn)) {
      btnGroup.appendChild(switchBtn);
    }
  } else if (switchBtn) {
    switchBtn.remove();
  }

  let toggleBtn = document.getElementById('cno-view-toggle-btn');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'cno-view-toggle-btn';
    toggleBtn.type = 'button';
  }

  toggleBtn.style.cssText = `
    padding: 3px 10px;
    font-size: 0.8rem;
    font-weight: bold;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0369a1;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  `;

  if (isClassic) cnoSetIconLabel(toggleBtn, 'enhanced', 'Switch to Enhanced Filters');
  else cnoSetIconLabel(toggleBtn, 'classic', 'Switch to Classic Filters');

  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    const currentlyClassic = userSettings.useClassicFilterView === true;
    const newClassicState = !currentlyClassic;
    cnoSetUserSetting('useClassicFilterView', newClassicState);

    const container = getFilterAccordionContainer() || 
                      document.getElementById('cno-markets-filter-wrapper') || 
                      document.getElementById('cno-games-filter-wrapper');
    if (container) {
      delete container.dataset.restyled;
      delete container.dataset.cnoClassicApplied;
      if (newClassicState) {
        revertToClassicView(container);
      } else {
        const oldMarketsClassic = document.getElementById('cno-markets-classic-header');
        if (oldMarketsClassic) oldMarketsClassic.remove();
        const oldGamesClassic = document.getElementById('cno-games-classic-header');
        if (oldGamesClassic) oldGamesClassic.remove();

        restyleFilterPanel();
      }
    }
  };

  if (!btnGroup.contains(toggleBtn)) {
    btnGroup.appendChild(toggleBtn);
  }

  let optionsBtn = document.getElementById('cno-options-btn');
  if (!optionsBtn) {
    optionsBtn = document.createElement('button');
    optionsBtn.id = 'cno-options-btn';
    optionsBtn.type = 'button';
    cnoSetIconLabel(optionsBtn, 'options', 'CNO LH Options');
    optionsBtn.style.cssText = `
      padding: 3px 10px;
      font-size: 0.8rem;
      font-weight: bold;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0369a1;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      margin-left: 44px;
    `;
    optionsBtn.onclick = (e) => {
      e.stopPropagation();
      try {
        chrome.runtime.sendMessage({ type: 'cno-open-options' });
      } catch (err) {
        console.warn('CNO Helper: could not open the options page', err);
      }
    };
  }
  if (optionsBtn.nextElementSibling !== toggleBtn || optionsBtn.parentNode !== btnGroup) {
    btnGroup.insertBefore(optionsBtn, toggleBtn);
  }
}

function revertToClassicView(container) {
  // restyleFilterPanel() runs every 500ms. Rebuilding the panel each time replaced the focused
  // box, which broke tabbing (and could wipe typed text), so only rebuild it once.
  if (container.dataset.cnoClassicApplied === 'true') {
    container.classList.add('cno-ready');
    return;
  }

  if (container.dataset.originalHTML) {
    container.innerHTML = container.dataset.originalHTML;
  }
  container.dataset.cnoClassicApplied = 'true';

  // The saved markup can carry "already bound" markers from before; clear them so Enter-to-update binds again
  container.querySelectorAll('[data-has-enter-submit]').forEach(el => el.removeAttribute('data-has-enter-submit'));

  const radios = container.querySelectorAll('input[type="radio"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => syncBoostUIState(container));
  });

  syncBoostUIState(container);
  bindSelectEnterSubmits(container);
  restoreSavedBetNameContains(container);
  setupFilterToggle();
  container.classList.add('cno-ready');
}

function removeAllTextNodes(element) {
  if (!element) return;
  const childNodes = Array.from(element.childNodes);
  childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.remove();
    } else if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'SELECT', 'OPTION', 'OPTGROUP', 'TEXTAREA'].includes(node.tagName)) {
      // Dropdown option labels are text nodes too; stripping them left the Sort By list blank
      removeAllTextNodes(node);
    }
  });
}

function createSportLeagueOrRow(elSport, elLeague, container = document) {
  bindSportLeagueMutualExclusion(elSport, elLeague, container);

  const row = document.createElement('div');
  row.style.cssText = 'display: flex; align-items: flex-end; gap: 6px; width: 100%;';

  const sportWrap = document.createElement('div');
  sportWrap.className = 'cno-field cno-field-important';
  sportWrap.style.cssText = 'width: 30%; flex-shrink: 0;';
  sportWrap.innerHTML = `<label>Sport</label>`;
  if (elSport) sportWrap.appendChild(elSport);

  const orDivider = document.createElement('div');
  orDivider.style.cssText = `
    font-size: 0.82rem;
    font-weight: 700;
    color: #64748b;
    padding-bottom: 7px;
    user-select: none;
  `;
  orDivider.textContent = 'OR';

  const leagueWrap = document.createElement('div');
  leagueWrap.className = 'cno-field cno-field-important';
  leagueWrap.style.cssText = 'flex: 1; min-width: 0;';
  leagueWrap.innerHTML = `<label>League</label>`;
  if (elLeague) leagueWrap.appendChild(elLeague);

  row.appendChild(sportWrap);
  row.appendChild(orDivider);
  row.appendChild(leagueWrap);

  return row;
}

function wrapMarketWithSearchModal(labelText, inputEl, hintText = '', isImportant = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `cno-field${isImportant ? ' cno-field-important' : ''}`;
  
  const label = document.createElement('label');
  label.textContent = labelText;
  wrapper.appendChild(label);

  if (inputEl) {
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display: flex; align-items: center; gap: 4px; position: relative;';

    inputEl.style.flex = '1';
    inputRow.appendChild(inputEl);

    const clearBtn = createInputClearBtn(inputEl);
    inputRow.appendChild(clearBtn);

    const searchIcon = document.createElement('button');
    searchIcon.type = 'button';
    searchIcon.tabIndex = -1;
    searchIcon.title = 'Search Market Names';
    searchIcon.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    `;
    searchIcon.style.cssText = `
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      height: 34px;
      width: 34px;
      padding: 0;
      cursor: pointer;
      color: #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s;
      flex-shrink: 0;
    `;

    searchIcon.addEventListener('mouseover', () => searchIcon.style.background = '#e2e8f0');
    searchIcon.addEventListener('mouseout', () => searchIcon.style.background = '#f1f5f9');
    searchIcon.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof openMarketSearchModal === 'function') {
        openMarketSearchModal(inputEl);
      }
    });

    inputRow.appendChild(searchIcon);
    wrapper.appendChild(inputRow);
  }

  if (hintText) {
    const hint = document.createElement('span');
    hint.className = 'cno-hint';
    hint.textContent = hintText;
    wrapper.appendChild(hint);
  }
  return wrapper;
}

function createBetNameWithExcludeInjuredField(labelText, inputEl, isImportant = false, container = document) {
  const wrapper = document.createElement('div');
  wrapper.className = `cno-field${isImportant ? ' cno-field-important' : ''}`;
  
  const label = document.createElement('label');
  label.textContent = labelText;
  wrapper.appendChild(label);

  if (inputEl) {
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display: flex; align-items: center; gap: 4px; position: relative; width: 100%;';

    inputEl.style.flex = '1';
    inputRow.appendChild(inputEl);

    const clearBtn = createInputClearBtn(inputEl);
    inputRow.appendChild(clearBtn);

    if (typeof userSettings !== 'undefined' && userSettings.enableInjuryBadges) {
      // Two lines:   Injury Filter
      //              [ ] Exclude   [ ] Injured Only
      const injuryBlock = document.createElement('div');
      injuryBlock.className = 'cno-injury-filter-block';
      injuryBlock.style.cssText = `
        display: flex; flex-direction: column; justify-content: center; gap: 2px;
        flex-shrink: 0; margin-left: 4px; user-select: none; line-height: 1.1;
      `;

      const heading = document.createElement('div');
      heading.textContent = 'Injury Filter';
      heading.style.cssText = 'font-size: 0.7rem !important; font-weight: 700 !important; color: #64748b !important; text-align: center; white-space: nowrap;';

      const cbRow = document.createElement('div');
      cbRow.style.cssText = 'display: flex; align-items: center; gap: 8px; white-space: nowrap;';

      const makeCb = (id, text) => {
        const lbl = document.createElement('label');
        lbl.className = id === 'cno-exclude-injured-cb' ? 'cno-exclude-injured-wrapper' : 'cno-injured-only-wrapper';
        lbl.style.cssText = `
          display: inline-flex; align-items: center; gap: 3px; cursor: pointer; margin: 0;
          font-size: 0.76rem !important; font-weight: 600 !important; color: #334155 !important;
        `;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = false;
        cb.style.cssText = 'width: 14px; height: 14px; accent-color: #0284c7; cursor: pointer; flex-shrink: 0; margin: 0;';
        const span = document.createElement('span');
        span.textContent = text;
        lbl.appendChild(cb);
        lbl.appendChild(span);
        return { lbl, cb };
      };

      const exclude = makeCb('cno-exclude-injured-cb', 'Exclude');
      exclude.lbl.appendChild(createRowsFilterHint());
      const injuredOnly = makeCb('cno-injured-only-cb', 'Injured Only');

      // The two are opposites, so checking one unchecks the other
      exclude.cb.addEventListener('change', () => {
        if (exclude.cb.checked) injuredOnly.cb.checked = false;
        processInjuredRowExclusion(); // hide/show rows right away, no Update needed
      });
      injuredOnly.cb.addEventListener('change', () => {
        if (injuredOnly.cb.checked) {
          exclude.cb.checked = false;
          processInjuredRowExclusion();
        }
      });

      cbRow.appendChild(exclude.lbl);
      cbRow.appendChild(injuredOnly.lbl);
      injuryBlock.appendChild(heading);
      injuryBlock.appendChild(cbRow);
      inputRow.appendChild(injuryBlock);
    }

    wrapper.appendChild(inputRow);
  }

  updateExcludeInjuredCheckboxState(container);
  return wrapper;
}

function bindUpdateSubmitListeners(container = document) {
  const updateBtn = container.querySelector('input[type="submit"][id*="ButtonUpdate"]') || 
                    document.querySelector('input[type="submit"][id*="ButtonUpdate"]');
  if (updateBtn && !updateBtn.dataset.hasCnoSubmitListener) {
    updateBtn.addEventListener('click', () => {
      prepareAndExecuteUpdate(container);
    });
    updateBtn.dataset.hasCnoSubmitListener = "true";
  }
}

function createEventAndStartTimeRow(elEvent, elTime, container = document) {
  const row = document.createElement('div');
  row.className = 'cno-event-time-row';

  if (elEvent) {
    const eventField = wrapField('Event/Team Name Contains', elEvent, '', true);
    const label = eventField.querySelector('label');
    if (label) {
      label.insertAdjacentHTML('beforeend', ' <a href="../../site/general/faq.aspx#cno-search-syntax" target="_blank" tabindex="-1" class="cno-link">(Syntax)</a>');
    }

    const eventInputWrap = document.createElement('div');
    eventInputWrap.style.cssText = 'display: flex; align-items: center; gap: 4px; width: 100%;';
    
    if (elEvent.parentNode) {
      elEvent.parentNode.insertBefore(eventInputWrap, elEvent);
    }
    elEvent.style.flex = '1';
    eventInputWrap.appendChild(elEvent);

    const clearBtn = createInputClearBtn(elEvent);
    eventInputWrap.appendChild(clearBtn);

    eventField.appendChild(eventInputWrap);

    const top25Wrap = document.createElement('label');
    top25Wrap.className = 'cno-top25-wrapper';
    top25Wrap.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      cursor: pointer;
      font-size: 0.76rem !important;
      font-weight: 600 !important;
      color: #334155 !important;
      user-select: none;
    `;

    const top25Cb = document.createElement('input');
    top25Cb.type = 'checkbox';
    top25Cb.id = 'cno-top25-cb';
    top25Cb.checked = false;
    top25Cb.style.cssText = 'width: 14px; height: 14px; accent-color: #0284c7; cursor: pointer; margin: 0;';

    const top25Span = document.createElement('span');
    top25Span.textContent = 'Top 25 only';

    top25Wrap.appendChild(top25Cb);
    top25Wrap.appendChild(top25Span);
    eventField.appendChild(top25Wrap);

    row.appendChild(eventField);
  }

  if (elTime) {
    elTime.style.cssText = 'width: 60px !important; display: inline-block;';
    const timeRow = document.createElement('div');
    timeRow.className = 'cno-field';
    timeRow.innerHTML = `<label style="white-space: nowrap;">Start Time Constraint</label>`;
    const timeInner = document.createElement('div');
    timeInner.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-top: 2px;';
    timeInner.appendChild(elTime);
    timeInner.insertAdjacentHTML('beforeend', '<span class="cno-hint" style="font-size:0.75rem !important; line-height: 1.1;">Hours from now</span>');
    timeRow.appendChild(timeInner);
    row.appendChild(timeRow);
  }

  updateTop25CheckboxState(container);
  return row;
}

// True once the browser has finished reading the panel: something after it (or after one of the
// boxes around it) already exists, or the whole page has been read
function isFilterPanelFullyLoaded(container) {
  if (document.readyState !== 'loading') return true;
  // (things the extension itself added don't count: they can sit after a box before the page has)
  const isOurs = (el) => /^cno-/.test(el.id || '') || /(^|\s)cno-/.test(typeof el.className === 'string' ? el.className : '');
  for (let n = container; n && n !== document.body; n = n.parentElement) {
    for (let sib = n.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (!isOurs(sib)) return true;
    }
  }
  return false;
}

function restyleFilterPanel() {
  const currentPath = window.location.pathname.toLowerCase();
  const isMarketsPage = currentPath.includes('markets.aspx');
  const isGamesPage = currentPath.includes('games.aspx');

  let container = getFilterAccordionContainer();
  
  if (isMarketsPage || isGamesPage) {
    const wrapperId = isGamesPage ? 'cno-games-filter-wrapper' : 'cno-markets-filter-wrapper';
    container = document.getElementById(wrapperId);

    if (!container) {
      const targetParent = document.querySelector('layout-body-main-right');
      const updatePanelGrid = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelGridView');
      if (targetParent && updatePanelGrid) {
        container = document.createElement('div');
        container.id = wrapperId;
        
        const serverInfo = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_UpdatePanelServerInfo');
        let currentNode = serverInfo ? serverInfo.nextSibling : targetParent.firstChild;
        const nodesToMove = [];

        while (currentNode && currentNode !== updatePanelGrid) {
          const next = currentNode.nextSibling;
          nodesToMove.push(currentNode);
          currentNode = next;
        }

        targetParent.insertBefore(container, updatePanelGrid);
        nodesToMove.forEach(node => container.appendChild(node));
      }
    }
  }

  if (!container) return;

  // The extension starts while the page is still arriving. If the filter panel is only partly
  // read in, restyling now would build the new layout from half the fields, and the rest (e.g.
  // Minimum Market Sides / Minimum Books) would then show up below it in the old style.
  // Wait until the browser has read past the whole panel.
  if (!isFilterPanelFullyLoaded(container)) return;

  setupFilterToggle();

  if (typeof userSettings !== 'undefined' && !userSettings.enableFilterModernization) {
    if (container.dataset.restyled && container.dataset.originalHTML) {
      container.innerHTML = container.dataset.originalHTML;
      delete container.dataset.restyled;
    }
    container.classList.add('cno-ready');
    return;
  }

  bindSelectEnterSubmits(document);

  if (!container.dataset.originalHTML) {
    container.dataset.originalHTML = container.innerHTML;
  }

  if (userSettings.useClassicFilterView === true) {
    revertToClassicView(container);
    return;
  }

  if (container.dataset.restyled) {
    bindUpdateSubmitListeners(container);
    updateExcludeInjuredCheckboxState(container);
    updateTop25CheckboxState(container);
    restoreSavedBetNameContains(container);
    container.classList.add('cno-ready');
    return;
  }

  const isArbitragePage = currentPath.includes('arbitrage.aspx');
  const isLowHoldPage = currentPath.includes('low-hold.aspx');
  const isFreeBetPage = currentPath.includes('free-bet-converter.aspx');
  const isRiskFreeBetPage = currentPath.includes('risk-free-bet.aspx');
  const isBetAndGetPage = currentPath.includes('bet-and-get.aspx');
  const isWinAndGetPage = currentPath.includes('win-and-get.aspx');

  const getEl = (suffix) => container.querySelector(`[id$="${suffix}"]`) || document.querySelector(`[id$="${suffix}"]`);
  const getLabelFor = (id) => container.querySelector(`label[for="${id}"]`) || document.querySelector(`label[for="${id}"]`);

  const elSportsbook = getEl('DropDownListSportsbookSite_All') || getEl('DropDownListSportsbookSite_NonDFS');
  const elSport = getEl('DropDownListSport');
  const elLeague = getEl('DropDownListLeague');
  const elMinOdds = getEl('TextBoxMinimumOdds');
  const elMaxOdds = getEl('TextBoxMaximumOdds');
  const elMinLiq = getEl('TextBoxMinimumLiquidity');
  const elIsLive = getEl('CheckBoxIsLive');
  const elIsMain = getEl('CheckBoxIsMain');
  const elMaxHours = getEl('TextBoxMaximumDateHours');
  const elEventContains = getEl('TextBoxEventNameContains');
  const elMarketContains = getEl('TextBoxMarketNameContains');
  const elBetContains = getEl('TextBoxBetNameContains');
  const elMinPoints = getEl('TextBoxMinimumBetPoints');
  const elMaxPoints = getEl('TextBoxMaximumBetPoints');
  const elMaxResults = getEl('TextBoxMaximumResultCount');
  const elAllowSameBookHedge = getEl('CheckBoxAllowSameBookHedge');
  const elHedgeBookIsMain = getEl('CheckBoxHedgeBook_IsMain');

  if (!isGamesPage && !elSportsbook) {
    container.classList.add('cno-ready');
    return;
  }

  if (!document.getElementById('cno-grid-styles')) {
    const style = document.createElement('style');
    style.id = 'cno-grid-styles';
    style.textContent = `
      #ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion > div:nth-child(3) .accordionContent:not(.cno-ready),
      #cno-markets-filter-wrapper:not(.cno-ready),
      #cno-games-filter-wrapper:not(.cno-ready) {
        visibility: hidden !important;
      }
      .cno-show-boost { display: block !important; }
      .cno-hide-boost { display: none !important; }
      .cno-filter-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        padding: 4px;
        background-color: #f8fafc;
        color: #1e293b;
      }
      .cno-filter-grid-2col { grid-template-columns: repeat(2, 1fr) !important; }
      .cno-filter-grid-3col { grid-template-columns: repeat(3, 1fr) !important; }
      .cno-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 10px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cno-card-spacer { background: transparent; border: 1px dashed #cbd5e1; box-shadow: none; }
      .cno-card-title {
        font-size: 0.92rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.03em; color: #0284c7; margin: 0; padding-bottom: 3px; border-bottom: 1px solid #f1f5f9;
      }
      .cno-field { display: flex; flex-direction: column; gap: 2px; }
      .cno-field label { font-size: 0.92rem !important; font-weight: 600 !important; color: #334155 !important; }
      .cno-field-important label { color: #0369a1 !important; font-weight: 700 !important; }
      .cno-field-important input[type="text"], .cno-field-important select {
        border: 1.5px solid #0284c7 !important; background-color: #f0f9ff !important; font-weight: 600 !important;
      }
      .cno-row-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .cno-row-inline { display: flex; align-items: center; gap: 14px; margin-top: 2px; flex-wrap: wrap; }
      .cno-checkbox-group {
        display: flex; align-items: center; gap: 6px; font-size: 0.92rem !important;
        font-weight: 600 !important; color: #334155 !important; cursor: pointer; white-space: nowrap; transition: opacity 0.15s ease;
      }
      .cno-checkbox-group input[type="checkbox"] { width: 16px; height: 16px; accent-color: #0284c7; cursor: pointer; margin: 0; }
      .cno-checkbox-group input[type="checkbox"]:disabled { cursor: not-allowed; }
      .cno-card input[type="text"], .cno-card select {
        width: 100% !important; box-sizing: border-box; padding: 4px 8px !important;
        border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.98rem !important;
        font-weight: 500 !important; background-color: #ffffff; color: #0f172a; outline: none; height: 34px !important;
      }
      .cno-card input[type="text"]:focus, .cno-card select:focus {
        border-color: #0284c7 !important; box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
      }
      .cno-hint { font-size: 0.8rem !important; color: #64748b; }
      .cno-link { color: #0284c7; text-decoration: none; font-weight: 600; font-size: 0.88rem !important; }
      .cno-link:hover { text-decoration: underline; }
      .cno-radio-compact table { border-collapse: collapse; }
      .cno-radio-compact td { padding: 2px 0 !important; font-size: 0.92rem !important; font-weight: 600 !important; color: #0369a1; }
      .cno-card-devig-condensed { padding: 8px 10px !important; gap: 5px !important; background-color: #fafafa; }
      .cno-card-devig-condensed .cno-card-title { font-size: 0.88rem; color: #64748b; padding-bottom: 2px; }
      .cno-card-devig-condensed .cno-field label { font-size: 0.88rem !important; }
      .cno-card-devig-condensed input[type="text"], .cno-card-devig-condensed select {
        height: 32px !important; padding: 3px 6px !important; font-size: 0.94rem !important;
      }
      input[id*="TextBoxBoostPercentage"]::placeholder, input[id*="TextBoxBoostOdds"]::placeholder {
        color: #94a3b8 !important; opacity: 1 !important;
      }
      .cno-event-time-row {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 8px;
        align-items: start;
      }
      label[for$="RadioButtonListFreeCreditConversionRate_2"] {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        white-space: nowrap !important;
      }
      .cno-inline-custom-conv {
        display: inline-block !important;
        width: 55px !important;
        height: 24px !important;
        padding: 2px 4px !important;
        font-size: 0.88rem !important;
        margin: 0 !important;
      }
      .cno-markets-header-card, .cno-games-header-card {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px 6px 0 0;
        padding: 6px 12px;
        font-size: 0.92rem;
        font-weight: 700;
        color: #0369a1;
        margin-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  bindMainlinesDependency(elIsMain, elHedgeBookIsMain);

  // --- 1. GAMES PAGE ---
  if (isGamesPage) {
    const headerBar = document.createElement('div');
    headerBar.className = 'cno-games-header-card cno-games-header';
    headerBar.textContent = 'Games Filter Controls';

    const gridGames = document.createElement('div');
    gridGames.className = 'cno-filter-grid cno-filter-grid-3col';

    const cardG1 = document.createElement('div');
    cardG1.className = 'cno-card';
    cardG1.innerHTML = `<div class="cno-card-title">Core Controls</div>`;

    cardG1.appendChild(createSportLeagueOrRow(elSport, elLeague, container));

    if (elIsLive) {
      const liveLabel = getLabelFor(elIsLive.id) || document.createElement('label');
      liveLabel.className = 'cno-checkbox-group';
      liveLabel.style.marginTop = '4px';
      liveLabel.textContent = ' Live (In-Play)';
      liveLabel.prepend(elIsLive);
      cardG1.appendChild(liveLabel);
    }

    const cardG2 = document.createElement('div');
    cardG2.className = 'cno-card';
    cardG2.innerHTML = `<div class="cno-card-title">Event Filters</div>`;

    cardG2.appendChild(createEventAndStartTimeRow(elEventContains, elMaxHours, container));

    const cardG3 = document.createElement('div');
    cardG3.className = 'cno-card cno-card-spacer';

    gridGames.appendChild(cardG1);
    gridGames.appendChild(cardG2);
    gridGames.appendChild(cardG3);

    container.innerHTML = '';
    container.appendChild(headerBar);
    container.appendChild(gridGames);

    setupFilterToggle();
    bindSelectEnterSubmits(container);
    bindUpdateSubmitListeners(container);
    restoreSavedBetNameContains(container);
    container.dataset.restyled = "true";
    container.classList.add('cno-ready');
    return;
  }

  // --- 2. MARKETS PAGE ---
  if (isMarketsPage) {
    const headerBar = document.createElement('div');
    headerBar.className = 'cno-markets-header-card cno-markets-header';
    headerBar.textContent = 'Markets Filter Controls';
    
    const gridMarkets = document.createElement('div');
    gridMarkets.className = 'cno-filter-grid cno-filter-grid-3col';

    const cardMkt1 = document.createElement('div');
    cardMkt1.className = 'cno-card';
    cardMkt1.innerHTML = `<div class="cno-card-title">Core Controls</div>`;

    cardMkt1.appendChild(createSportLeagueOrRow(elSport, elLeague, container));
    cardMkt1.appendChild(wrapField('Sportsbook', elSportsbook, '', true));

    if (elIsLive) {
      const liveLabel = getLabelFor(elIsLive.id) || document.createElement('label');
      liveLabel.className = 'cno-checkbox-group';
      liveLabel.style.marginTop = '4px';
      liveLabel.textContent = ' Live (In-Play)';
      liveLabel.prepend(elIsLive);
      cardMkt1.appendChild(liveLabel);
    }

    const cardMkt2 = document.createElement('div');
    cardMkt2.className = 'cno-card';
    cardMkt2.innerHTML = `<div class="cno-card-title">Event & Market Filters</div>`;

    const rowMkt = document.createElement('div');
    rowMkt.className = 'cno-event-time-row';
    if (elEventContains) {
      const eventFieldMkt = wrapField('Event/Team Name Contains', elEventContains, '', true);
      const label = eventFieldMkt.querySelector('label');
      if (label) {
        label.insertAdjacentHTML('beforeend', ' <a href="../../site/general/faq.aspx#cno-search-syntax" target="_blank" tabindex="-1" class="cno-link">(Syntax)</a>');
      }

      const eventInputWrap = document.createElement('div');
      eventInputWrap.style.cssText = 'display: flex; align-items: center; gap: 4px; width: 100%;';
      if (elEventContains.parentNode) {
        elEventContains.parentNode.insertBefore(eventInputWrap, elEventContains);
      }
      elEventContains.style.flex = '1';
      eventInputWrap.appendChild(elEventContains);

      const clearBtn = createInputClearBtn(elEventContains);
      eventInputWrap.appendChild(clearBtn);

      eventFieldMkt.appendChild(eventInputWrap);
      rowMkt.appendChild(eventFieldMkt);
    }

    if (elMaxHours) {
      elMaxHours.style.cssText = 'width: 60px !important; display: inline-block;';
      const timeRow = document.createElement('div');
      timeRow.className = 'cno-field';
      timeRow.innerHTML = `<label style="white-space: nowrap;">Start Time Constraint</label>`;
      const timeInner = document.createElement('div');
      timeInner.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-top: 2px;';
      timeInner.appendChild(elMaxHours);
      timeInner.insertAdjacentHTML('beforeend', '<span class="cno-hint" style="font-size:0.75rem !important; line-height: 1.1;">Hours from now</span>');
      timeRow.appendChild(timeInner);
      rowMkt.appendChild(timeRow);
    }
    cardMkt2.appendChild(rowMkt);

    cardMkt2.appendChild(wrapMarketWithSearchModal('Market Name Contains', elMarketContains, '', true));

    const cardMkt3 = document.createElement('div');
    cardMkt3.className = 'cno-card cno-card-spacer';

    gridMarkets.appendChild(cardMkt1);
    gridMarkets.appendChild(cardMkt2);
    gridMarkets.appendChild(cardMkt3);

    container.innerHTML = '';
    container.appendChild(headerBar);
    container.appendChild(gridMarkets);

    setupFilterToggle();
    bindSelectEnterSubmits(container);
    bindUpdateSubmitListeners(container);
    restoreSavedBetNameContains(container);
    container.dataset.restyled = "true";
    container.classList.add('cno-ready');
    return;
  }

  // --- 3. ARBITRAGE PAGE ---
  if (isArbitragePage) {
    const gridArb = document.createElement('div');
    gridArb.className = 'cno-filter-grid cno-filter-grid-3col';

    const cardArb1 = document.createElement('div');
    cardArb1.className = 'cno-card';
    cardArb1.innerHTML = `<div class="cno-card-title">Primary Controls</div>`;

    cardArb1.appendChild(wrapField('Arb Sportsbook', elSportsbook, '', true));

    const inlineArbCheckRow = document.createElement('div');
    inlineArbCheckRow.className = 'cno-row-inline';
    
    if (elIsMain) {
      const mainLabel = getLabelFor(elIsMain.id) || document.createElement('label');
      mainLabel.className = 'cno-checkbox-group';
      mainLabel.textContent = ' Mainlines Only';
      mainLabel.prepend(elIsMain);
      inlineArbCheckRow.appendChild(mainLabel);
    }

    if (elIsLive) {
      const liveLabel = getLabelFor(elIsLive.id) || document.createElement('label');
      liveLabel.className = 'cno-checkbox-group';
      liveLabel.textContent = ' Live (In-Play)';
      liveLabel.prepend(elIsLive);
      inlineArbCheckRow.appendChild(liveLabel);
    }

    cardArb1.appendChild(inlineArbCheckRow);
    cardArb1.appendChild(createUndersAndLeaguesRow());

    const cardArb2 = document.createElement('div');
    cardArb2.className = 'cno-card';
    cardArb2.innerHTML = `<div class="cno-card-title">Execution Parameters</div>`;

    const liqResultRow = document.createElement('div');
    liqResultRow.className = 'cno-row-2col';
    if (elMinLiq) liqResultRow.appendChild(wrapField('Minimum Liquidity', elMinLiq));
    if (elMaxResults) liqResultRow.appendChild(wrapField('Result Count', elMaxResults));
    cardArb2.appendChild(liqResultRow);

    const hedgeRowInline = document.createElement('div');
    hedgeRowInline.className = 'cno-row-inline';

    if (elAllowSameBookHedge) {
      const sameBookLabel = getLabelFor(elAllowSameBookHedge.id) || document.createElement('label');
      sameBookLabel.className = 'cno-checkbox-group';
      sameBookLabel.textContent = ' Allow same book hedging';
      sameBookLabel.prepend(elAllowSameBookHedge);
      hedgeRowInline.appendChild(sameBookLabel);
    }

    if (elHedgeBookIsMain) {
      const hedgeMainLabel = getLabelFor(elHedgeBookIsMain.id) || document.createElement('label');
      hedgeMainLabel.className = 'cno-checkbox-group';
      hedgeMainLabel.textContent = ' Mainlines Only for Hedge Book';
      hedgeMainLabel.prepend(elHedgeBookIsMain);
      hedgeRowInline.appendChild(hedgeMainLabel);
    }

    if (hedgeRowInline.children.length > 0) {
      cardArb2.appendChild(hedgeRowInline);
    }

    const cardArb3 = document.createElement('div');
    cardArb3.className = 'cno-card cno-card-spacer';

    gridArb.appendChild(cardArb1);
    gridArb.appendChild(cardArb2);
    gridArb.appendChild(cardArb3);

    container.innerHTML = '';
    container.appendChild(gridArb);
    setupFilterToggle();
    bindSelectEnterSubmits(container);
    bindUpdateSubmitListeners(container);
    restoreSavedBetNameContains(container);
    container.dataset.restyled = "true";
    container.classList.add('cno-ready');
    return;
  }

  // --- 4. LOW HOLD PAGE ---
  if (isLowHoldPage) {
    const gridLowHold = document.createElement('div');
    gridLowHold.className = 'cno-filter-grid';

    const elSortByLowHold = getEl('DropDownListSortBy');

    const cardLH1 = document.createElement('div');
    cardLH1.className = 'cno-card';
    cardLH1.innerHTML = `<div class="cno-card-title">Core Controls</div>`;

    cardLH1.appendChild(wrapField('Low Hold Sportsbook', elSportsbook, '', true));
    cardLH1.appendChild(createSportLeagueOrRow(elSport, elLeague, container));

    const oddsRow = document.createElement('div');
    oddsRow.className = 'cno-row-2col';
    oddsRow.appendChild(wrapField('Min Odds', elMinOdds, '', true));
    oddsRow.appendChild(wrapField('Max Odds', elMaxOdds, '', true));
    cardLH1.appendChild(oddsRow);

    const cardLH2 = document.createElement('div');
    cardLH2.className = 'cno-card';
    cardLH2.innerHTML = `<div class="cno-card-title">Event/Market/Bet Filters</div>`;

    cardLH2.appendChild(createEventAndStartTimeRow(elEventContains, elMaxHours, container));
    cardLH2.appendChild(wrapMarketWithSearchModal('Market Name Contains', elMarketContains, '', true));
    cardLH2.appendChild(createBetNameWithExcludeInjuredField('Bet Name Contains', elBetContains, true, container));

    const cardLH3 = document.createElement('div');
    cardLH3.className = 'cno-card';
    cardLH3.innerHTML = `<div class="cno-card-title">Market Parameters</div>`;

    const pointsRow = document.createElement('div');
    pointsRow.className = 'cno-row-2col';
    pointsRow.appendChild(wrapField('Min Bet Points', elMinPoints));
    pointsRow.appendChild(wrapField('Max Bet Points', elMaxPoints));
    cardLH3.appendChild(pointsRow);

    if (elMinLiq) cardLH3.appendChild(wrapField('Minimum Liquidity', elMinLiq));

    const inlineCheckRow = document.createElement('div');
    inlineCheckRow.className = 'cno-row-inline';
    
    if (elIsMain) {
      const mainLabel = getLabelFor(elIsMain.id) || document.createElement('label');
      mainLabel.className = 'cno-checkbox-group';
      mainLabel.textContent = ' Mainlines Only';
      mainLabel.prepend(elIsMain);
      inlineCheckRow.appendChild(mainLabel);
    }

    if (elIsLive) {
      const liveLabel = getLabelFor(elIsLive.id) || document.createElement('label');
      liveLabel.className = 'cno-checkbox-group';
      liveLabel.textContent = ' Live (In-Play)';
      liveLabel.prepend(elIsLive);
      inlineCheckRow.appendChild(liveLabel);
    }

    cardLH3.appendChild(inlineCheckRow);
    cardLH3.appendChild(createUndersAndLeaguesRow());

    const cardLH4 = document.createElement('div');
    cardLH4.className = 'cno-card';
    cardLH4.innerHTML = `<div class="cno-card-title">Execution & Hedging</div>`;

    const execRow = document.createElement('div');
    execRow.className = 'cno-row-2col';
    if (elMaxResults) execRow.appendChild(wrapField('Result Count', elMaxResults));
    if (elSortByLowHold) execRow.appendChild(wrapField('Sort By', elSortByLowHold));
    cardLH4.appendChild(execRow);

    if (elAllowSameBookHedge) {
      const sameBookLabel = getLabelFor(elAllowSameBookHedge.id) || document.createElement('label');
      sameBookLabel.className = 'cno-checkbox-group';
      sameBookLabel.textContent = ' Allow same book hedging';
      sameBookLabel.prepend(elAllowSameBookHedge);
      cardLH4.appendChild(sameBookLabel);
    }

    if (elHedgeBookIsMain) {
      const hedgeMainLabel = getLabelFor(elHedgeBookIsMain.id) || document.createElement('label');
      hedgeMainLabel.className = 'cno-checkbox-group';
      hedgeMainLabel.textContent = ' Mainlines Only for Hedge Book';
      hedgeMainLabel.prepend(elHedgeBookIsMain);
      cardLH4.appendChild(hedgeMainLabel);
    }

    const hedgePicker = createLowHoldHedgeBookPicker(elSportsbook);
    if (hedgePicker) cardLH4.appendChild(hedgePicker);

    gridLowHold.appendChild(cardLH1);
    gridLowHold.appendChild(cardLH2);
    gridLowHold.appendChild(cardLH3);
    gridLowHold.appendChild(cardLH4);

    container.innerHTML = '';
    container.appendChild(gridLowHold);
    setupFilterToggle();
    bindSelectEnterSubmits(container);
    bindUpdateSubmitListeners(container);
    restoreSavedBetNameContains(container);
    container.dataset.restyled = "true";
    container.classList.add('cno-ready');
    return;
  }

  // --- 5. FREE BET CONVERTER ---
  if (isFreeBetPage) {
    const gridFB = document.createElement('div');
    gridFB.className = 'cno-filter-grid';

    const elDevigMethod = getEl('DropDownListDevigMethod');
    const elProfitStrategy = getEl('DropDownListProfitStrategy');
    const elSortByFB = getEl('DropDownListSortBy');

    const elMinSides = getEl('TextBoxMinimumSubMarketSideCount');
    const elMaxSides = getEl('TextBoxMaximumSubMarketSideCount');
    const elReqComplete = getEl('CheckBoxRequireACompleteSportsbook');
    const elMinBooks = getEl('TextBoxMinimumOddsProviderCount');
    const spanReqComplete = document.getElementById('spanRequireACompleteSportsbook');

    const panelHedge = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_Panel_ProfitStrategy_Hedge');
    const panelEV = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_Panel_ProfitStrategy_EV');

    if (panelHedge) {
      removeAllTextNodes(panelHedge);
      panelHedge.style.display = 'contents';
    }

    if (panelEV) {
      panelEV.innerHTML = '';
      panelEV.style.display = 'contents';

      const sidesRow = document.createElement('div');
      sidesRow.className = 'cno-row-2col';
      if (elMinSides) sidesRow.appendChild(wrapField('Min Market Sides', elMinSides));
      if (elMaxSides) sidesRow.appendChild(wrapField('Max Market Sides', elMaxSides));
      panelEV.appendChild(sidesRow);

      const booksRow = document.createElement('div');
      booksRow.className = 'cno-row-2col';
      if (elMinBooks) booksRow.appendChild(wrapField('Min Books', elMinBooks));
      panelEV.appendChild(booksRow);

      if (spanReqComplete && elReqComplete) {
        let completeLabel = getLabelFor(elReqComplete.id);
        if (!completeLabel) {
          completeLabel = document.createElement('label');
          completeLabel.htmlFor = elReqComplete.id;
        }
        completeLabel.className = 'cno-checkbox-group';
        completeLabel.style.fontSize = '0.88rem !important';
        completeLabel.style.marginTop = '2px';
        completeLabel.textContent = ' Require a Complete Sportsbook';
        completeLabel.prepend(elReqComplete);

        spanReqComplete.innerHTML = '';
        spanReqComplete.appendChild(completeLabel);
        panelEV.appendChild(spanReqComplete);
      }
    }

    const cardFB1 = document.createElement('div');
    cardFB1.className = 'cno-card';
    cardFB1.innerHTML = `<div class="cno-card-title">Core Controls</div>`;

    cardFB1.appendChild(wrapField('FreeBet Sportsbook', elSportsbook, '', true));
    cardFB1.appendChild(createSportLeagueOrRow(elSport, elLeague, container));

    const oddsRow = document.createElement('div');
    oddsRow.className = 'cno-row-2col';
    oddsRow.appendChild(wrapField('Min Odds', elMinOdds, '', true));
    oddsRow.appendChild(wrapField('Max Odds', elMaxOdds, '', true));
    cardFB1.appendChild(oddsRow);

    const stratSortRow = document.createElement('div');
    stratSortRow.className = 'cno-row-2col';

    let sortByWrapper = null;
    if (elProfitStrategy) stratSortRow.appendChild(wrapField('Profit Strategy', elProfitStrategy, '', true));
    if (elSortByFB) {
      sortByWrapper = wrapField('Sort By', elSortByFB, '', true);
      stratSortRow.appendChild(sortByWrapper);
    }
    cardFB1.appendChild(stratSortRow);

    const cardFB2 = document.createElement('div');
    cardFB2.className = 'cno-card';
    cardFB2.innerHTML = `<div class="cno-card-title">Event/Market/Bet Filters</div>`;

    cardFB2.appendChild(createEventAndStartTimeRow(elEventContains, elMaxHours, container));
    cardFB2.appendChild(wrapMarketWithSearchModal('Market Name Contains', elMarketContains, '', true));
    cardFB2.appendChild(createBetNameWithExcludeInjuredField('Bet Name Contains', elBetContains, true, container));

    const cardFB3 = document.createElement('div');
    cardFB3.className = 'cno-card';
    cardFB3.innerHTML = `<div class="cno-card-title">Market Parameters</div>`;

    const pointsRow = document.createElement('div');
    pointsRow.className = 'cno-row-2col';
    pointsRow.appendChild(wrapField('Min Bet Points', elMinPoints));
    pointsRow.appendChild(wrapField('Max Bet Points', elMaxPoints));
    cardFB3.appendChild(pointsRow);

    if (elMinLiq) cardFB3.appendChild(wrapField('Minimum Liquidity', elMinLiq));

    const inlineCheckRow = document.createElement('div');
    inlineCheckRow.className = 'cno-row-inline';
    
    if (elIsMain) {
      const mainLabel = getLabelFor(elIsMain.id) || document.createElement('label');
      mainLabel.className = 'cno-checkbox-group';
      mainLabel.textContent = ' Mainlines Only';
      mainLabel.prepend(elIsMain);
      inlineCheckRow.appendChild(mainLabel);
    }

    if (elIsLive) {
      const liveLabel = getLabelFor(elIsLive.id) || document.createElement('label');
      liveLabel.className = 'cno-checkbox-group';
      liveLabel.textContent = ' Live (In-Play)';
      liveLabel.prepend(elIsLive);
      inlineCheckRow.appendChild(liveLabel);
    }

    cardFB3.appendChild(inlineCheckRow);
    cardFB3.appendChild(createUndersAndLeaguesRow());

    const cardFB4 = document.createElement('div');
    cardFB4.className = 'cno-card cno-card-devig-condensed';
    cardFB4.innerHTML = `<div class="cno-card-title">Devig & Execution</div>`;

    if (elDevigMethod) {
      const devigField = wrapField('Devig Method', elDevigMethod);
      devigField.querySelector('label').insertAdjacentHTML('beforeend', ' <a href="../../site/general/faq.aspx#cno-devig-methods" target="_blank" tabindex="-1" class="cno-link">(Help)</a>');
      cardFB4.appendChild(devigField);
    }

    if (elMaxResults) {
      cardFB4.appendChild(wrapField('Result Count', elMaxResults));
    }

    if (panelHedge) cardFB4.appendChild(panelHedge);
    if (panelEV) cardFB4.appendChild(panelEV);

    let sameBookLabel = null;
    let hedgeMainLabel = null;

    if (elAllowSameBookHedge) {
      sameBookLabel = getLabelFor(elAllowSameBookHedge.id) || document.createElement('label');
      sameBookLabel.className = 'cno-checkbox-group';
      sameBookLabel.style.fontSize = '0.88rem !important';
      sameBookLabel.textContent = ' Allow same book hedging';
      sameBookLabel.prepend(elAllowSameBookHedge);
      cardFB4.appendChild(sameBookLabel);
    }

    if (elHedgeBookIsMain) {
      hedgeMainLabel = getLabelFor(elHedgeBookIsMain.id) || document.querySelector('label[for*="CheckBoxHedgeBook_IsMain"]');
      if (hedgeMainLabel) {
        hedgeMainLabel.className = 'cno-checkbox-group';
        hedgeMainLabel.style.fontSize = '0.88rem !important';
        hedgeMainLabel.textContent = ' Mainlines Only for Hedge Book';
        hedgeMainLabel.prepend(elHedgeBookIsMain);
        cardFB4.appendChild(hedgeMainLabel);
      }
    }

    const hedgePickerFB = createLowHoldHedgeBookPicker(elSportsbook);
    if (hedgePickerFB) cardFB4.appendChild(hedgePickerFB);

    updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookLabel, hedgeMainLabel, sortByWrapper, hedgePickerFB);

    gridFB.appendChild(cardFB1);
    gridFB.appendChild(cardFB2);
    gridFB.appendChild(cardFB3);
    gridFB.appendChild(cardFB4);

    container.innerHTML = '';
    container.appendChild(gridFB);
    setupFilterToggle();
    bindSelectEnterSubmits(container);
    bindUpdateSubmitListeners(container);
    restoreSavedBetNameContains(container);
    container.dataset.restyled = "true";
    container.classList.add('cno-ready');
    return;
  }

  // --- 6. RISK FREE BET / BET & GET / WIN & GET PAGES ---
  if (isRiskFreeBetPage || isBetAndGetPage || isWinAndGetPage) {
    const gridRFB = document.createElement('div');
    gridRFB.className = 'cno-filter-grid';

    const elWager = getEl('TextBoxWager');
    const elReward = getEl('TextBoxReward');
    const radioListConversion = getEl('RadioButtonListFreeCreditConversionRate');
    const elCustomConversion = getEl('TextBoxFreeCreditConversionRate');
    const spanWager = document.getElementById('spanWager');

    const elDevigMethod = getEl('DropDownListDevigMethod');
    const elProfitStrategy = getEl('DropDownListProfitStrategy');
    const elSortByRFB = getEl('DropDownListSortBy');

    const elMinSides = getEl('TextBoxMinimumSubMarketSideCount');
    const elMaxSides = getEl('TextBoxMaximumSubMarketSideCount');
    const elReqComplete = getEl('CheckBoxRequireACompleteSportsbook');
    const elMinBooks = getEl('TextBoxMinimumOddsProviderCount');
    const spanReqComplete = document.getElementById('spanRequireACompleteSportsbook');

    const panelHedge = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_Panel_ProfitStrategy_Hedge');
    const panelEV = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_Panel_ProfitStrategy_EV');

    if (radioListConversion) {
      const checkedOption = radioListConversion.querySelector('input[type="radio"]:checked');
      if (!checkedOption) {
        const freeBetOption = radioListConversion.querySelector('input[id$="_0"]');
        if (freeBetOption) freeBetOption.checked = true;
      }
    }

    if (elReward && (!elReward.value || elReward.value.trim() === '')) {
      elReward.value = '100%';
    }

    const cardRFB1 = document.createElement('div');
    cardRFB1.className = 'cno-card';
    cardRFB1.innerHTML = `<div class="cno-card-title">Reward & Core Controls</div>`;

    const rewardField = wrapField('Reward (% of wager or $)', elReward, '', true);
    
    let wagerField = null;
    if (elWager) {
      wagerField = wrapField('Wager Amount', elWager, '', false);
      
      const updateWagerVisibility = () => {
        const rewardText = elReward ? elReward.value : '';
        if (rewardText.includes('$')) {
          wagerField.style.display = 'flex';
          if (spanWager) spanWager.style.display = 'inline';
        } else {
          wagerField.style.display = 'none';
          if (spanWager) spanWager.style.display = 'none';
        }
      };

      if (elReward && !elReward.dataset.hasWagerVisibilityListener) {
        elReward.addEventListener('input', updateWagerVisibility);
        elReward.dataset.hasWagerVisibilityListener = "true";
      }
      updateWagerVisibility();
    }

    const rewardWagerRow = document.createElement('div');
    rewardWagerRow.className = 'cno-row-2col';
    rewardWagerRow.appendChild(rewardField);
    if (wagerField) rewardWagerRow.appendChild(wagerField);
    cardRFB1.appendChild(rewardWagerRow);

    if (radioListConversion) {
      const customRadio = radioListConversion.querySelector('input[id$="_2"]');

      if (elCustomConversion) {
        elCustomConversion.classList.add('cno-inline-custom-conv');
        elCustomConversion.placeholder = '70%';

        if (customRadio) {
          const customLabel = radioListConversion.querySelector(`label[for="${customRadio.id}"]`) || customRadio.closest('label') || customRadio.parentElement;
          
          if (customLabel && !customLabel.contains(elCustomConversion)) {
            customLabel.appendChild(elCustomConversion);
          }
        }

        const updateCustomConvVisibility = () => {
          if (customRadio && customRadio.checked) {
            elCustomConversion.style.setProperty('display', 'inline-block', 'important');
          } else {
            elCustomConversion.style.setProperty('display', 'none', 'important');
          }
        };

        const allRadios = radioListConversion.querySelectorAll('input[type="radio"]');
        allRadios.forEach(radio => {
          if (!radio.dataset.hasCustomConvListener) {
            radio.addEventListener('change', updateCustomConvVisibility);
            radio.dataset.hasCustomConvListener = "true";
          }
        });

        updateCustomConvVisibility();
      }

      const radioWrapper = wrapField('Free Credit Conversion Rate', radioListConversion, '', true);
      radioWrapper.classList.add('cno-radio-compact');
      cardRFB1.appendChild(radioWrapper);
    }

    let sportsbookLabelText = 'Risk-Free Sportsbook';
    if (isBetAndGetPage) sportsbookLabelText = 'Bet&Get Sportsbook';
    if (isWinAndGetPage) sportsbookLabelText = 'Win&Get Sportsbook';

    cardRFB1.appendChild(wrapField(sportsbookLabelText, elSportsbook, '', true));
    cardRFB1.appendChild(createSportLeagueOrRow(elSport, elLeague, container));

    const oddsRow = document.createElement('div');
    oddsRow.className = 'cno-row-2col';
    oddsRow.appendChild(wrapField('Min Odds', elMinOdds, '', true));
    oddsRow.appendChild(wrapField('Max Odds', elMaxOdds, '', true));
    cardRFB1.appendChild(oddsRow);

    const cardRFB2 = document.createElement('div');
    cardRFB2.className = 'cno-card';
    cardRFB2.innerHTML = `<div class="cno-card-title">Event/Market/Bet Filters</div>`;

    cardRFB2.appendChild(createEventAndStartTimeRow(elEventContains, elMaxHours, container));
    cardRFB2.appendChild(wrapMarketWithSearchModal('Market Name Contains', elMarketContains, '', true));
    cardRFB2.appendChild(createBetNameWithExcludeInjuredField('Bet Name Contains', elBetContains, true, container));

    const cardRFB3 = document.createElement('div');
    cardRFB3.className = 'cno-card';
    cardRFB3.innerHTML = `<div class="cno-card-title">Market Parameters</div>`;

    const pointsRow = document.createElement('div');
    pointsRow.className = 'cno-row-2col';
    pointsRow.appendChild(wrapField('Min Bet Points', elMinPoints));
    pointsRow.appendChild(wrapField('Max Bet Points', elMaxPoints));
    cardRFB3.appendChild(pointsRow);

    if (elMinLiq) cardRFB3.appendChild(wrapField('Minimum Liquidity', elMinLiq));

    const inlineCheckRow = document.createElement('div');
    inlineCheckRow.className = 'cno-row-inline';
    
    if (elIsMain) {
      const mainLabel = getLabelFor(elIsMain.id) || document.createElement('label');
      mainLabel.className = 'cno-checkbox-group';
      mainLabel.textContent = ' Mainlines Only';
      mainLabel.prepend(elIsMain);
      inlineCheckRow.appendChild(mainLabel);
    }

    if (elIsLive) {
      const liveLabel = getLabelFor(elIsLive.id) || document.createElement('label');
      liveLabel.className = 'cno-checkbox-group';
      liveLabel.textContent = ' Live (In-Play)';
      liveLabel.prepend(elIsLive);
      inlineCheckRow.appendChild(liveLabel);
    }

    cardRFB3.appendChild(inlineCheckRow);
    cardRFB3.appendChild(createUndersAndLeaguesRow());

    const cardRFB4 = document.createElement('div');
    cardRFB4.className = 'cno-card cno-card-devig-condensed';
    cardRFB4.innerHTML = `<div class="cno-card-title">Devig & Execution</div>`;

    if (elDevigMethod) {
      const devigField = wrapField('Devig Method', elDevigMethod);
      devigField.querySelector('label').insertAdjacentHTML('beforeend', ' <a href="../../site/general/faq.aspx#cno-devig-methods" target="_blank" tabindex="-1" class="cno-link">(Help)</a>');
      cardRFB4.appendChild(devigField);
    }

    const stratSortRow = document.createElement('div');
    stratSortRow.className = 'cno-row-2col';
    if (elProfitStrategy) stratSortRow.appendChild(wrapField('Profit Strategy', elProfitStrategy, '', true));
    if (elSortByRFB) stratSortRow.appendChild(wrapField('Sort By', elSortByRFB, '', true));
    cardRFB4.appendChild(stratSortRow);

    if (panelHedge) cardRFB4.appendChild(panelHedge);
    if (panelEV) cardRFB4.appendChild(panelEV);

    let sameBookLabel = null;
    let hedgeMainLabel = null;

    if (elAllowSameBookHedge) {
      sameBookLabel = getLabelFor(elAllowSameBookHedge.id) || document.createElement('label');
      sameBookLabel.className = 'cno-checkbox-group';
      sameBookLabel.style.fontSize = '0.88rem !important';
      sameBookLabel.textContent = ' Allow same book hedging';
      sameBookLabel.prepend(elAllowSameBookHedge);
      cardRFB4.appendChild(sameBookLabel);
    }

    if (elHedgeBookIsMain) {
      hedgeMainLabel = getLabelFor(elHedgeBookIsMain.id) || document.querySelector('label[for*="CheckBoxHedgeBook_IsMain"]');
      if (hedgeMainLabel) {
        hedgeMainLabel.className = 'cno-checkbox-group';
        hedgeMainLabel.style.fontSize = '0.88rem !important';
        hedgeMainLabel.textContent = ' Mainlines Only for Hedge Book';
        hedgeMainLabel.prepend(elHedgeBookIsMain);
        cardRFB4.appendChild(hedgeMainLabel);
      }
    }

    const hedgePickerRFB = createLowHoldHedgeBookPicker(elSportsbook);
    if (hedgePickerRFB) cardRFB4.appendChild(hedgePickerRFB);

    updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookLabel, hedgeMainLabel, null, hedgePickerRFB);

    if (elMaxResults) cardRFB4.appendChild(wrapField('Result Count', elMaxResults));

    gridRFB.appendChild(cardRFB1);
    gridRFB.appendChild(cardRFB2);
    gridRFB.appendChild(cardRFB3);
    gridRFB.appendChild(cardRFB4);

    container.innerHTML = '';
    container.appendChild(gridRFB);
    setupFilterToggle();
    bindSelectEnterSubmits(container);
    bindUpdateSubmitListeners(container);
    restoreSavedBetNameContains(container);
    container.dataset.restyled = "true";
    container.classList.add('cno-ready');
    return;
  }

  // --- 7. POSITIVE EV & ODDS BOOST PAGES (DEFAULT) ---
  const grid = document.createElement('div');
  grid.className = 'cno-filter-grid';

  const elMinEV = getEl('TextBoxMinimumEVPercentage');
  const elDevigMethod = getEl('DropDownListDevigMethod');
  const elMinSides = getEl('TextBoxMinimumSubMarketSideCount');
  const elMaxSides = getEl('TextBoxMaximumSubMarketSideCount');
  const elReqComplete = getEl('CheckBoxRequireACompleteSportsbook');
  const elMinBooks = getEl('TextBoxMinimumOddsProviderCount');
  const spanReqComplete = document.getElementById('spanRequireACompleteSportsbook');

  const radioTableBoost = getEl('RadioButtonListOddsBoostType');
  const spanBoostPct = document.getElementById('spanBoostPercentage');
  const spanBoostOdds = document.getElementById('spanBoostOdds');

  const elProfitStrategy = getEl('DropDownListProfitStrategy');
  const elSortByHedge = getEl('DropDownListSortBy');

  const card1 = document.createElement('div');
  card1.className = 'cno-card';
  card1.innerHTML = `<div class="cno-card-title">Core Controls</div>`;

  if (radioTableBoost) {
    const boostTopRow = document.createElement('div');
    boostTopRow.className = 'cno-row-2col';

    const radioWrapper = wrapField('Boost Type', radioTableBoost, '', true);
    radioWrapper.classList.add('cno-radio-compact');
    boostTopRow.appendChild(radioWrapper);

    const boostAmountContainer = document.createElement('div');
    boostAmountContainer.className = 'cno-field cno-field-important';

    const boostAmtLabel = document.createElement('label');
    boostAmtLabel.textContent = 'Boost Amount';
    boostAmtLabel.appendChild(createBoostDefaultLinks());
    boostAmountContainer.appendChild(boostAmtLabel);

    const boostInputsWrap = document.createElement('div');
    boostInputsWrap.style.cssText = 'display: flex; align-items: center; margin-top: 2px;';

    removeAllTextNodes(spanBoostPct);
    removeAllTextNodes(spanBoostOdds);

    if (spanBoostPct) {
      spanBoostPct.style.width = '100%';
      boostInputsWrap.appendChild(spanBoostPct);
    }
    if (spanBoostOdds) {
      spanBoostOdds.style.width = '100%';
      boostInputsWrap.appendChild(spanBoostOdds);
    }

    boostAmountContainer.appendChild(boostInputsWrap);
    boostTopRow.appendChild(boostAmountContainer);

    card1.appendChild(boostTopRow);

    const checkedRadio = radioTableBoost.querySelector('input[type="radio"]:checked');
    if (!checkedRadio) {
      const profitRadio = radioTableBoost.querySelector('input[value="profit"]');
      if (profitRadio) profitRadio.checked = true;
    }

    if (!radioTableBoost.dataset.hasBoostSync) {
      radioTableBoost.addEventListener('change', () => syncBoostUIState(container));
      radioTableBoost.dataset.hasBoostSync = "true";
    }

    syncBoostUIState(container);
  }

  card1.appendChild(wrapField('Sportsbook', elSportsbook, '', true));
  card1.appendChild(createSportLeagueOrRow(elSport, elLeague, container));

  const oddsRow = document.createElement('div');
  oddsRow.className = 'cno-row-2col';
  oddsRow.appendChild(wrapField('Min Odds', elMinOdds, '', true));
  oddsRow.appendChild(wrapField('Max Odds', elMaxOdds, '', true));
  card1.appendChild(oddsRow);

  const card2 = document.createElement('div');
  card2.className = 'cno-card';
  card2.innerHTML = `<div class="cno-card-title">Event/Market/Bet Filters</div>`;

  card2.appendChild(createEventAndStartTimeRow(elEventContains, elMaxHours, container));
  card2.appendChild(wrapMarketWithSearchModal('Market Name Contains', elMarketContains, '', true));
  card2.appendChild(createBetNameWithExcludeInjuredField('Bet Name Contains', elBetContains, true, container));

  const card3 = document.createElement('div');
  card3.className = 'cno-card';
  card3.innerHTML = `<div class="cno-card-title">Market Parameters</div>`;

  const pointsRow = document.createElement('div');
  pointsRow.className = 'cno-row-2col';
  pointsRow.appendChild(wrapField('Min Bet Points', elMinPoints));
  pointsRow.appendChild(wrapField('Max Bet Points', elMaxPoints));
  card3.appendChild(pointsRow);

  const evLiqRow = document.createElement('div');
  evLiqRow.className = 'cno-row-2col';
  if (elMinEV) evLiqRow.appendChild(wrapField('Minimum +EV %', elMinEV));
  evLiqRow.appendChild(wrapField('Minimum Liquidity', elMinLiq));
  card3.appendChild(evLiqRow);

  const inlineCheckRow = document.createElement('div');
  inlineCheckRow.className = 'cno-row-inline';
  
  if (elIsMain) {
    const mainLabel = getLabelFor(elIsMain.id) || document.createElement('label');
    mainLabel.className = 'cno-checkbox-group';
    mainLabel.textContent = ' Mainlines Only';
    mainLabel.prepend(elIsMain);
    inlineCheckRow.appendChild(mainLabel);
  }

  if (elIsLive) {
    const liveLabel = getLabelFor(elIsLive.id) || document.createElement('label');
    liveLabel.className = 'cno-checkbox-group';
    liveLabel.textContent = ' Live (In-Play)';
    liveLabel.prepend(elIsLive);
    inlineCheckRow.appendChild(liveLabel);
  }

  card3.appendChild(inlineCheckRow);
  card3.appendChild(createUndersAndLeaguesRow());

  const card4 = document.createElement('div');
  card4.className = 'cno-card cno-card-devig-condensed';
  card4.innerHTML = `<div class="cno-card-title">Devig & Output</div>`;

  const devigField = wrapField('Devig Method', elDevigMethod);
  devigField.querySelector('label').insertAdjacentHTML('beforeend', ' <a href="../../site/general/faq.aspx#cno-devig-methods" target="_blank" tabindex="-1" class="cno-link">(Help)</a>');
  card4.appendChild(devigField);

  if (elProfitStrategy) {
    const strategyRow = document.createElement('div');
    strategyRow.className = 'cno-row-2col';
    strategyRow.appendChild(wrapField('Profit Strategy', elProfitStrategy));

    if (elSortByHedge) {
      strategyRow.appendChild(wrapField('Sort By', elSortByHedge));
    }
    card4.appendChild(strategyRow);
  }

  let sameBookLabel = null;
  if (elAllowSameBookHedge) {
    sameBookLabel = getLabelFor(elAllowSameBookHedge.id) || document.createElement('label');
    sameBookLabel.className = 'cno-checkbox-group';
    sameBookLabel.style.fontSize = '0.88rem !important';
    sameBookLabel.style.margin = '2px 0';
    sameBookLabel.textContent = ' Allow same book hedging';
    sameBookLabel.prepend(elAllowSameBookHedge);
    card4.appendChild(sameBookLabel);
  }

  let hedgePickerDefault = null;
  if (elProfitStrategy && currentPath.includes('odds-boost.aspx')) {
    hedgePickerDefault = createLowHoldHedgeBookPicker(elSportsbook);
    if (hedgePickerDefault) card4.appendChild(hedgePickerDefault);
  }

  updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookLabel, null, null, hedgePickerDefault);

  const devigRow1 = document.createElement('div');
  devigRow1.className = 'cno-row-2col';
  devigRow1.appendChild(wrapField('Min Market Sides', elMinSides));
  devigRow1.appendChild(wrapField('Max Market Sides', elMaxSides));
  card4.appendChild(devigRow1);

  const devigRow2 = document.createElement('div');
  devigRow2.className = 'cno-row-2col';
  devigRow2.appendChild(wrapField('Min Books', elMinBooks));
  devigRow2.appendChild(wrapField('Result Count', elMaxResults));
  card4.appendChild(devigRow2);

  if (spanReqComplete && elReqComplete) {
    let completeLabel = getLabelFor(elReqComplete.id);
    if (!completeLabel) {
      completeLabel = document.createElement('label');
      completeLabel.htmlFor = elReqComplete.id;
    }
    completeLabel.className = 'cno-checkbox-group';
    completeLabel.style.fontSize = '0.88rem !important';
    completeLabel.style.marginTop = '2px';
    completeLabel.textContent = ' Require a Complete Sportsbook';
    completeLabel.prepend(elReqComplete);

    spanReqComplete.innerHTML = '';
    spanReqComplete.appendChild(completeLabel);
    card4.appendChild(spanReqComplete);
  }

  grid.appendChild(card1);
  grid.appendChild(card2);
  grid.appendChild(card3);
  grid.appendChild(card4);

  container.innerHTML = '';
  container.appendChild(grid);
  setupFilterToggle();
  bindSelectEnterSubmits(container);
  bindUpdateSubmitListeners(container);
  restoreSavedBetNameContains(container);
  container.dataset.restyled = "true";
  container.classList.add('cno-ready');
}


// ====================================================
// SAVED FILTER SELECTIONS (SAVE / APPLY)
// ====================================================

const SAVED_FILTERS_STORAGE_KEY = 'cno_saved_filters';

const SAVED_FILTER_BTN_CSS = `
  padding: 3px 10px;
  font-size: 0.8rem;
  font-weight: bold;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0369a1;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  display: inline-flex;
  align-items: center;
  gap: 5px;
`;

function getSavedFiltersPageKey() {
  const seg = window.location.pathname.toLowerCase().split('/').filter(Boolean).pop() || 'default';
  return seg.replace(/\.aspx$/, '');
}

function readSavedFilters(callback) {
  chrome.storage.local.get([SAVED_FILTERS_STORAGE_KEY], (data) => {
    callback((data && data[SAVED_FILTERS_STORAGE_KEY]) || {});
  });
}

function writeSavedFilters(all, callback) {
  chrome.storage.local.set({ [SAVED_FILTERS_STORAGE_KEY]: all }, () => {
    if (callback) callback();
  });
}

function showSavedFilterToast(message) {
  const old = document.getElementById('cno-saved-filter-toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.id = 'cno-saved-filter-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 1000001;
    background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 6px;
    font-size: 0.85rem; max-width: 360px; box-shadow: 0 6px 16px rgba(0,0,0,0.25);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

// ----------------------------------------------------
// Collect / apply field values
// ----------------------------------------------------

function collectFilterSelections(container = document) {
  const getEl = (suffix) => container.querySelector(`[id$="${suffix}"]`) || document.querySelector(`[id$="${suffix}"]`);
  const sel = { selects: {}, texts: {}, checks: {}, radios: {}, boost: {} };

  ['DropDownListSportsbookSite_All', 'DropDownListSportsbookSite_NonDFS', 'DropDownListSport', 'DropDownListLeague', 'DropDownListProfitStrategy', 'DropDownListDevigMethod', 'DropDownListSortBy'].forEach(suffix => {
    const el = getEl(suffix);
    if (el && el.selectedIndex >= 0) {
      const opt = el.options[el.selectedIndex];
      sel.selects[suffix] = { value: opt.value, text: opt.text.trim() };
    }
  });

  [
    'TextBoxMinimumOdds', 'TextBoxMaximumOdds', 'TextBoxEventNameContains', 'TextBoxMaximumDateHours',
    'TextBoxMarketNameContains', 'TextBoxBetNameContains', 'TextBoxMinimumBetPoints', 'TextBoxMaximumBetPoints',
    'TextBoxReward', 'TextBoxFreeCreditConversionRate', 'TextBoxMinimumLiquidity',
    'TextBoxMinimumOddsProviderCount', // Minimum Books
    'TextBoxMinimumEVPercentage', 'TextBoxMinimumSubMarketSideCount', 'TextBoxMaximumSubMarketSideCount'
  ].forEach(suffix => {
    const el = getEl(suffix);
    if (el) sel.texts[suffix] = el.value;
  });

  // Save the user's own text, not the injected injured-player / Top 25 syntax
  const excludeCb = document.querySelector('#cno-exclude-injured-cb');
  const injuredOnlyCb = document.querySelector('#cno-injured-only-cb');
  const top25Cb = document.querySelector('#cno-top25-cb');

  if (sel.texts.TextBoxBetNameContains !== undefined && injuredOnlyCb && injuredOnlyCb.checked) {
    const raw = sessionStorage.getItem(BET_CONTAINS_STORAGE_KEY);
    if (raw !== null) sel.texts.TextBoxBetNameContains = raw;
  }
  if (sel.texts.TextBoxEventNameContains !== undefined && top25Cb && top25Cb.checked) {
    const raw = sessionStorage.getItem(AP_TOP25_STORAGE_KEY);
    if (raw !== null) sel.texts.TextBoxEventNameContains = raw;
  }

  const elLive = getEl('CheckBoxIsLive');
  if (elLive) sel.checks.live = elLive.checked;
  const elIsMainSave = getEl('CheckBoxIsMain');
  if (elIsMainSave) sel.checks.main = elIsMainSave.checked;
  const elHedgeMainSave = getEl('CheckBoxHedgeBook_IsMain');
  if (elHedgeMainSave) sel.checks.hedgeMain = elHedgeMainSave.checked;
  const elReqCompleteSave = getEl('CheckBoxRequireACompleteSportsbook');
  if (elReqCompleteSave) sel.checks.requireComplete = elReqCompleteSave.checked;
  if (excludeCb) sel.checks.excludeInjured = excludeCb.checked;
  if (injuredOnlyCb) sel.checks.injuredOnly = injuredOnlyCb.checked;
  const playerUndersCb = document.querySelector('#cno-exclude-player-unders-cb');
  if (playerUndersCb) sel.checks.excludePlayerUnders = playerUndersCb.checked;
  if (document.getElementById('cno-mlb-weather-select')) sel.checks.mlbWeather = cnoMlbWeatherFilter;
  if (document.getElementById('cno-multi-league')) sel.multiLeague = cnoMultiLeagueSelection ? cnoMultiLeagueSelection.slice() : 'all';

  // Hedge Sportsbook Filter: 'all' or the list of selected books
  const hedgeSel = getHedgeBookPickerSelection();
  if (hedgeSel !== undefined) sel.hedgeBooks = hedgeSel ? hedgeSel : 'all';
  if (top25Cb) sel.checks.top25 = top25Cb.checked;

  const readRadio = (tableEl) => {
    if (!tableEl) return null;
    const radios = Array.from(tableEl.querySelectorAll('input[type="radio"]'));
    const idx = radios.findIndex(r => r.checked);
    if (idx === -1) return null;
    return { value: radios[idx].value, index: idx };
  };

  const boostType = readRadio(getEl('RadioButtonListOddsBoostType'));
  if (boostType) sel.radios.boostType = boostType;
  const conversion = readRadio(getEl('RadioButtonListFreeCreditConversionRate'));
  if (conversion) sel.radios.conversion = conversion;

  const spanPct = document.getElementById('spanBoostPercentage');
  const spanOdds = document.getElementById('spanBoostOdds');
  const inputPct = spanPct ? spanPct.querySelector('input[type="text"]') : null;
  const inputOdds = spanOdds ? spanOdds.querySelector('input[type="text"]') : null;
  if (inputPct) sel.boost.pct = inputPct.value;
  if (inputOdds) sel.boost.odds = inputOdds.value;

  return sel;
}

function setSelectFromSaved(el, saved) {
  if (!el || !saved) return true;
  const opts = Array.from(el.options);
  let idx = opts.findIndex(o => o.value === saved.value);
  if (idx === -1) idx = opts.findIndex(o => o.text.trim() === saved.text);
  if (idx === -1) return false;
  el.selectedIndex = idx;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function setRadioFromSaved(tableEl, saved) {
  if (!tableEl || !saved) return true;
  const radios = Array.from(tableEl.querySelectorAll('input[type="radio"]'));
  const r = radios.find(x => x.value === saved.value) || radios[saved.index];
  if (!r) return false;
  r.checked = true;
  r.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// Saved filters made since "only save what differs from the defaults" carry omitsDefaults;
// their missing default fields are filled from the user's CNO defaults before applying.
function applyFilterSelections(container, sel) {
  if (sel && sel.omitsDefaults) {
    getSiteDefaults((defaults) => applyFilterSelectionsNow(container, defaults ? fillDefaultSelections(sel, defaults) : sel));
    return;
  }
  applyFilterSelectionsNow(container, sel);
}

function applyFilterSelectionsNow(container, sel) {
  const getEl = (suffix) => container.querySelector(`[id$="${suffix}"]`) || document.querySelector(`[id$="${suffix}"]`);
  const failures = [];

  // Drop any in-flight injected syntax so the update uses the freshly applied text
  sessionStorage.removeItem(BET_CONTAINS_STORAGE_KEY);
  sessionStorage.removeItem(AP_TOP25_STORAGE_KEY);
  sessionStorage.removeItem('cno_top25_cb_active');

  const selects = sel.selects || {};
  const selectLabels = {
    DropDownListSportsbookSite_All: 'Sportsbook',
    DropDownListSportsbookSite_NonDFS: 'Sportsbook',
    DropDownListSport: 'Sport',
    DropDownListLeague: 'League',
    DropDownListProfitStrategy: 'Profit Strategy',
    DropDownListDevigMethod: 'Devig Method',
    DropDownListSortBy: 'Sort By'
  };
  // Sportsbook first, then Sport, then League (sport/league are mutually exclusive), then Profit Strategy
  // (its change event shows/hides the hedge-only options). Pages without a field just skip it.
  ['DropDownListSportsbookSite_All', 'DropDownListSportsbookSite_NonDFS', 'DropDownListSport', 'DropDownListLeague', 'DropDownListProfitStrategy', 'DropDownListDevigMethod', 'DropDownListSortBy'].forEach(suffix => {
    if (!selects[suffix]) return;
    let el = getEl(suffix);
    if (!el && suffix.indexOf('DropDownListSportsbookSite_') === 0) {
      // The destination page may use the other sportsbook dropdown variant
      const otherSuffix = suffix === 'DropDownListSportsbookSite_All' ? 'DropDownListSportsbookSite_NonDFS' : 'DropDownListSportsbookSite_All';
      if (!selects[otherSuffix]) el = getEl(otherSuffix);
    }
    if (!el) return;
    if (!setSelectFromSaved(el, selects[suffix])) {
      failures.push(`${selectLabels[suffix]} "${selects[suffix].text}"`);
    }
  });

  updateExcludeInjuredCheckboxState(container);
  updateTop25CheckboxState(container);

  Object.keys(sel.texts || {}).forEach(suffix => {
    const el = getEl(suffix);
    if (el) {
      el.value = sel.texts[suffix];
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const checks = sel.checks || {};
  const elLive = getEl('CheckBoxIsLive');
  if (elLive && checks.live !== undefined) elLive.checked = !!checks.live;

  const elReqCompleteApply = getEl('CheckBoxRequireACompleteSportsbook');
  if (elReqCompleteApply && checks.requireComplete !== undefined && elReqCompleteApply.checked !== !!checks.requireComplete) {
    elReqCompleteApply.checked = !!checks.requireComplete;
    elReqCompleteApply.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Mainlines first: the hedge-book box is disabled whenever Mainlines Only is off
  const elIsMainApply = getEl('CheckBoxIsMain');
  if (elIsMainApply && checks.main !== undefined) {
    elIsMainApply.checked = !!checks.main;
    elIsMainApply.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const elHedgeMainApply = getEl('CheckBoxHedgeBook_IsMain');
  if (elHedgeMainApply && checks.hedgeMain !== undefined) {
    if (checks.hedgeMain && elHedgeMainApply.disabled) {
      failures.push('Mainlines Only for Hedge Book (needs Mainlines Only)');
      elHedgeMainApply.checked = false;
    } else {
      elHedgeMainApply.checked = !!checks.hedgeMain;
    }
  }

  const excludeCb = document.querySelector('#cno-exclude-injured-cb');
  // A saved filter that doesn't mention the injury filter turns both boxes off
  if (excludeCb && checks.excludeInjured === undefined && excludeCb.checked) {
    excludeCb.checked = false;
    if (typeof processInjuredRowExclusion === 'function') processInjuredRowExclusion();
  }
  if (excludeCb && checks.excludeInjured !== undefined) {
    if (checks.excludeInjured && excludeCb.disabled) {
      failures.push('Injury Filter: Exclude (league not eligible)');
      excludeCb.checked = false;
    } else {
      excludeCb.checked = !!checks.excludeInjured;
    }
  }

  const playerUndersCbApply = document.querySelector('#cno-exclude-player-unders-cb');
  if (playerUndersCbApply && checks.excludePlayerUnders !== undefined) {
    playerUndersCbApply.checked = !!checks.excludePlayerUnders;
    // Same as clicking it: remember the choice for this page and hide/show rows
    playerUndersCbApply.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // MLB weather: the saved choice, or Include All when the filter doesn't mention it
  if (document.getElementById('cno-mlb-weather-select')) setMlbWeatherFilter(checks.mlbWeather || 'all');

  // Multi-league filter: the saved leagues, or all leagues when the filter doesn't mention it
  if (document.getElementById('cno-multi-league')) {
    setMultiLeagueSelection(Array.isArray(sel.multiLeague) ? sel.multiLeague : null);
  }

  if (sel.hedgeBooks !== undefined && getLowHoldHedgeBookPicker()) {
    syncLowHoldHedgeBookPicker(Array.isArray(sel.hedgeBooks) ? sel.hedgeBooks : null);
  }

  const injuredOnlyCb = document.querySelector('#cno-injured-only-cb');
  if (injuredOnlyCb && checks.injuredOnly === undefined) injuredOnlyCb.checked = false;
  if (injuredOnlyCb && checks.injuredOnly !== undefined) {
    if (checks.injuredOnly && injuredOnlyCb.disabled) {
      failures.push('Injury Filter: Injured Only (league not eligible)');
      injuredOnlyCb.checked = false;
    } else {
      injuredOnlyCb.checked = !!checks.injuredOnly;
      if (injuredOnlyCb.checked && excludeCb) excludeCb.checked = false;
    }
  }

  const top25Cb = document.querySelector('#cno-top25-cb');
  if (top25Cb && checks.top25 !== undefined) {
    const hidden = top25Cb.style.display === 'none' || (top25Cb.parentElement && top25Cb.parentElement.style.display === 'none');
    if (checks.top25 && hidden) {
      failures.push('Top 25 (league not eligible)');
      top25Cb.checked = false;
    } else {
      top25Cb.checked = !!checks.top25;
    }
  }

  const radios = sel.radios || {};
  if (radios.boostType && !setRadioFromSaved(getEl('RadioButtonListOddsBoostType'), radios.boostType)) {
    failures.push('Boost type');
  }
  syncBoostUIState(container);

  const boost = sel.boost || {};
  const spanPct = document.getElementById('spanBoostPercentage');
  const spanOdds = document.getElementById('spanBoostOdds');
  const inputPct = spanPct ? spanPct.querySelector('input[type="text"]') : null;
  const inputOdds = spanOdds ? spanOdds.querySelector('input[type="text"]') : null;
  if (inputPct && boost.pct !== undefined) inputPct.value = boost.pct;
  if (inputOdds && boost.odds !== undefined) inputOdds.value = boost.odds;

  if (radios.conversion && !setRadioFromSaved(getEl('RadioButtonListFreeCreditConversionRate'), radios.conversion)) {
    failures.push('Free credit conversion rate');
  }

  triggerFilterUpdate(container);

  if (failures.length) {
    showSavedFilterToast(`Applied, but couldn't set: ${failures.join(', ')}`);
  }
}

// ----------------------------------------------------
// Modal helpers (styled to match the other CNO modals)
// ----------------------------------------------------

function createSavedFilterModal(titleHtml, width = 460, zIndex = 999999) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(2px);
    z-index: ${zIndex};
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: #ffffff;
    border-radius: 8px;
    width: ${width}px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
    border: 1px solid #e2e8f0;
    overflow: hidden;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 14px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <h3 style="margin:0; font-size:1.05rem; color:#0284c7; font-weight:700; display:flex; align-items:center; gap:7px;">${titleHtml}</h3>
    <button type="button" class="cno-sf-close" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;">✕</button>
  `;

  const body = document.createElement('div');
  body.style.cssText = `
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
    flex: 1;
  `;

  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);

  const close = () => modal.remove();
  header.querySelector('.cno-sf-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  return { modal, content, header, body, close };
}

function makeSavedFilterModalBtn(label, kind = 'secondary') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  const palette = {
    primary: 'background:#0284c7; color:#ffffff; border:1px solid #0284c7;',
    danger: 'background:#dc2626; color:#ffffff; border:1px solid #dc2626;',
    secondary: 'background:#ffffff; color:#334155; border:1px solid #cbd5e1;'
  };
  btn.style.cssText = `${palette[kind]} padding:6px 14px; border-radius:6px; font-size:0.88rem; font-weight:600; cursor:pointer;`;
  return btn;
}

const SAVED_FILTER_INPUT_CSS = `
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
`;

function openSavedFilterConfirm(message, confirmLabel, onConfirm, danger = false, cancelLabel = 'Cancel') {
  const { modal, body, close } = createSavedFilterModal('Please confirm', 420, 1000000);

  const msg = document.createElement('div');
  msg.textContent = message;
  msg.style.cssText = 'font-size:0.92rem; color:#334155; line-height:1.4;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px;';
  const cancelBtn = makeSavedFilterModalBtn(cancelLabel);
  const okBtn = makeSavedFilterModalBtn(confirmLabel, danger ? 'danger' : 'primary');
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(okBtn);

  body.appendChild(msg);
  body.appendChild(btnRow);

  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', () => {
    close();
    onConfirm();
  });

  document.body.appendChild(modal);
  cancelBtn.focus();
}

function openSavedFilterNamePicker(onPick) {
  const { modal, body, close } = createSavedFilterModal(`${cnoIconSvg('search', 17)} Choose Existing Filter`, 440, 1000000);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Type to search saved filters...';
  searchInput.style.cssText = SAVED_FILTER_INPUT_CSS;

  const resultsBox = document.createElement('div');
  resultsBox.style.cssText = `
    flex: 1;
    min-height: 120px;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #ffffff;
  `;

  body.appendChild(searchInput);
  body.appendChild(resultsBox);

  let names = [];

  const pick = (name) => {
    close();
    onPick(name);
  };

  const render = () => {
    const q = searchInput.value.trim().toLowerCase();
    const matches = names.filter(n => n.toLowerCase().includes(q));
    resultsBox.innerHTML = '';

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = names.length === 0 ? 'No saved filter selections for this page yet.' : 'No matching filter selections.';
      empty.style.cssText = 'padding:16px; color:#64748b; font-size:0.88rem; text-align:center;';
      resultsBox.appendChild(empty);
      return;
    }

    matches.forEach(name => {
      const rowBtn = document.createElement('button');
      rowBtn.type = 'button';
      rowBtn.textContent = name;
      rowBtn.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid #f1f5f9; padding:10px 12px; font-size:0.92rem; color:#1e293b; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
      rowBtn.addEventListener('mouseover', () => rowBtn.style.background = '#f0f9ff');
      rowBtn.addEventListener('mouseout', () => rowBtn.style.background = 'none');
      rowBtn.addEventListener('click', () => pick(name));
      resultsBox.appendChild(rowBtn);
    });
  };

  searchInput.addEventListener('input', render);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchInput.value.trim().toLowerCase();
      const first = names.find(n => n.toLowerCase().includes(q));
      if (first) pick(first);
    }
  });

  readSavedFilters((all) => {
    const page = all[getSavedFiltersPageKey()] || {};
    names = Object.keys(page).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    render();
  });

  document.body.appendChild(modal);
  searchInput.focus();
}

function openSaveFilterModal(container) {
  const existing = document.getElementById('cno-save-filter-modal');
  if (existing) existing.remove();

  const { modal, body, close } = createSavedFilterModal(`${cnoIconSvg('save', 17)} Save Filter`, 440);
  modal.id = 'cno-save-filter-modal';

  const label = document.createElement('label');
  label.textContent = 'Filter Selection Name';
  label.style.cssText = 'font-size:0.82rem; font-weight:600; color:#475569;';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 60;
  nameInput.placeholder = 'e.g. NBA props, min odds -150';
  nameInput.style.cssText = SAVED_FILTER_INPUT_CSS;

  const errorMsg = document.createElement('div');
  errorMsg.style.cssText = 'color:#dc2626; font-size:0.8rem; min-height:1em;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px;';
  const cancelBtn = makeSavedFilterModalBtn('Cancel');
  const saveBtn = cnoSetIconLabel(makeSavedFilterModalBtn('', 'primary'), 'save', 'Save');
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);

  const nameRow = document.createElement('div');
  nameRow.style.cssText = 'display:flex; align-items:center; gap:4px;';
  nameInput.style.flex = '1';
  nameInput.style.minWidth = '0';

  const searchIcon = document.createElement('button');
  searchIcon.type = 'button';
  searchIcon.title = 'Search existing filter selections to reuse a name (replaces that filter)';
  searchIcon.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  `;
  searchIcon.style.cssText = `
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    height: 34px;
    width: 34px;
    padding: 0;
    cursor: pointer;
    color: #334155;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `;
  searchIcon.addEventListener('mouseover', () => searchIcon.style.background = '#e2e8f0');
  searchIcon.addEventListener('mouseout', () => searchIcon.style.background = '#f1f5f9');
  searchIcon.addEventListener('click', () => {
    openSavedFilterNamePicker((name) => {
      nameInput.value = name;
      errorMsg.textContent = '';
      nameInput.focus();
    });
  });

  nameRow.appendChild(nameInput);
  nameRow.appendChild(searchIcon);

  body.appendChild(label);
  body.appendChild(nameRow);
  body.appendChild(errorMsg);
  body.appendChild(btnRow);

  const doSave = () => {
    const name = nameInput.value.trim();
    if (!name) {
      errorMsg.textContent = 'Please enter a name.';
      return;
    }

    readSavedFilters((all) => {
      const pageKey = getSavedFiltersPageKey();
      const page = all[pageKey] || {};
      const existingKey = Object.keys(page).find(k => k.toLowerCase() === name.toLowerCase());

      const commit = (keyName) => {
        const prev = page[keyName] || {};
        const selections = collectFilterSelections(container);
        // Fields that match the user's CNO defaults aren't stored (they're filled from the
        // defaults when the filter is applied), so saved filters only carry what's different
        getSiteDefaults((defaults) => {
          if (defaults) stripDefaultSelections(selections, defaults);
          page[keyName] = { savedAt: Date.now(), selections };
          // Overwriting a filter keeps its usage history (for the Apply Filters hover menu)
          if (prev.useCount) page[keyName].useCount = prev.useCount;
          if (prev.lastUsed) page[keyName].lastUsed = prev.lastUsed;
          all[pageKey] = page;
          writeSavedFilters(all, () => {
            close();
            showSavedFilterToast(`Saved "${keyName}"`);
          });
        });
      };

      if (existingKey) {
        openSavedFilterConfirm(`A filter selection named "${existingKey}" already exists. Overwrite it?`, 'Overwrite', () => commit(existingKey));
      } else {
        commit(name);
      }
    });
  };

  cancelBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', doSave);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSave();
    }
  });

  document.body.appendChild(modal);
  nameInput.focus();
}

function openApplyFilterModal(container) {
  const existing = document.getElementById('cno-apply-filter-modal');
  if (existing) existing.remove();

  const { modal, body, close } = createSavedFilterModal(`${cnoIconSvg('apply', 17)} Apply Filters`, 480);
  modal.id = 'cno-apply-filter-modal';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Type to search saved filters...';
  searchInput.style.cssText = SAVED_FILTER_INPUT_CSS;

  const resultsBox = document.createElement('div');
  resultsBox.style.cssText = `
    flex: 1;
    min-height: 120px;
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #ffffff;
  `;

  body.appendChild(searchInput);
  body.appendChild(resultsBox);

  // Link to sharing saved filters (Import & Export page)
  const shareLink = document.createElement('a');
  shareLink.href = '#';
  shareLink.style.cssText = 'align-self:flex-end; display:inline-flex; align-items:center; gap:5px; font-size:0.8rem; font-weight:600; color:#0369a1; text-decoration:none;';
  cnoSetIconLabel(shareLink, 'swap', 'Import / Export filters');
  shareLink.addEventListener('click', (e) => {
    e.preventDefault();
    try { chrome.runtime.sendMessage({ type: 'cno-open-transfer', tab: 'share' }); } catch (err) { /* ignore */ }
  });
  body.appendChild(shareLink);

  const pageKey = getSavedFiltersPageKey();
  let page = {};

  const hint = document.createElement('div');
  hint.textContent = 'Right-click a filter to rename it.';
  hint.style.cssText = 'font-size:0.75rem; color:#94a3b8; margin-top:-6px;';
  body.insertBefore(hint, resultsBox);

  const renameByName = (oldName) => {
    openSavedFilterRenameModal(oldName, (newName) => {
      readSavedFilters((all) => {
        const pg = all[pageKey] || {};
        const entry = pg[oldName];
        if (!entry) return;
        const conflict = Object.keys(pg).find(k => k !== oldName && k.toLowerCase() === newName.toLowerCase());

        const commit = () => {
          if (conflict) delete pg[conflict];
          delete pg[oldName];
          pg[newName] = entry;
          all[pageKey] = pg;
          writeSavedFilters(all, () => {
            page = pg;
            render();
            searchInput.focus();
          });
        };

        if (conflict) {
          openSavedFilterConfirm(`A filter selection named "${conflict}" already exists. Overwrite it?`, 'Overwrite', commit);
        } else {
          commit();
        }
      });
    });
  };

  const sortedNames = () => Object.keys(page).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const applyByName = (name) => {
    const entry = page[name];
    if (!entry) return;
    close();
    applyFilterSelections(container, entry.selections || {});
    recordSavedFilterUse(pageKey, name);
  };

  const deleteByName = (name) => {
    openSavedFilterConfirm(`Delete "${name}"? This can't be undone.`, 'Delete', () => {
      readSavedFilters((all) => {
        if (all[pageKey]) {
          delete all[pageKey][name];
          if (Object.keys(all[pageKey]).length === 0) delete all[pageKey];
        }
        writeSavedFilters(all, () => {
          delete page[name];
          render();
          searchInput.focus();
        });
      });
    }, true);
  };

  const render = () => {
    const q = searchInput.value.trim().toLowerCase();
    const allNames = sortedNames();
    const names = allNames.filter(n => n.toLowerCase().includes(q));
    resultsBox.innerHTML = '';

    if (names.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = allNames.length === 0 ? 'No saved filter selections for this page yet.' : 'No matching filter selections.';
      empty.style.cssText = 'padding:16px; color:#64748b; font-size:0.88rem; text-align:center;';
      resultsBox.appendChild(empty);
      return;
    }

    names.forEach(name => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; border-bottom:1px solid #f1f5f9;';

      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.textContent = name;
      nameBtn.style.cssText = 'flex:1; text-align:left; background:none; border:none; padding:10px 12px; font-size:0.92rem; color:#1e293b; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
      nameBtn.addEventListener('mouseover', () => row.style.background = '#f0f9ff');
      nameBtn.addEventListener('mouseout', () => row.style.background = '');
      nameBtn.addEventListener('click', () => applyByName(name));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.title = 'Delete this saved filter';
      delBtn.innerHTML = cnoIconSvg('trash', 16);
      delBtn.style.cssText = 'background:none; border:none; padding:8px 12px; font-size:1rem; color:#b91c1c; cursor:pointer; flex-shrink:0;';
      delBtn.addEventListener('mouseover', () => delBtn.style.background = '#fee2e2');
      delBtn.addEventListener('mouseout', () => delBtn.style.background = 'none');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteByName(name);
      });

      const transferBtn = document.createElement('button');
      transferBtn.type = 'button';
      transferBtn.title = 'Copy to another page';
      transferBtn.innerHTML = cnoIconSvg('swap', 16);
      transferBtn.style.cssText = 'background:none; border:none; padding:8px 12px; font-size:1.1rem; color:#0369a1; cursor:pointer; flex-shrink:0;';
      transferBtn.addEventListener('mouseover', () => transferBtn.style.background = '#e0f2fe');
      transferBtn.addEventListener('mouseout', () => transferBtn.style.background = 'none');
      transferBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entry = page[name];
        if (entry) openSavedFilterTransferModal(name, entry.selections || {}, pageKey);
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSavedFilterContextMenu(e.clientX, e.clientY, [
          { label: 'Rename', icon: 'edit', onClick: () => renameByName(name) }
        ]);
      });

      row.appendChild(nameBtn);
      row.appendChild(transferBtn);
      row.appendChild(delBtn);
      resultsBox.appendChild(row);
    });
  };

  // Live search as you type
  searchInput.addEventListener('input', render);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchInput.value.trim().toLowerCase();
      const first = sortedNames().find(n => n.toLowerCase().includes(q));
      if (first) applyByName(first);
    }
  });

  readSavedFilters((all) => {
    page = all[pageKey] || {};
    render();
  });

  document.body.appendChild(modal);
  searchInput.focus();
}

const SAVED_FILTER_PAGES = [
  { key: 'positive-ev', label: 'Positive EV' },
  { key: 'low-hold', label: 'Low Hold' },
  { key: 'free-bet-converter', label: 'Free Bet Converter' },
  { key: 'odds-boost', label: 'Odds Boost' },
  { key: 'risk-free-bet', label: 'Risk-Free Bet' },
  { key: 'win-and-get', label: 'Win and Get' },
  { key: 'bet-and-get', label: 'Bet and Get' }
];

// Returns a copy of the saved selections limited to fields that exist on the destination page
function filterSelectionsForPage(selections, destKey) {
  const sel = JSON.parse(JSON.stringify(selections || {}));
  const dropped = [];
  const hasBoost = destKey === 'odds-boost';
  const hasReward = ['risk-free-bet', 'win-and-get', 'bet-and-get'].includes(destKey);

  if (!hasBoost) {
    if (sel.radios && sel.radios.boostType) {
      delete sel.radios.boostType;
      dropped.push('Boost type');
    }
    if (sel.boost) {
      if ((sel.boost.pct || '').trim() !== '' || (sel.boost.odds || '').trim() !== '') dropped.push('Boost amount');
      delete sel.boost;
    }
  }

  if (!hasReward) {
    if (sel.texts && sel.texts.TextBoxReward !== undefined) {
      if (String(sel.texts.TextBoxReward).trim() !== '') dropped.push('Reward %');
      delete sel.texts.TextBoxReward;
    }
    const hadConversion = (sel.radios && sel.radios.conversion) ||
                          (sel.texts && sel.texts.TextBoxFreeCreditConversionRate !== undefined);
    if (sel.radios) delete sel.radios.conversion;
    if (sel.texts) delete sel.texts.TextBoxFreeCreditConversionRate;
    if (hadConversion) dropped.push('Free credit conversion rate');
  }

  return { selections: sel, dropped };
}

function showSavedFilterContextMenu(x, y, items) {
  const old = document.getElementById('cno-sf-context-menu');
  if (old) old.remove();

  const menu = document.createElement('div');
  menu.id = 'cno-sf-context-menu';
  menu.style.cssText = `
    position: fixed; left: ${x}px; top: ${y}px; z-index: 1000002;
    background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.18); padding: 4px; min-width: 120px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const closeMenu = () => {
    menu.remove();
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onOutside = (e) => { if (!menu.contains(e.target)) closeMenu(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } };

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (item.icon) cnoSetIconLabel(btn, item.icon, item.label);
    else btn.textContent = item.label;
    btn.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; padding:7px 10px; font-size:0.88rem; color:#1e293b; cursor:pointer; border-radius:4px;';
    btn.addEventListener('mouseover', () => btn.style.background = '#f0f9ff');
    btn.addEventListener('mouseout', () => btn.style.background = 'none');
    btn.addEventListener('click', () => {
      closeMenu();
      item.onClick();
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  // Keep the menu on screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${Math.max(0, window.innerWidth - rect.width - 4)}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(0, window.innerHeight - rect.height - 4)}px`;

  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
}

function openSavedFilterRenameModal(oldName, onSubmit) {
  const { modal, body, close } = createSavedFilterModal(`${cnoIconSvg('edit', 17)} Rename Filter Selection`, 420, 1000000);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 60;
  nameInput.value = oldName;
  nameInput.style.cssText = SAVED_FILTER_INPUT_CSS;

  const errorMsg = document.createElement('div');
  errorMsg.style.cssText = 'color:#dc2626; font-size:0.8rem; min-height:1em;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px;';
  const cancelBtn = makeSavedFilterModalBtn('Cancel');
  const okBtn = makeSavedFilterModalBtn('Rename', 'primary');
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(okBtn);

  body.appendChild(nameInput);
  body.appendChild(errorMsg);
  body.appendChild(btnRow);

  const submit = () => {
    const newName = nameInput.value.trim();
    if (!newName) {
      errorMsg.textContent = 'Please enter a name.';
      return;
    }
    if (newName === oldName) {
      close();
      return;
    }
    close();
    onSubmit(newName);
  };

  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', submit);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  document.body.appendChild(modal);
  nameInput.focus();
  nameInput.select();
}

function openSavedFilterTransferModal(name, selections, currentKey) {
  const { modal, body, close } = createSavedFilterModal(`${cnoIconSvg('swap', 17)} Copy to Another Page`, 400, 1000000);

  const intro = document.createElement('div');
  intro.textContent = `Copy "${name}" to which page?`;
  intro.style.cssText = 'font-size:0.9rem; color:#334155;';
  body.appendChild(intro);

  const list = document.createElement('div');
  list.style.cssText = 'border:1px solid #e2e8f0; border-radius:6px; overflow-y:auto; max-height:320px;';
  body.appendChild(list);

  const doCopy = (dest) => {
    readSavedFilters((all) => {
      const { selections: filtered, dropped } = filterSelectionsForPage(selections, dest.key);
      const destPage = all[dest.key] || {};
      const existingKey = Object.keys(destPage).find(k => k.toLowerCase() === name.toLowerCase());

      const commit = (keyName) => {
        destPage[keyName] = { savedAt: Date.now(), selections: filtered };
        all[dest.key] = destPage;
        writeSavedFilters(all, () => {
          let msg = `Copied "${keyName}" to ${dest.label}.`;
          if (dropped.length) msg += ` Not carried over: ${dropped.join(', ')}.`;
          showSavedFilterToast(msg);

          openSavedFilterConfirm(`Go to ${dest.label} and apply "${keyName}" now?`, 'Go to page', () => {
            try {
              sessionStorage.setItem(PENDING_FILTER_APPLY_KEY, JSON.stringify({ pageKey: dest.key, name: keyName, ts: Date.now() }));
            } catch (e) { /* ignore */ }
            window.location.href = `${window.location.origin}/site/tools/${dest.key}.aspx`;
          }, false, 'Stay here');
        });
      };

      if (existingKey) {
        openSavedFilterConfirm(`${dest.label} already has a filter selection named "${existingKey}". Overwrite it?`, 'Overwrite', () => commit(existingKey));
      } else {
        commit(name);
      }
    });
  };

  SAVED_FILTER_PAGES.filter(p => p.key !== currentKey).forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = p.label;
    btn.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid #f1f5f9; padding:10px 12px; font-size:0.92rem; color:#1e293b; cursor:pointer;';
    btn.addEventListener('mouseover', () => btn.style.background = '#f0f9ff');
    btn.addEventListener('mouseout', () => btn.style.background = 'none');
    btn.addEventListener('click', () => {
      close();
      doCopy(p);
    });
    list.appendChild(btn);
  });

  document.body.appendChild(modal);
}

function ensureSavedFilterButtons(btnGroup, clearBtn) {
  if (!btnGroup || !clearBtn) return;

  let applyBtn = document.getElementById('cno-apply-filters-btn');
  if (!applyBtn) {
    applyBtn = document.createElement('button');
    applyBtn.id = 'cno-apply-filters-btn';
    applyBtn.type = 'button';
    applyBtn.style.cssText = SAVED_FILTER_BTN_CSS;
    cnoSetIconLabel(applyBtn, 'apply', 'Apply Filters');
    applyBtn.onclick = (e) => {
      e.stopPropagation();
      hideApplyFilterHoverMenu();
      openApplyFilterModal(getFilterAccordionContainer() || document);
    };
    attachApplyFilterHoverMenu(applyBtn);
  }

  let saveBtn = document.getElementById('cno-save-filters-btn');
  if (!saveBtn) {
    saveBtn = document.createElement('button');
    saveBtn.id = 'cno-save-filters-btn';
    saveBtn.type = 'button';
    // ~half a button of extra space before Clear Filters (plus the group's 6px gap)
    saveBtn.style.cssText = SAVED_FILTER_BTN_CSS + ' margin-right: 44px;';
    cnoSetIconLabel(saveBtn, 'save', 'Save Filter');
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      openSaveFilterModal(getFilterAccordionContainer() || document);
    };
  }

  if (!btnGroup.contains(applyBtn) || !btnGroup.contains(saveBtn)) {
    btnGroup.insertBefore(applyBtn, clearBtn);
    btnGroup.insertBefore(saveBtn, clearBtn);
  }
}

// ====================================================
// APPLY A FILTER AFTER "COPY TO ANOTHER PAGE -> GO TO PAGE"
// ====================================================

const PENDING_FILTER_APPLY_KEY = 'cno_pending_filter_apply';

function processPendingFilterApply() {
  let raw = null;
  try { raw = sessionStorage.getItem(PENDING_FILTER_APPLY_KEY); } catch (e) { return; }
  if (!raw) return;

  let pending = null;
  try { pending = JSON.parse(raw); } catch (e) { /* fall through */ }
  if (!pending || !pending.pageKey || !pending.name || (Date.now() - (pending.ts || 0)) > 120000) {
    sessionStorage.removeItem(PENDING_FILTER_APPLY_KEY);
    return;
  }

  if (pending.pageKey !== getSavedFiltersPageKey()) return;

  const container = getFilterAccordionContainer();
  if (!container || !container.classList.contains('cno-ready')) return;
  if (!container.querySelector('[id$="DropDownListLeague"]')) return;

  // Clear first so this only ever runs once
  sessionStorage.removeItem(PENDING_FILTER_APPLY_KEY);

  readSavedFilters((all) => {
    const entry = (all[pending.pageKey] || {})[pending.name];
    if (!entry) {
      showSavedFilterToast(`Couldn't find the filter "${pending.name}" on this page.`);
      return;
    }
    applyFilterSelections(container, entry.selections || {});
    recordSavedFilterUse(pending.pageKey, pending.name);
  });
}

// ====================================================
// KEYBOARD SHORTCUT FOR THE UPDATE BUTTON (Ctrl+Alt+R on Windows/Linux, Ctrl+Cmd+R on Mac)
// ====================================================

const CNO_UPDATE_BUTTON_ID_SUFFIX = 'ButtonUpdate';

function cnoIsMac() {
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  return /mac/i.test(plat);
}

function cnoUpdateShortcutLabel() {
  return cnoIsMac() ? 'Ctrl+\u2318+R' : 'Ctrl+Alt+R';
}

function cnoClearShortcutLabel() {
  return cnoIsMac() ? 'Ctrl+\u2318+C' : 'Ctrl+Alt+C';
}

// Clear Filters shortcut: Ctrl+Alt+C (Windows/Linux) or Ctrl+Cmd+C (Mac). Does not run Update.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyC' || e.repeat) return;

  const matches = cnoIsMac()
    ? (e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey)
    : (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey);
  if (!matches) return;

  const clearBtn = document.getElementById('cno-clear-filters-btn');
  if (!clearBtn || clearBtn.offsetParent === null) return;

  e.preventDefault();
  e.stopPropagation();
  clearBtn.click();
}, true);

function cnoGetActiveUpdateButton() {
  const btn = document.querySelector('input[type="submit"][id$="' + CNO_UPDATE_BUTTON_ID_SUFFIX + '"]');
  if (!btn || btn.disabled) return null;
  if (btn.offsetParent === null || getComputedStyle(btn).display === 'none') return null;
  return btn;
}

document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR' || e.repeat) return;

  const matches = cnoIsMac()
    ? (e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey)
    : (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey);
  if (!matches) return;

  if (!cnoGetActiveUpdateButton()) return;

  e.preventDefault();
  e.stopPropagation();
  triggerFilterUpdate(getFilterAccordionContainer() || document);
}, true);

// ---- Tooltip hint above the Update button (delegated, so it survives the page's partial refreshes) ----

function cnoHideUpdateHint() {
  const tip = document.getElementById('cno-update-hint');
  if (tip) tip.remove();
}

function cnoShowUpdateHint(btn, text = null) {
  cnoHideUpdateHint();

  const tip = document.createElement('div');
  tip.id = 'cno-update-hint';
  tip.textContent = text || `Shortcut: ${cnoUpdateShortcutLabel()}`;
  tip.style.cssText = `
    position: fixed; z-index: 1000001; pointer-events: none;
    background: #0f172a; color: #ffffff; padding: 4px 8px; border-radius: 4px;
    font-size: 0.75rem; font-weight: 600; white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 3px 8px rgba(0,0,0,0.25);
  `;
  document.body.appendChild(tip);

  const rect = btn.getBoundingClientRect();
  const left = Math.max(6, Math.min(rect.left + rect.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 6));
  let top = rect.top - tip.offsetHeight - 6;
  if (top < 4) top = rect.bottom + 6;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function cnoUpdateButtonFromEvent(e) {
  if (!e.target || !e.target.closest) return null;
  const el = e.target.closest('input[type="submit"]');
  if (el && el.id && el.id.endsWith(CNO_UPDATE_BUTTON_ID_SUFFIX)) return el;
  // The "Refresh" button next to "Last Updated" just clicks Update, so it gets the same shortcut hint
  const refresh = e.target.closest('input#ButtonRefresh');
  if (refresh) return refresh;
  return null;
}

document.addEventListener('mouseover', (e) => {
  const btn = cnoUpdateButtonFromEvent(e);
  if (btn && !btn.disabled) cnoShowUpdateHint(btn);
});
document.addEventListener('mouseout', (e) => {
  if (cnoUpdateButtonFromEvent(e)) cnoHideUpdateHint();
});
document.addEventListener('click', (e) => {
  if (cnoUpdateButtonFromEvent(e)) cnoHideUpdateHint();
}, true);
window.addEventListener('scroll', cnoHideUpdateHint, true);

// ====================================================
// "FILTER TO THIS EVENT" ICON NEXT TO EVENT NAMES IN THE TABLES
// ====================================================

const EVENT_FILTER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="display:block;"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5L3 4z"/></svg>`;

function getCleanEventText(link) {
  const clone = link.cloneNode(true);
  clone.querySelectorAll('.cno-ap-rank, .cno-weather-badge, .cno-injury-badge, .cno-badge, .cno-event-filter-btn, .cno-hover-tray').forEach(el => el.remove());
  return clone.textContent
    .replace(/\(#\d+\)/g, '')   // belt-and-braces: drop any AP rank text such as "(#14)"
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyEventFilter(eventText) {
  const elEvent = document.querySelector('[id$="TextBoxEventNameContains"]');
  if (!elEvent || !eventText) return;

  // Clear anything else in the box, including the Top 25 helper state
  sessionStorage.removeItem(AP_TOP25_STORAGE_KEY);
  sessionStorage.removeItem('cno_top25_cb_active');
  const top25Cb = document.querySelector('#cno-top25-cb');
  if (top25Cb) top25Cb.checked = false;

  elEvent.value = `"${eventText}"`;
  elEvent.dispatchEvent(new Event('input', { bubbles: true }));

  triggerFilterUpdate(getFilterAccordionContainer() || document);
}

// Hover icons live in a small tray that floats over the right edge of the cell (see content.css),
// so they never take up room in the layout or push text onto an extra line.
function getHoverTray(cell) {
  let tray = cell.querySelector(':scope > .cno-hover-tray');
  if (!tray) {
    tray = document.createElement('span');
    tray.className = 'cno-hover-tray';
    cell.classList.add('cno-has-hover-tray');
    cell.appendChild(tray);
  }
  return tray;
}

function processEventFilterIcons() {
  if (!document.querySelector('[id$="TextBoxEventNameContains"]')) return;

  document.querySelectorAll('a[href*="game.aspx"]').forEach(link => {
    if (!link.textContent.includes('@')) return;
    if (link.closest('#cno-update-banner-alert')) return;
    if (link.closest('.cno-hover-tray')) return;

    const tableCell = link.closest('#ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1 tbody tr:not(.footable-row-detail) > td');
    if (tableCell && tableCell.querySelector('.cno-event-filter-btn')) return;

    const next = link.nextElementSibling;
    if (next && next.classList && next.classList.contains('cno-event-filter-btn')) return;

    const btn = document.createElement('span');
    btn.className = 'cno-event-filter-btn cno-hover-filter-btn';
    btn.setAttribute('role', 'button');
    btn.title = 'Filter to this event';
    btn.innerHTML = EVENT_FILTER_ICON_SVG;
    btn.style.cssText = 'display:inline-flex; align-items:center; vertical-align:middle; margin-left:5px; padding:4px; color:#0284c7; cursor:pointer; border-radius:4px;';
    btn.addEventListener('mouseover', () => { btn.style.background = '#e0f2fe'; });
    btn.addEventListener('mouseout', () => { btn.style.background = 'none'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyEventFilter(getCleanEventText(link));
    });

    if (tableCell) getHoverTray(tableCell).appendChild(btn);
    else link.insertAdjacentElement('afterend', btn);
  });
}

// ====================================================
// HOVER FILTER ICONS FOR MARKET, BET NAME AND SPORTSBOOK CELLS
// (list pages only; the icon shows on cell hover via content.css)
// ====================================================

// Table pages that get the hover filter icons, Calc right-click and QR buttons
// (Arbitrage isn't in the Swap Page menu, so it's added here separately)
const CNO_LIST_PAGE_KEYS = SWITCH_PAGES.map(p => p.key).concat(['arbitrage']);

function isCnoListPage() {
  const path = window.location.pathname.toLowerCase();
  return CNO_LIST_PAGE_KEYS.some(key => path.includes(`${key}.aspx`));
}

// Column indexes from the header row. Hedge columns are skipped: their values belong to a different filter.
function getListTableColumns(table) {
  const cols = { sport: -1, league: -1, market: -1, betName: -1, sportsbook: -1, odds: -1, fairOdds: -1 };
  const ths = Array.from(table.querySelectorAll('thead th'));
  ths.forEach((th, i) => {
    const txt = th.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!txt || txt.startsWith('hedge')) return;
    if (cols.sport === -1 && txt === 'sport') cols.sport = i;
    else if (cols.league === -1 && txt === 'league') cols.league = i;
    else if (cols.market === -1 && txt === 'market') cols.market = i;
    else if (cols.betName === -1 && (txt === 'bet' || txt.endsWith(' name'))) cols.betName = i;
    else if (cols.sportsbook === -1 && txt.includes('sportsbook')) cols.sportsbook = i;
    else if (cols.fairOdds === -1 && txt === 'fair odds') cols.fairOdds = i;
    else if (cols.odds === -1 && (txt === 'odds' || txt.endsWith(' odds'))) cols.odds = i;
  });
  return cols;
}

// Cell text without anything the extension added (badges, icons)
// A cell's text without anything the extension added (elements whose class starts with "cno-").
// Walks the text directly instead of copying the cell (same result as the old copy-and-strip,
// checked against real tables, about 2.5x faster).
const CNO_ADDED_CLASS_RE = /(^| )cno-/;
function getCleanCellText(cell) {
  if (!cell) return '';
  let out = '';
  const walk = (node) => {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) out += n.data;
      else if (n.nodeType === 1) {
        const cls = n.getAttribute('class');
        if (cls && CNO_ADDED_CLASS_RE.test(cls)) continue;
        walk(n);
      }
    }
  };
  walk(cell);
  return out.replace(/"/g, '').replace(/\s+/g, ' ').trim();
}

// "Zach Edey Under 7.5" -> "Zach Edey", "Pelicans +12.5" -> "Pelicans", "Bam Adebayo Yes" -> "Bam Adebayo".
// If nothing is left (e.g. "Over 220.5"), the full text is used.
function extractBetNameForFilter(text) {
  const full = (text || '').replace(/\s+/g, ' ').trim();
  let name = full;
  let prev;
  do {
    prev = name;
    name = name
      .replace(/\s+(over|under)\s+[+-]?\d+(\.\d+)?$/i, '')
      .replace(/\s+[+-]\d+(\.\d+)?$/, '')
      .replace(/\s+(yes|no)$/i, '')
      .trim();
  } while (name !== prev);
  return name || full;
}

function setTextFilterAndUpdate(suffix, value) {
  const el = document.querySelector(`[id$="${suffix}"]`);
  if (!el || !value) return;
  if (suffix === 'TextBoxBetNameContains') {
    // Use the new text as the user's own value if Exclude Injured is injecting syntax
    sessionStorage.removeItem(BET_CONTAINS_STORAGE_KEY);
  }
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  triggerFilterUpdate(getFilterAccordionContainer() || document);
}

// Pick the dropdown option whose text matches a table value (Sport / League), then run Update
function applyDropdownFilter(suffix, fieldLabel, value) {
  const el = document.querySelector(`[id$="${suffix}"]`);
  if (!el || !value) return;
  const target = value.toLowerCase();
  const idx = Array.from(el.options).findIndex(o => o.text.replace(/\s+/g, ' ').trim().toLowerCase() === target);
  if (idx === -1) {
    showSavedFilterToast(`Couldn't find "${value}" in the ${fieldLabel} list.`);
    return;
  }
  el.selectedIndex = idx;
  el.dispatchEvent(new Event('change', { bubbles: true })); // Sport/League clear each other via their change handlers
  triggerFilterUpdate(getFilterAccordionContainer() || document);
}

function applySportsbookFilter(bookName) {
  const el = document.querySelector('[id$="DropDownListSportsbookSite_All"]') ||
             document.querySelector('[id$="DropDownListSportsbookSite_NonDFS"]');
  if (!el || !bookName) return;
  const target = bookName.toLowerCase();
  const idx = Array.from(el.options).findIndex(o => o.text.replace(/\s+/g, ' ').trim().toLowerCase() === target);
  if (idx === -1) {
    showSavedFilterToast(`Couldn't find "${bookName}" in the Sportsbook list.`);
    return;
  }
  el.selectedIndex = idx;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  triggerFilterUpdate(getFilterAccordionContainer() || document);
}

function createHoverFilterBtn(title, onClick, iconSvg = EVENT_FILTER_ICON_SVG) {
  const btn = document.createElement('span');
  btn.className = 'cno-cell-filter-btn cno-hover-filter-btn';
  btn.setAttribute('role', 'button');
  btn.title = title;
  btn.innerHTML = iconSvg;
  btn.style.cssText = 'display:inline-flex; align-items:center; vertical-align:middle; margin-left:5px; padding:4px; color:#0284c7; cursor:pointer; border-radius:4px;';
  btn.addEventListener('mouseover', () => { btn.style.background = '#e0f2fe'; });
  btn.addEventListener('mouseout', () => { btn.style.background = 'none'; });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function processCellFilterIcons() {
  if (!isCnoListPage()) return;
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table) return;

  const cols = getListTableColumns(table);
  const hasMarket = cols.market !== -1 && document.querySelector('[id$="TextBoxMarketNameContains"]');
  const hasBet = cols.betName !== -1 && document.querySelector('[id$="TextBoxBetNameContains"]');
  const hasBook = cols.sportsbook !== -1 && (document.querySelector('[id$="DropDownListSportsbookSite_All"]') || document.querySelector('[id$="DropDownListSportsbookSite_NonDFS"]'));
  const hasSport = cols.sport !== -1 && document.querySelector('[id$="DropDownListSport"]');
  const hasLeague = cols.league !== -1 && document.querySelector('[id$="DropDownListLeague"]');
  const hedgeBookIdx = getHedgeBookColumnIndex(table);
  if (!hasMarket && !hasBet && !hasBook && !hasSport && !hasLeague && hedgeBookIdx === -1) return;

  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    const cells = row.children;

    if (hasSport) {
      const cell = cells[cols.sport];
      if (cell && !cell.querySelector('.cno-cell-filter-btn') && getCleanCellText(cell)) {
        getHoverTray(cell).appendChild(createHoverFilterBtn('Filter to this sport', () => {
          applyDropdownFilter('DropDownListSport', 'Sport', getCleanCellText(cell));
        }));
      }
    }

    if (hasLeague) {
      const cell = cells[cols.league];
      if (cell && !cell.querySelector('.cno-cell-filter-btn') && getCleanCellText(cell)) {
        getHoverTray(cell).appendChild(createHoverFilterBtn('Filter to this league', () => {
          applyDropdownFilter('DropDownListLeague', 'League', getCleanCellText(cell));
        }));
      }
    }

    if (hasMarket) {
      const cell = cells[cols.market];
      if (cell && !cell.querySelector('.cno-cell-filter-btn') && getCleanCellText(cell)) {
        getHoverTray(cell).appendChild(createHoverFilterBtn('Filter to this market', () => {
          setTextFilterAndUpdate('TextBoxMarketNameContains', `"${getCleanCellText(cell)}"`);
        }));
      }
    }

    if (hasBet) {
      const cell = cells[cols.betName];
      if (cell && !cell.querySelector('.cno-cell-filter-btn') && getCleanCellText(cell)) {
        getHoverTray(cell).appendChild(createHoverFilterBtn('Filter to this name', () => {
          setTextFilterAndUpdate('TextBoxBetNameContains', `"${extractBetNameForFilter(getCleanCellText(cell))}"`);
        }));
      }
    }

    if (hedgeBookIdx !== -1) {
      const cell = cells[hedgeBookIdx];
      if (cell && !cell.querySelector('.cno-cell-filter-btn') && getCleanCellText(cell)) {
        const filterBtn = createHoverFilterBtn('Refine to this hedge sportsbook (hides other rows; doesn\'t search CNO)', () => {
          setHedgeBookFilter(getCleanCellText(cell));
        }, ROWS_FILTER_ICON_SVG);
        const qrBtn = cell.querySelector('.cno-qr-btn');
        if (qrBtn) qrBtn.parentNode.insertBefore(filterBtn, qrBtn);
        else getHoverTray(cell).appendChild(filterBtn);
      }
    }

    if (hasBook) {
      const cell = cells[cols.sportsbook];
      if (cell && !cell.querySelector('.cno-cell-filter-btn') && getCleanCellText(cell)) {
        const filterBtn = createHoverFilterBtn('Filter to this sportsbook', () => {
          applySportsbookFilter(getCleanCellText(cell));
        });
        const qrBtn = cell.querySelector('.cno-qr-btn');
        if (qrBtn) qrBtn.parentNode.insertBefore(filterBtn, qrBtn);
        else getHoverTray(cell).appendChild(filterBtn);
      }
    }
  });
}

// ====================================================
// CALC BUTTON: MODERN STYLE (content.css) + RIGHT-CLICK "OPEN IN DEVIGGER"
// ====================================================

const CALC_DEVIG_TOOLTIP = 'Click to open the calculator. Right-click to open in Devigger.';

function getCalcRowDeviggerUrl(btn) {
  const row = btn.closest('tr');
  const table = btn.closest('table');
  if (!row || !table) return null;

  const cols = getListTableColumns(table);
  if (cols.odds === -1) return null;
  const oddsCell = row.children[cols.odds];
  if (!oddsCell) return null;
  const finalOdds = extractAmericanOdds(getCleanCellText(oddsCell));
  if (!finalOdds) return null;

  let fairOdds = null;
  if (cols.fairOdds !== -1) {
    const fairCell = row.children[cols.fairOdds];
    fairOdds = fairCell ? extractAmericanOdds(getCleanCellText(fairCell)) : null;
  } else {
    // Promo pages with Profit Strategy = +EV have no Fair Odds column, but "EV Hit%" is the
    // devigged (fair) chance the bet wins, so the fair odds follow from it. Not on Hedge.
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
    if (heads.some(h => h.startsWith('hedge'))) return null;
    // Risk Free Bet, Bet and Get, Win and Get: the Devigger and Sharp FV can only show a plain
    // bet's EV%, not the promo's, so FV Devig / Sharp FV aren't offered there (Free Bet keeps them)
    if (/(risk-free-bet|bet-and-get|win-and-get)\.aspx/i.test(window.location.pathname)) return null;
    const hitIdx = heads.indexOf('ev hit%');
    const hitCell = hitIdx !== -1 ? row.children[hitIdx] : null;
    const pct = hitCell ? parseFloat(getCleanCellText(hitCell).replace(/[^0-9.]/g, '')) : NaN;
    fairOdds = cnoProbabilityToAmerican(pct / 100);
  }
  if (!fairOdds) return null;

  // Same URL format as the calc popup's "Open in Devigger" link
  const headerTexts = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  const eventIdx = headerTexts.indexOf('event');
  const textAt = (i) => (i >= 0 && row.children[i]) ? getCleanCellText(row.children[i]) : '';
  const legOdds = cnoBuildDeviggerLegOdds(fairOdds.replace('+', ''), textAt(eventIdx), textAt(cols.market), textAt(cols.betName),
    [textAt(headerTexts.indexOf('sport')), textAt(headerTexts.indexOf('league'))].filter(Boolean).join(' - '));

  // Odds Boost page with "Odds Surge": the surge amount is added to the odds themselves
  let surgedOdds = finalOdds;
  const onBoostPage = window.location.pathname.toLowerCase().includes('odds-boost.aspx');
  const boostTypeEl = onBoostPage ? document.querySelector('input[name$="RadioButtonListOddsBoostType"]:checked') : null;
  if (boostTypeEl && boostTypeEl.value === 'surge') {
    const surgeInput = document.querySelector('#spanBoostOdds input[type="text"]');
    const surge = surgeInput ? parseFloat(surgeInput.value.replace(/[^0-9.+-]/g, '')) : NaN;
    const boosted = cnoAddToAmericanOdds(finalOdds, surge);
    if (boosted) surgedOdds = boosted;
  }

  let url = `http://crazyninjamike.com/Public/sportsbooks/sportsbook_devigger.aspx?autofill=1&LegOdds=${encodeURIComponent(legOdds)}&FinalOdds=${encodeURIComponent(surgedOdds.replace('+', ''))}`;

  // Odds Boost page: carry the profit boost, as the popup does
  if (onBoostPage) {
    const boostType = boostTypeEl;
    const pctInput = document.querySelector('#spanBoostPercentage input[type="text"]');
    const pct = pctInput ? pctInput.value.replace('%', '').trim() : '';
    if ((!boostType || boostType.value === 'profit') && pct && !isNaN(parseFloat(pct))) {
      url += `&Boost_Bool=1&Boost_Text=${encodeURIComponent(pct)}&Boost_Type=0`;
    }
  }
  return url;
}

function showCalcDeviggerMenu(x, y, url) {
  const existing = document.getElementById('cno-context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'cno-context-menu';
  menu.style.cssText = `
    position: fixed; top: ${y}px; left: ${x}px;
    background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18); z-index: 999999;
    padding: 4px 0; min-width: 150px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const item = document.createElement('a');
  item.href = url;
  item.target = '_blank';
  item.rel = 'noopener';
  cnoSetIconLabel(item, 'devig', 'Open in Devigger', '↗');
  item.style.cssText = 'display:block; padding:6px 12px; color:#0369a1; font-weight:600; font-size:0.8rem; text-decoration:none;';
  item.addEventListener('mouseover', () => { item.style.background = '#f0f9ff'; });
  item.addEventListener('mouseout', () => { item.style.background = 'none'; });
  item.addEventListener('click', () => menu.remove());
  menu.appendChild(item);

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
}

function getCalcButtonFromEvent(e) {
  const el = e.target && e.target.closest ? e.target.closest('input[type="button"]') : null;
  if (!el || el.value !== 'Calc') return null;
  if (!el.closest('#ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1')) return null;
  return el;
}

function processCalcButtons() {
  if (!isCnoListPage()) return;
  document.querySelectorAll('#ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1 input[type="button"][value="Calc"]').forEach(btn => {
    if (btn.dataset.cnoCalcReady) return;
    btn.dataset.cnoCalcReady = 'true';
    btn.classList.add('cno-calc-btn');
    if (btn.title === CALC_DEVIG_TOOLTIP) btn.removeAttribute('title'); // right-click devig was replaced by the FV Devig tab
  });
}


document.addEventListener('click', () => {
  const menu = document.getElementById('cno-context-menu');
  if (menu) menu.remove();
});
window.addEventListener('scroll', () => {
  const menu = document.getElementById('cno-context-menu');
  if (menu) menu.remove();
}, true);

// ====================================================
// ODDS BOOST PAGE: START THE CURSOR IN THE BOOST AMOUNT BOX
// ====================================================

let cnoBoostFocusDone = false;
const cnoBoostFocusDeadline = Date.now() + 15000;

function processBoostAutoFocus() {
  if (cnoBoostFocusDone) return;
  if (!window.location.pathname.toLowerCase().includes('odds-boost.aspx')) { cnoBoostFocusDone = true; return; }
  if (Date.now() > cnoBoostFocusDeadline) { cnoBoostFocusDone = true; return; }

  // Wait until the filter panel is built (and any Swap Page / saved-filter values are filled in)
  const container = getFilterAccordionContainer();
  if (container && !container.classList.contains('cno-ready')) return;
  try { if (sessionStorage.getItem(PENDING_FILTER_APPLY_KEY)) return; } catch (e) { /* ignore */ }

  // Don't take the cursor away from a box the user already clicked into
  const active = document.activeElement;
  if (active && active !== document.body && active !== document.documentElement) { cnoBoostFocusDone = true; return; }

  // Profit / Full Wager boost use the % box; Odds Surge uses the boosted-odds box
  const candidates = [
    document.querySelector('#spanBoostPercentage input[type="text"]'),
    document.querySelector('#spanBoostOdds input[type="text"]')
  ];
  const input = candidates.find(el => el && !el.disabled && el.offsetParent !== null);
  if (!input) return;

  input.focus();
  try { input.select(); } catch (e) { /* ignore */ }
  cnoBoostFocusDone = true;
}

// ====================================================
// QR CODE BUTTON ON SPORTSBOOK CELLS
// Encodes CNO's own redirect link (not the book's direct link), shown in a popup that
// closes on any click or key press. QR encoder: qrcode.js (window.CnoQRCode).
// ====================================================

function closeQrPopup() {
  const overlay = document.getElementById('cno-qr-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('mousedown', onQrPopupDismiss, true);
  document.removeEventListener('keydown', onQrPopupDismiss, true);
  window.removeEventListener('scroll', closeQrPopup, true);
}

function onQrPopupDismiss(e) {
  // Swallow the click/key so it doesn't also act on the page underneath
  e.preventDefault();
  e.stopPropagation();
  closeQrPopup();
  if (e.type === 'mousedown') {
    const swallowClick = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    document.addEventListener('click', swallowClick, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', swallowClick, true), 400);
  }
}

function buildQrSvg(text, pixelSize = 300) {
  if (!window.CnoQRCode) return null;
  let qr;
  try { qr = window.CnoQRCode.create(text); } catch (e) { return null; }
  const quiet = 4;
  const dim = qr.size + quiet * 2;
  let path = '';
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges" style="display:block;"><rect width="${dim}" height="${dim}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}

function openQrPopup(url, bookName, details = {}) {
  closeQrPopup();
  const svg = buildQrSvg(url);
  if (!svg) {
    showSavedFilterToast("Couldn't create a QR code for this link.");
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'cno-qr-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 1000002;
    background: rgba(15, 23, 42, 0.45);
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: #ffffff; border-radius: 10px; padding: 16px 18px 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3); text-align: center;
  `;

  const title = document.createElement('div');
  title.style.cssText = 'margin-bottom: 10px; max-width: 300px; margin-left: auto; margin-right: auto;';

  const titleBook = document.createElement('div');
  titleBook.textContent = bookName || 'Sportsbook';
  titleBook.style.cssText = 'font-weight: 700; font-size: 1rem; color: #0f172a;';
  title.appendChild(titleBook);

  if (details.event) {
    const titleEvent = document.createElement('div');
    titleEvent.textContent = details.event;
    titleEvent.style.cssText = 'font-weight: 500; font-size: 0.78rem; color: #64748b; margin-top: 2px;';
    title.appendChild(titleEvent);
  }

  const betLine = [details.market, details.betName].filter(Boolean).join(' ');
  if (betLine) {
    const titleBet = document.createElement('div');
    titleBet.textContent = betLine;
    titleBet.style.cssText = 'font-weight: 600; font-size: 0.85rem; color: #334155; margin-top: 3px; line-height: 1.3;';
    title.appendChild(titleBet);
  }
  if (details.odds) {
    const titleOdds = document.createElement('div');
    titleOdds.textContent = details.odds;
    titleOdds.style.cssText = 'font-weight: 700; font-size: 0.95rem; color: #0284c7; margin-top: 3px;';
    title.appendChild(titleOdds);
  }

  const qrWrap = document.createElement('div');
  qrWrap.innerHTML = svg;

  const hint = document.createElement('div');
  hint.textContent = 'Scan with your phone. Click or press any key to close.';
  hint.style.cssText = 'font-size: 0.75rem; color: #64748b; margin-top: 8px;';

  box.appendChild(title);
  box.appendChild(qrWrap);
  box.appendChild(hint);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Wait a tick so the click that opened the popup doesn't close it
  setTimeout(() => {
    if (!document.getElementById('cno-qr-overlay')) return;
    document.addEventListener('mousedown', onQrPopupDismiss, true);
    document.addEventListener('keydown', onQrPopupDismiss, true);
    window.addEventListener('scroll', closeQrPopup, true);
  }, 0);
}

function createQrBtn(link, getBookName, getDetails = () => ({})) {
  const btn = document.createElement('span');
  btn.className = 'cno-qr-btn cno-hover-filter-btn';
  btn.setAttribute('role', 'button');
  btn.title = 'Show QR code for this link';
  btn.textContent = 'QR';
  btn.style.cssText = `
    display:inline-flex; align-items:center; vertical-align:middle; margin-left:6px;
    padding:3px 7px; font-size:0.78rem; font-weight:700; line-height:1.2; letter-spacing:0.02em;
    color:#0284c7; border:1px solid #7dd3fc; border-radius:4px; cursor:pointer; user-select:none;
  `;
  btn.addEventListener('mouseover', () => { btn.style.background = '#e0f2fe'; });
  btn.addEventListener('mouseout', () => { btn.style.background = 'none'; });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openQrPopup(link.href, getBookName(), getDetails());
  });
  return btn;
}

function processSportsbookQrButtons() {
  if (!isCnoListPage()) return;
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table) return;

  // Every Sportsbook column, including "Hedge Bet Sportsbook" (only present when the page shows hedge bets)
  const bookCols = [];
  Array.from(table.querySelectorAll('thead th')).forEach((th, i) => {
    if (th.textContent.replace(/\s+/g, ' ').trim().toLowerCase().includes('sportsbook')) bookCols.push(i);
  });
  if (!bookCols.length) return;

  // For each book column, the matching Name / Odds columns (hedge book -> hedge name/odds)
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  const marketIdx = headers.findIndex(h => h === 'market');
  const findCol = (isHedge, test) => headers.findIndex(h => h.startsWith('hedge') === isHedge && test(h));
  const relatedCols = {};
  bookCols.forEach(idx => {
    const isHedge = headers[idx].startsWith('hedge');
    relatedCols[idx] = {
      name: findCol(isHedge, h => h === 'bet' || h.endsWith(' name')),
      odds: findCol(isHedge, h => h !== 'fair odds' && (h === 'odds' || h.endsWith(' odds')))
    };
  });

  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    bookCols.forEach(idx => {
      const cell = row.children[idx];
      if (!cell || cell.querySelector('.cno-qr-btn')) return;
      const link = cell.querySelector('a[href*="deeplink.aspx"]') || cell.querySelector('a[href]');
      if (!link || !link.href || !/^https?:/i.test(link.href)) return;

      const getDetails = () => {
        const textAt = (i) => (i >= 0 && row.children[i]) ? getCleanCellText(row.children[i]) : '';
        const oddsText = textAt(relatedCols[idx].odds);
        return {
          market: textAt(marketIdx),
          betName: textAt(relatedCols[idx].name),
          odds: (typeof extractAmericanOdds === 'function' && extractAmericanOdds(oddsText)) || oddsText
        };
      };
      getHoverTray(cell).appendChild(createQrBtn(link, () => getCleanCellText(cell), getDetails));
    });
  });
}

// ====================================================
// HEDGE BET SPORTSBOOK FILTER (client-side only)
// There's no hedge-book dropdown on the site, so this hides non-matching rows in the table
// instead of running Update. It survives Update (re-applied every pass) and is cleared by
// the ✕ or by any page load, since it only lives in memory.
// ====================================================

let cnoHedgeBookFilter = null;

window.addEventListener('pageshow', (e) => {
  // Coming back via the browser's back/forward cache counts as a fresh page load
  if (e.persisted) clearHedgeBookFilter();
});

function getHedgeBookColumnIndex(table) {
  const ths = Array.from(table.querySelectorAll('thead th'));
  return ths.findIndex(th => {
    const txt = th.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    return txt.startsWith('hedge') && txt.includes('sportsbook');
  });
}

// cnoHedgeBookFilter is null (no filter) or an array of hedge sportsbook names
function setHedgeBookFilter(bookName) {
  if (!bookName) return;
  cnoHedgeBookFilter = [bookName];
  syncLowHoldHedgeBookPicker(cnoHedgeBookFilter);
  processHedgeBookFilter();
}

function setHedgeBookFilterList(bookNames) {
  cnoHedgeBookFilter = (bookNames && bookNames.length) ? bookNames.slice() : null;
  processHedgeBookFilter();
}

function clearHedgeBookFilter() {
  cnoHedgeBookFilter = null;
  syncLowHoldHedgeBookPicker(null); // X: back to all books selected
  processHedgeBookFilter();
}

function formatHedgeFilterLabel(books) {
  if (books.length === 1) return `Refined to ${books[0]} Hedge Sportsbook`;
  const list = books.length === 2
    ? `${books[0]} and ${books[1]}`
    : `${books.slice(0, -1).join(', ')}, and ${books[books.length - 1]}`;
  return `Refined to ${list} Hedge Sportsbooks`;
}

function processHedgeBookFilter() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  let banner = document.getElementById('cno-hedge-filter-banner');

  if (!cnoHedgeBookFilter || !cnoHedgeBookFilter.length) {
    if (banner) banner.remove();
    document.querySelectorAll('.cno-hedge-hidden').forEach(el => el.classList.remove('cno-hedge-hidden'));
    return;
  }
  if (!table || !isCnoListPage()) return;

  const targets = new Set(cnoHedgeBookFilter.map(b => b.toLowerCase()));
  const hedgeIdx = getHedgeBookColumnIndex(table);

  if (hedgeIdx !== -1) {
    table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
      const cell = row.children[hedgeIdx];
      const match = !!cell && targets.has(cnoCellText(cell).toLowerCase());
      row.classList.toggle('cno-hedge-hidden', !match);
      // Keep an expanded (mobile/narrow view) detail row in step with its main row
      const next = row.nextElementSibling;
      if (next && next.classList.contains('footable-row-detail')) next.classList.toggle('cno-hedge-hidden', !match);
    });
  }

  if (!banner) {
    // The notice is an extra first row inside the table header, so it stays pinned with the header
    // while scrolling. It uses a <td>, not a <th>, so column lookups ("thead th") are unaffected,
    // and footable reads column settings from the last header row, which is still the real one.
    banner = document.createElement('tr');
    banner.id = 'cno-hedge-filter-banner';
    const bannerCell = document.createElement('td');
    bannerCell.className = 'cno-hedge-filter-cell';
    bannerCell.style.cssText = 'text-align: left; padding: 4px 0 5px 0; background: #ffffff; border: none;';
    banner.appendChild(bannerCell);
    const pill = document.createElement('span');
    pill.className = 'cno-hedge-filter-pill';
    pill.style.cssText = `
      display: inline-flex; align-items: center; gap: 8px;
      padding: 4px 6px 4px 10px;
      background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 6px;
      color: #0369a1; font-size: 0.8rem; font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    bannerCell.appendChild(pill);
    const label = document.createElement('span');
    label.className = 'cno-hedge-filter-label';
    const pillIcon = document.createElement('span');
    pillIcon.innerHTML = ROWS_FILTER_ICON_SVG;
    pillIcon.style.cssText = 'display:inline-flex; margin-right:-2px;';
    pill.appendChild(pillIcon);
    const closeBtn = document.createElement('span');
    closeBtn.setAttribute('role', 'button');
    closeBtn.title = 'Remove this refinement';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'cursor:pointer; padding:0 5px; border-radius:3px; font-weight:700; line-height:1.3;';
    closeBtn.addEventListener('mouseover', () => { closeBtn.style.background = '#bae6fd'; });
    closeBtn.addEventListener('mouseout', () => { closeBtn.style.background = 'none'; });
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearHedgeBookFilter();
    });
    pill.appendChild(label);
    pill.appendChild(closeBtn);
  }

  const labelText = formatHedgeFilterLabel(cnoHedgeBookFilter);
  const label = banner.querySelector('.cno-hedge-filter-label');
  if (label.textContent !== labelText) label.textContent = labelText;

  const thead = table.querySelector('thead');
  if (!thead) return;
  const headerCount = Math.max(1, table.querySelectorAll('thead th').length);
  const bannerCell = banner.querySelector('.cno-hedge-filter-cell');
  if (bannerCell && String(bannerCell.colSpan) !== String(headerCount)) bannerCell.colSpan = headerCount;
  if (banner.parentNode !== thead || thead.firstElementChild !== banner) {
    thead.insertBefore(banner, thead.firstChild);
  }
}

// ====================================================
// SAVED FILTER USAGE + "APPLY FILTERS" HOVER MENU
// Each saved filter keeps useCount / lastUsed. Hovering Apply Filters lists the page's 10 most-used
// filters (ties: most recent), shown alphabetically, topped up with unused ones. Click still opens the popup.
// ====================================================

const APPLY_HOVER_MENU_MAX = 10;

function recordSavedFilterUse(pageKey, name) {
  readSavedFilters((all) => {
    const entry = (all[pageKey] || {})[name];
    if (!entry) return;
    entry.useCount = (entry.useCount || 0) + 1;
    entry.lastUsed = Date.now();
    writeSavedFilters(all, () => {});
  });
}

function pickApplyHoverMenuNames(page) {
  const names = Object.keys(page);
  const ranked = names.slice().sort((a, b) => {
    const ea = page[a] || {}, eb = page[b] || {};
    const ca = ea.useCount || 0, cb = eb.useCount || 0;
    if (cb !== ca) return cb - ca;
    const la = ea.lastUsed || 0, lb = eb.lastUsed || 0;
    if (lb !== la) return lb - la;
    return a.localeCompare(b, undefined, { sensitivity: 'base' }); // unused filters fill in alphabetically
  });
  return ranked.slice(0, APPLY_HOVER_MENU_MAX)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

let cnoApplyHoverMenuHide = null;
function hideApplyFilterHoverMenu() {
  if (cnoApplyHoverMenuHide) cnoApplyHoverMenuHide();
}

function attachApplyFilterHoverMenu(btn) {
  let menu = null;
  let hideTimer = null;
  let showTimer = null;
  let hovering = false;

  const cancelHide = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
  const cancelShow = () => { if (showTimer) { clearTimeout(showTimer); showTimer = null; } };
  const hide = () => { cancelHide(); cancelShow(); if (menu) { menu.remove(); menu = null; } };
  const scheduleHide = () => { cancelHide(); hideTimer = setTimeout(hide, 180); };
  cnoApplyHoverMenuHide = hide;

  const build = () => {
    const pageKey = getSavedFiltersPageKey();
    readSavedFilters((all) => {
      if (!hovering || menu) return;
      const page = all[pageKey] || {};
      const total = Object.keys(page).length;

      menu = document.createElement('div');
      menu.id = 'cno-apply-filter-hover-menu';
      menu.style.cssText = `
        position: fixed; z-index: 1000001; width: 260px;
        background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;
        box-shadow: 0 12px 28px rgba(15,23,42,0.16), 0 2px 6px rgba(15,23,42,0.08);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        opacity: 0; transform: translateY(-4px);
        transition: opacity 0.12s ease, transform 0.12s ease;
      `;

      // Header
      const header = document.createElement('div');
      header.style.cssText = `
        display:flex; align-items:center; justify-content:space-between;
        padding: 8px 12px 7px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
        font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b;
      `;
      const headerLabel = document.createElement('span');
      headerLabel.textContent = 'Quick Apply';
      const headerCount = document.createElement('span');
      headerCount.textContent = `${total} saved`;
      headerCount.style.cssText = 'font-weight:600; letter-spacing:0; text-transform:none; color:#94a3b8;';
      header.appendChild(headerLabel);
      header.appendChild(headerCount);
      menu.appendChild(header);

      // Filter list
      const list = document.createElement('div');
      list.style.cssText = 'padding: 5px;';
      const names = pickApplyHoverMenuNames(page);

      if (!names.length) {
        const empty = document.createElement('div');
        empty.textContent = 'No saved filters on this page yet.';
        empty.style.cssText = 'padding: 10px 8px; font-size: 0.8rem; color: #94a3b8; font-style: italic;';
        list.appendChild(empty);
      }

      names.forEach(name => {
        const item = document.createElement('button');
        item.type = 'button';
        item.title = `Apply "${name}"`;
        item.style.cssText = `
          display:flex; align-items:center; gap:9px; width:100%; text-align:left;
          background:none; border:none; padding:7px 9px; border-radius:6px; cursor:pointer;
          font-size:0.84rem; font-weight:600; color:#0f172a;
          transition: background-color 0.1s ease, color 0.1s ease;
        `;

        const icon = document.createElement('span');
        icon.innerHTML = EVENT_FILTER_ICON_SVG;
        icon.style.cssText = `
          flex: 0 0 auto; display:inline-flex; align-items:center; justify-content:center;
          width:22px; height:22px; border-radius:5px; background:#e0f2fe; color:#0284c7;
        `;

        const label = document.createElement('span');
        label.textContent = name;
        label.style.cssText = 'flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';

        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.style.cssText = 'flex:0 0 auto; font-size:1rem; line-height:1; color:#0284c7; opacity:0; transition:opacity 0.1s ease;';

        item.appendChild(icon);
        item.appendChild(label);
        item.appendChild(arrow);

        item.addEventListener('mouseover', () => {
          item.style.background = '#f0f9ff';
          item.style.color = '#0369a1';
          icon.style.background = '#0284c7';
          icon.style.color = '#ffffff';
          arrow.style.opacity = '1';
        });
        item.addEventListener('mouseout', () => {
          item.style.background = 'none';
          item.style.color = '#0f172a';
          icon.style.background = '#e0f2fe';
          icon.style.color = '#0284c7';
          arrow.style.opacity = '0';
        });
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          hide();
          readSavedFilters((latest) => {
            const entry = (latest[pageKey] || {})[name];
            if (!entry) {
              showSavedFilterToast(`Couldn't find the filter "${name}" on this page.`);
              return;
            }
            applyFilterSelections(getFilterAccordionContainer() || document, entry.selections || {});
            recordSavedFilterUse(pageKey, name);
          });
        });
        list.appendChild(item);
      });
      menu.appendChild(list);

      // Footer: always offer the full popup
      const footer = document.createElement('button');
      footer.type = 'button';
      footer.innerHTML = `${cnoIconSvg('options')}<span>Show / Manage All Filters</span>`;
      footer.style.cssText = `
        display:flex; align-items:center; justify-content:center; gap:7px; width:100%;
        background:#f8fafc; border:none; border-top:1px solid #e2e8f0;
        padding: 9px 12px; cursor:pointer;
        font-size:0.8rem; font-weight:700; color:#0369a1;
        transition: background-color 0.1s ease;
      `;
      footer.addEventListener('mouseover', () => footer.style.background = '#e0f2fe');
      footer.addEventListener('mouseout', () => footer.style.background = '#f8fafc');
      footer.addEventListener('click', (e) => {
        e.stopPropagation();
        hide();
        openApplyFilterModal(getFilterAccordionContainer() || document);
      });
      menu.appendChild(footer);

      menu.addEventListener('mouseenter', () => { hovering = true; cancelHide(); });
      menu.addEventListener('mouseleave', () => { hovering = false; scheduleHide(); });
      document.body.appendChild(menu);

      const rect = btn.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${rect.bottom + 4}px`;
      requestAnimationFrame(() => {
        if (!menu) return;
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
      });
    });
  };

  btn.addEventListener('mouseenter', () => {
    hovering = true;
    cancelHide();
    if (menu || showTimer) return;
    showTimer = setTimeout(() => { showTimer = null; build(); }, 150);
  });
  btn.addEventListener('mouseleave', () => {
    hovering = false;
    cancelShow();
    scheduleHide();
  });
  window.addEventListener('scroll', hide, true);
}

// ====================================================
// INJURY FILTER: "EXCLUDE" HIDES ROWS FOR INJURED PLAYERS
// A row is hidden when its League is MLB/NBA/NFL/WNBA and its bet name (minus periods, commas,
// Over/Under/Yes/No and numbers) matches a player on that league's injury report.
// Re-applied every pass, so it survives Update; unchecking shows the rows again immediately.
// ====================================================

function processInjuredRowExclusion() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const cb = document.getElementById('cno-exclude-injured-cb');
  const active = !!(table && cb && cb.checked && !cb.disabled && isCnoListPage() &&
    typeof injuryDataMap !== 'undefined' && injuryDataMap && injuryDataMap.size > 0);

  let hidden = 0;
  if (!active) {
    document.querySelectorAll('.cno-injured-hidden').forEach(el => el.classList.remove('cno-injured-hidden'));
  } else {
    const ths = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
    const leagueIdx = ths.findIndex(h => h === 'league');
    const nameIdx = getListTableColumns(table).betName;

    table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
      let injured = false;
      if (leagueIdx !== -1 && nameIdx !== -1) {
        const league = (row.children[leagueIdx] ? cnoCellText(row.children[leagueIdx]) : '').toUpperCase();
        if (VALID_INJURY_LEAGUES.includes(league) && row.children[nameIdx]) {
          const name = normalizePlayerName(cnoCellText(row.children[nameIdx]));
          injured = !!name && injuryDataMap.has(`${league}|${name}`);
        }
      }
      row.classList.toggle('cno-injured-hidden', injured);
      const next = row.nextElementSibling;
      if (next && next.classList.contains('footable-row-detail')) next.classList.toggle('cno-injured-hidden', injured);
      if (injured) hidden++;
    });
  }

  // The "N rows hidden" note above the table covers every row-hiding filter (processHiddenRowsNote)
}

// ====================================================
// OPTION: REMOVE THE "EXTRA" COLUMN WHEN NO ROW USES IT
// ====================================================

function processUnusedExtraColumn() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table) return;

  const ths = Array.from(table.querySelectorAll('thead th'));
  const idx = ths.findIndex(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'extra');
  if (idx === -1) return;

  const rows = Array.from(table.querySelectorAll('tbody tr:not(.footable-row-detail)'));
  const cellIsEmpty = (cell) => !cell ||
    (cnoCellText(cell) === '' && !cell.querySelector('img, input, svg, a'));

  const hide = !!(typeof userSettings !== 'undefined' && userSettings.hideUnusedExtraColumn) &&
    rows.every(row => cellIsEmpty(row.children[idx]));

  ths[idx].classList.toggle('cno-col-hidden', hide);
  rows.forEach(row => {
    const cell = row.children[idx];
    if (cell) cell.classList.toggle('cno-col-hidden', hide);
  });
}

// ====================================================
// LOW HOLD: MULTI-SELECT HEDGE SPORTSBOOK FILTER
// Lives at the bottom of "Execution & Hedging". Books come from the Sportsbook dropdown.
// All (or none) selected = no filter. Otherwise, on Update, rows are filtered to those hedge
// books the same way as the hedge-sportsbook filter icon.
// ====================================================

let cnoHedgeSwapParamUsed = false;

function getLowHoldHedgeBookPicker() {
  return document.getElementById('cno-lh-hedge-picker');
}

function getPickerChecks(picker) {
  return Array.from(picker.querySelectorAll('input.cno-lh-hedge-book-cb'));
}

function updateLowHoldHedgePickerSummary(picker) {
  const summary = picker.querySelector('.cno-lh-hedge-summary-text');
  if (!summary) return;
  const checks = getPickerChecks(picker);
  const selected = checks.filter(c => c.checked).map(c => c.value);
  let text;
  if (selected.length === checks.length) text = 'All sportsbooks';
  else if (selected.length === 0) text = 'None selected (treated as all)';
  else if (selected.length <= 2) text = selected.join(', ');
  else text = `${selected.length} of ${checks.length} sportsbooks`;
  summary.textContent = text;
  summary.parentElement.title = selected.length && selected.length < checks.length ? selected.join(', ') : '';
}

// null = select every book; an array = select just those books
function syncLowHoldHedgeBookPicker(bookNames) {
  const picker = getLowHoldHedgeBookPicker();
  if (!picker) return;
  const wanted = bookNames ? new Set(bookNames.map(b => b.toLowerCase())) : null;
  getPickerChecks(picker).forEach(c => { c.checked = wanted ? wanted.has(c.value.toLowerCase()) : true; });
  updateLowHoldHedgePickerSummary(picker);
}

function isHedgeBookPickerActive(picker) {
  const field = picker.closest('.cno-field');
  return !(field && field.style.display === 'none');
}

// Selected books, or null when all / none are selected (= no filter)
function getHedgeBookPickerSelection() {
  const picker = getLowHoldHedgeBookPicker();
  if (!picker) return undefined;
  const checks = getPickerChecks(picker);
  const selected = checks.filter(c => c.checked).map(c => c.value);
  return (selected.length === 0 || selected.length === checks.length) ? null : selected;
}

function applyLowHoldHedgeBookPickerOnUpdate() {
  const picker = getLowHoldHedgeBookPicker();
  if (!picker) return;
  if (!isHedgeBookPickerActive(picker)) { setHedgeBookFilterList(null); return; }
  const checks = getPickerChecks(picker);
  const selected = checks.filter(c => c.checked).map(c => c.value);
  if (selected.length === 0 || selected.length === checks.length) setHedgeBookFilterList(null);
  else setHedgeBookFilterList(selected);
}

function createLowHoldHedgeBookPicker(elSportsbook) {
  if (!elSportsbook) return null;
  const books = Array.from(elSportsbook.options)
    .filter(o => o.value && o.value !== '0' && o.value !== '-1' && o.text.trim().toLowerCase() !== 'all')
    .map(o => o.text.replace(/\s+/g, ' ').trim());
  if (!books.length) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'cno-field';
  wrapper.style.cssText = 'margin-top: 6px; position: relative;';

  const label = document.createElement('label');
  label.textContent = 'Refine: Hedge Books';

  // Subtle "?" with an explanation on hover
  const help = document.createElement('span');
  help.textContent = '?';
  help.setAttribute('aria-label', 'About this filter');
  help.title = "This filter is applied by the extension, not by CNO. CNO still finds its usual results (up to your Result Count) for every hedge book. The extension then hides the rows whose hedge book isn't selected. So you may see fewer rows than your Result Count, and a matching bet that didn't make CNO's results won't appear. Use a large Result Count (e.g. 300) to make sure the books you want are in the results.";
  help.style.cssText = `
    display: inline-flex; align-items: center; justify-content: center;
    width: 12px; height: 12px; margin-left: 5px; vertical-align: middle;
    border: 1px solid #cbd5e1; border-radius: 50%;
    font-size: 0.6rem; font-weight: 700; line-height: 1; color: #94a3b8;
    cursor: help; user-select: none;
  `;
  label.appendChild(createRowsFilterHint());
  label.appendChild(help);
  wrapper.appendChild(label);

  const picker = document.createElement('div');
  picker.id = 'cno-lh-hedge-picker';
  picker.style.cssText = 'position: relative; width: 100%;';

  // Closed state: looks like a dropdown
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.style.cssText = `
    display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%;
    padding: 5px 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px;
    font-size: 0.82rem; color: #0f172a; cursor: pointer; text-align: left;
  `;
  const summaryText = document.createElement('span');
  summaryText.className = 'cno-lh-hedge-summary-text';
  summaryText.style.cssText = 'flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  const caret = document.createElement('span');
  caret.textContent = '▾';
  caret.style.cssText = 'flex: 0 0 auto; color: #64748b;';
  toggle.appendChild(summaryText);
  toggle.appendChild(caret);

  // Open state: quick actions + search + checkbox list
  const panel = document.createElement('div');
  panel.style.cssText = `
    display: none; position: fixed; z-index: 1000001;
    background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;
    box-shadow: 0 10px 24px rgba(15,23,42,0.16); overflow: hidden; min-width: 220px;
  `;

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 6px; padding: 7px 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;';
  const makeAction = (text, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.cssText = 'flex: 1; padding: 4px 6px; font-size: 0.75rem; font-weight: 700; color: #0369a1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;';
    b.addEventListener('mouseover', () => b.style.background = '#f0f9ff');
    b.addEventListener('mouseout', () => b.style.background = '#ffffff');
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    return b;
  };
  const visibleChecks = () => getPickerChecks(picker).filter(c => c.closest('label').style.display !== 'none');
  actions.appendChild(makeAction('Select all', () => { visibleChecks().forEach(c => c.checked = true); updateLowHoldHedgePickerSummary(picker); }));
  actions.appendChild(makeAction('Select none', () => { visibleChecks().forEach(c => c.checked = false); updateLowHoldHedgePickerSummary(picker); }));

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search sportsbooks…';
  search.style.cssText = 'display: block; width: calc(100% - 16px); margin: 7px 8px 4px; padding: 4px 7px; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;';
  search.dataset.hasEnterSubmit = 'true'; // Enter here shouldn't run Update
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    getPickerChecks(picker).forEach(c => {
      c.closest('label').style.display = !q || c.value.toLowerCase().includes(q) ? 'flex' : 'none';
    });
  });

  const list = document.createElement('div');
  list.style.cssText = 'max-height: 230px; overflow-y: auto; overscroll-behavior: contain; padding: 2px 4px 6px;'; // scrolling past the end doesn't scroll the page
  books.forEach(book => {
    const row = document.createElement('label');
    row.style.cssText = 'display: flex; align-items: center; gap: 7px; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 500; color: #0f172a; margin: 0;';
    row.addEventListener('mouseover', () => row.style.background = '#f0f9ff');
    row.addEventListener('mouseout', () => row.style.background = 'none');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'cno-lh-hedge-book-cb';
    cb.value = book;
    cb.checked = true; // default: all selected
    cb.style.cssText = 'width: 14px; height: 14px; margin: 0; accent-color: #0284c7; cursor: pointer; flex-shrink: 0;';
    cb.addEventListener('change', () => updateLowHoldHedgePickerSummary(picker));
    const span = document.createElement('span');
    span.textContent = book;
    row.appendChild(cb);
    row.appendChild(span);
    list.appendChild(row);
  });

  const hint = document.createElement('div');
  hint.textContent = 'Applies when you click Update. None selected = all.';
  hint.style.cssText = 'padding: 6px 10px; font-size: 0.7rem; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0;';

  panel.appendChild(actions);
  panel.appendChild(search);
  panel.appendChild(list);
  panel.appendChild(hint);
  picker.appendChild(toggle);
  picker.appendChild(panel);
  wrapper.appendChild(picker);

  // Fixed positioning so the filter panel's container can't clip the list
  const place = () => {
    const r = toggle.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}px`;
    const below = window.innerHeight - r.bottom;
    if (below < 300 && r.top > below) {
      panel.style.top = '';
      panel.style.bottom = `${window.innerHeight - r.top + 3}px`;
    } else {
      panel.style.bottom = '';
      panel.style.top = `${r.bottom + 3}px`;
    }
  };
  const open = () => { panel.style.display = 'block'; place(); search.value = ''; search.dispatchEvent(new Event('input')); search.focus(); };
  const close = () => { panel.style.display = 'none'; };
  window.addEventListener('scroll', (e) => { if (panel.style.display !== 'none' && !panel.contains(e.target)) close(); }, true);
  window.addEventListener('resize', close);
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (panel.style.display === 'none') open(); else close();
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => { if (!picker.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.style.display !== 'none') close(); });

  // Keep in step with a filter set from the table's hedge-sportsbook icon
  if (cnoHedgeBookFilter && cnoHedgeBookFilter.length) {
    const wanted = new Set(cnoHedgeBookFilter.map(b => b.toLowerCase()));
    getPickerChecks(picker).forEach(c => { c.checked = wanted.has(c.value.toLowerCase()); });
  } else if (!cnoHedgeSwapParamUsed) {
    // Arrived via Swap Page with a narrowed selection: pre-select it and filter the results
    cnoHedgeSwapParamUsed = true;
    let fromSwap = null;
    try { fromSwap = new URLSearchParams(window.location.search).get('cno_hedge_books'); } catch (e) { /* ignore */ }
    if (fromSwap) {
      const wanted = new Set(fromSwap.split('|').map(b => b.trim().toLowerCase()).filter(Boolean));
      getPickerChecks(picker).forEach(c => { c.checked = wanted.has(c.value.toLowerCase()); });
      setTimeout(() => {
        // Visibility (Profit Strategy = Hedge) is set right after the picker is built
        if (document.getElementById('cno-lh-hedge-picker') === picker && isHedgeBookPickerActive(picker)) {
          const sel = getHedgeBookPickerSelection();
          if (sel) setHedgeBookFilterList(sel);
        }
      }, 0);
    }
  }
  updateLowHoldHedgePickerSummary(picker);
  return wrapper;
}

// ====================================================
// "EXCLUDE PLAYER UNDERS" (Market Parameters)
// Hides rows whose Market contains "player" and whose Bet Name has the word "under" (with
// spaces around it) or the whole word "no". Remembered per page; applies right away and after
// every Update. The site's results aren't changed, only which rows are shown.
// ====================================================

// A choice made on the page wins; otherwise the "Exclude Player Unders by default" option
function isExcludePlayerUndersOn() {
  const byPage = (typeof userSettings !== 'undefined' && userSettings.excludePlayerUndersByPage) || {};
  const v = byPage[getSavedFiltersPageKey()];
  if (typeof v === 'boolean') return v;
  return !!(typeof userSettings !== 'undefined' && userSettings.excludePlayerUndersDefault);
}

// "Exclude Player Unders" with "Refine: Leagues" to its right
// "Excl. Player Unders" with "Refine: Leagues" to its right (always one line), and the MLB-only
// "Excl. Weather" line under them
function createUndersAndLeaguesRow() {
  const outer = document.createElement('div');
  const wrap = document.createElement('div');
  wrap.className = 'cno-unders-leagues-row';
  wrap.style.cssText = 'display:flex; align-items:flex-end; gap:12px; flex-wrap:nowrap;';
  const unders = createExcludePlayerUndersRow();
  unders.style.cssText += 'flex:0 0 auto; padding-bottom:6px; white-space:nowrap;';
  const leagues = createMultiLeagueRow();
  leagues.style.flex = '1 1 0';
  leagues.style.minWidth = '0';
  wrap.appendChild(unders);
  wrap.appendChild(leagues);
  outer.appendChild(wrap);
  outer.appendChild(createMlbWeatherRow());
  return outer;
}

function createExcludePlayerUndersRow() {
  const row = document.createElement('div');
  row.className = 'cno-row-inline';

  const label = document.createElement('label');
  label.className = 'cno-checkbox-group';
  label.title = 'Hides player-prop rows for Unders and "No" bets. This hides rows CNO already returned; it does not change what CNO searches, so use a large Result Count (e.g. 300) to still get a full list.';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'cno-exclude-player-unders-cb';
  cb.checked = isExcludePlayerUndersOn();
  cb.addEventListener('change', () => {
    const byPage = Object.assign({}, userSettings.excludePlayerUndersByPage || {});
    byPage[getSavedFiltersPageKey()] = cb.checked;
    cnoSetUserSetting('excludePlayerUndersByPage', byPage);
    processExcludePlayerUnders();
  });

  label.appendChild(cb);
  label.appendChild(document.createTextNode(' Excl. Player Unders'));
  label.appendChild(createRowsFilterHint());
  row.appendChild(label);
  return row;
}

function isPlayerUnderBet(betName) {
  const text = ` ${(betName || '').replace(/\s+/g, ' ').trim()} `;
  return /\sunder\s/i.test(text) || /\sno\s/i.test(text);
}

function processExcludePlayerUnders() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const cb = document.getElementById('cno-exclude-player-unders-cb');
  // The checkbox is the source of truth when it's on the page; otherwise use the saved choice
  const on = cb ? cb.checked : isExcludePlayerUndersOn();

  if (!table || !on || !isCnoListPage()) {
    document.querySelectorAll('.cno-under-hidden').forEach(el => el.classList.remove('cno-under-hidden'));
    return;
  }

  const cols = getListTableColumns(table);
  if (cols.market === -1 || cols.betName === -1) return;

  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    const marketCell = row.children[cols.market];
    const betCell = row.children[cols.betName];
    const hide = !!marketCell && !!betCell &&
      cnoCellText(marketCell).toLowerCase().includes('player') &&
      isPlayerUnderBet(cnoCellText(betCell));
    row.classList.toggle('cno-under-hidden', hide);
    const next = row.nextElementSibling;
    if (next && next.classList.contains('footable-row-detail')) next.classList.toggle('cno-under-hidden', hide);
  });
}

// ====================================================
// CNO "DEFAULTS" (Settings page) FOR CLEAR FILTERS
// CNO keeps these in cookies and fills them into its Settings page, so the extension reads them
// from that page (fetched in the background with the user's own cookies, like a normal visit)
// rather than from the cookies themselves: no extra permission, and always what CNO shows.
// Cached for 24 hours; visiting the Settings page drops the cache so changes are picked up.
// ====================================================

const CNO_SITE_DEFAULTS_KEY = 'cno_site_defaults_cache';
const CNO_SITE_DEFAULTS_TTL_MS = 24 * 60 * 60 * 1000;
const CNO_SETTINGS_PAGE_URL = '/site/account/settings.aspx';

// Settings page field -> what it means on the tool pages
function parseSiteDefaults(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const byId = (suffix) => d.querySelector(`[id$="${suffix}"]`);
  const selectVal = (suffix) => {
    const el = byId(suffix);
    if (!el) return undefined;
    const opt = el.querySelector('option[selected]') || el.querySelector('option');
    return opt ? opt.getAttribute('value') : undefined;
  };
  const textVal = (suffix) => { const el = byId(suffix); return el ? (el.getAttribute('value') || '') : undefined; };
  const checkVal = (suffix) => { const el = byId(suffix); return el ? el.hasAttribute('checked') : undefined; };

  // Mainlines Only: Not Specified / Yes / No (the checked radio's position)
  let mainlines;
  const radios = Array.from(d.querySelectorAll('input[type="radio"][id*="RadioButtonListIsMain"]'));
  if (radios.length) {
    const idx = radios.findIndex(r => r.hasAttribute('checked'));
    const label = idx >= 0 ? ((d.querySelector(`label[for="${radios[idx].id}"]`) || {}).textContent || '').trim().toLowerCase() : '';
    mainlines = label === 'yes' || (idx === 1 && !label);
  }

  return {
    DropDownListDevigMethod: selectVal('DropDownListDevigMethod'),
    DropDownListProfitStrategy: selectVal('DropDownListProfitStrategy'),
    DropDownListSortBy: selectVal('DropDownListSortBy'),
    TextBoxMinimumEVPercentage: textVal('TextBoxMinimumEVPercentage'),
    TextBoxMinimumLiquidity: textVal('TextBoxMinimumLiquidity'),
    TextBoxMinimumSubMarketSideCount: textVal('TextBoxMinimumSubMarketSideCount'),
    TextBoxMaximumSubMarketSideCount: textVal('TextBoxMaximumSubMarketSideCount'),
    CheckBoxRequireACompleteSportsbook: checkVal('CheckBoxRequireACompleteSportsbook'),
    TextBoxMinimumOddsProviderCount: textVal('TextBoxMinimumOddsProviderCount'),
    TextBoxKellyBankroll: textVal('TextBoxKellyBankroll'),
    TextBoxKellyMultiplier: textVal('TextBoxKellyMultiplier'),
    mainlines
  };
}

function getSiteDefaults(callback) {
  chrome.storage.local.get([CNO_SITE_DEFAULTS_KEY], (data) => {
    const cached = data && data[CNO_SITE_DEFAULTS_KEY];
    // (copies saved before the Kelly fields were read are refreshed)
    if (cached && cached.values && cached.values.TextBoxKellyMultiplier !== undefined && (Date.now() - (cached.ts || 0)) < CNO_SITE_DEFAULTS_TTL_MS) {
      callback(cached.values);
      return;
    }
    // Absolute URL: Firefox resolves a relative fetch() in a content script differently than Chrome
    fetch(new URL(CNO_SETTINGS_PAGE_URL, window.location.origin).href, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(html => {
        const values = parseSiteDefaults(html);
        if (!values.DropDownListDevigMethod && values.TextBoxMinimumOddsProviderCount === undefined) throw new Error('no defaults found');
        chrome.storage.local.set({ [CNO_SITE_DEFAULTS_KEY]: { ts: Date.now(), values } });
        callback(values);
      })
      .catch(err => {
        console.warn('CNO Helper: could not read CNO default settings', err);
        callback(cached && cached.values ? cached.values : null); // an old copy beats nothing
      });
  });
}

function applySiteDefaults(container = document) {
  getSiteDefaults((values) => {
    if (!values) return;
    const getEl = (suffix) => container.querySelector(`[id$="${suffix}"]`) || document.querySelector(`[id$="${suffix}"]`);

    ['DropDownListDevigMethod', 'DropDownListProfitStrategy', 'DropDownListSortBy'].forEach(suffix => {
      const el = getEl(suffix);
      const v = values[suffix];
      if (!el || v === undefined || v === null) return;
      if (Array.from(el.options).some(o => o.value === v) && el.value !== v) {
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true })); // e.g. Profit Strategy shows/hides the hedge options
      }
    });

    ['TextBoxMinimumEVPercentage', 'TextBoxMinimumLiquidity', 'TextBoxMinimumSubMarketSideCount',
     'TextBoxMaximumSubMarketSideCount', 'TextBoxMinimumOddsProviderCount'].forEach(suffix => {
      const el = getEl(suffix);
      const v = values[suffix];
      if (!el || v === undefined) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const req = getEl('CheckBoxRequireACompleteSportsbook');
    if (req && typeof values.CheckBoxRequireACompleteSportsbook === 'boolean' && req.checked !== values.CheckBoxRequireACompleteSportsbook) {
      req.checked = values.CheckBoxRequireACompleteSportsbook;
      req.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Mainlines Only: checked only when the default is "Yes" ("Not Specified" / "No" leave it unchecked)
    const main = getEl('CheckBoxIsMain');
    if (main && typeof values.mainlines === 'boolean' && main.checked !== values.mainlines) {
      main.checked = values.mainlines;
      main.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

// On CNO's Settings page, forget the cached defaults so the next Clear Filters reads fresh ones
if (/\/site\/account\/settings\.aspx/i.test(window.location.pathname)) {
  try { chrome.storage.local.remove(CNO_SITE_DEFAULTS_KEY); } catch (e) { /* ignore */ }
  document.addEventListener('submit', () => { try { chrome.storage.local.remove(CNO_SITE_DEFAULTS_KEY); } catch (e) { /* ignore */ } }, true);
}

// ----------------------------------------------------
// Saved filters vs. CNO defaults
// ----------------------------------------------------

const CNO_DEFAULT_SELECT_FIELDS = ['DropDownListDevigMethod', 'DropDownListProfitStrategy', 'DropDownListSortBy'];
const CNO_DEFAULT_TEXT_FIELDS = ['TextBoxMinimumEVPercentage', 'TextBoxMinimumLiquidity', 'TextBoxMinimumSubMarketSideCount',
  'TextBoxMaximumSubMarketSideCount', 'TextBoxMinimumOddsProviderCount'];

const cnoNormText = (v) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, '').toLowerCase();

// Remove the fields whose value equals the user's default (and mark the filter as such)
function stripDefaultSelections(sel, defaults) {
  sel.omitsDefaults = true;
  CNO_DEFAULT_SELECT_FIELDS.forEach(f => {
    if (sel.selects && sel.selects[f] && defaults[f] !== undefined && sel.selects[f].value === defaults[f]) delete sel.selects[f];
  });
  CNO_DEFAULT_TEXT_FIELDS.forEach(f => {
    if (sel.texts && sel.texts[f] !== undefined && defaults[f] !== undefined && cnoNormText(sel.texts[f]) === cnoNormText(defaults[f])) delete sel.texts[f];
  });
  if (sel.checks) {
    if (sel.checks.requireComplete !== undefined && typeof defaults.CheckBoxRequireACompleteSportsbook === 'boolean' &&
        sel.checks.requireComplete === defaults.CheckBoxRequireACompleteSportsbook) delete sel.checks.requireComplete;
    if (sel.checks.main !== undefined && typeof defaults.mainlines === 'boolean' && sel.checks.main === defaults.mainlines) delete sel.checks.main;
  }
  return sel;
}

// Put the default value back for every default field the filter doesn't carry
function fillDefaultSelections(sel, defaults) {
  const out = JSON.parse(JSON.stringify(sel));
  out.selects = out.selects || {};
  out.texts = out.texts || {};
  out.checks = out.checks || {};
  CNO_DEFAULT_SELECT_FIELDS.forEach(f => {
    if (!out.selects[f] && defaults[f] !== undefined && defaults[f] !== null) out.selects[f] = { value: defaults[f], text: '' };
  });
  CNO_DEFAULT_TEXT_FIELDS.forEach(f => {
    if (out.texts[f] === undefined && defaults[f] !== undefined) out.texts[f] = defaults[f];
  });
  if (out.checks.requireComplete === undefined && typeof defaults.CheckBoxRequireACompleteSportsbook === 'boolean') out.checks.requireComplete = defaults.CheckBoxRequireACompleteSportsbook;
  if (out.checks.main === undefined && typeof defaults.mainlines === 'boolean') out.checks.main = defaults.mainlines;
  return out;
}

// Small light-grey "funnel over rows" mark next to filters that hide rows from the results
// instead of running a new search (Exclude injured, Exclude Player Unders, Hedge Sportsbook Filter)
function createRowsFilterHint() {
  const mark = document.createElement('span');
  mark.className = 'cno-rows-filter-hint';
  mark.title = "Hides rows from the current results (doesn't search CNO)";
  mark.innerHTML = ROWS_FILTER_ICON_SVG.replace('width="15" height="15"', 'width="11" height="11"');
  mark.style.cssText = 'display:inline-flex; align-items:center; margin-left:-2px; color:#94a3b8; vertical-align:middle; flex-shrink:0;'; // tucked right up against the label (the labels' own gap adds space otherwise)
  return mark;
}

// ====================================================
// RESULTS TABLES ON THE TOOL PAGES: MODERNIZED LOOK ("Restyle Results Tables" option)
// Column roles come from the header text, so they follow whatever columns the page shows
// (and Profit Strategy adding/removing hedge columns). Re-applied after every update.
// - Price columns: odds centered, "$liquidity · price¢" small underneath (amber under the
//   threshold set on game pages); narrow, with the header wrapping to two lines
// - Date: the day on the first line, the time smaller underneath
// - Books / EV Hit%: a little quieter; the metric (EV%/HV%/ROI%) stronger and middle-aligned
// - Headers bottom-aligned, cells top-aligned
// - "FV Devig ↗" tab that appears under the Calc button on hover (the button itself is left
//   where the site put it: its click handler finds the row from the button's position)
// ====================================================

function isMainTableModern() {
  return isCnoListPage() && typeof userSettings !== 'undefined' && userSettings.modernizeMainTables !== false;
}

function getMainTableRoles(table) {
  const ths = Array.from(table.querySelectorAll('thead th'));
  return ths.map(th => {
    const h = th.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    if (h === 'calc') return 'calc';
    if (h === 'date') return 'date';
    if (h === 'sport') return 'sport';
    if (h === 'league') return 'league';
    if (h === 'books' || h === 'ev hit%') return 'muted';
    if (h.endsWith('%')) return 'metric';
    if (h === 'odds' || h.endsWith(' odds')) return 'price';
    if (h === 'bet' || h.endsWith(' name')) return 'name';
    return '';
  });
}

const MAIN_ROLE_CLASSES = ['lh-calc', 'lh-date', 'lh-sport-col', 'lh-league', 'lh-muted', 'lh-metric', 'lh-price', 'lh-betname'];
const MAIN_ROLE_TO_CLASS = { calc: 'lh-calc', date: 'lh-date', sport: 'lh-sport-col', league: 'lh-league', muted: 'lh-muted', metric: 'lh-metric', price: 'lh-price', name: 'lh-betname' };

function setMainTableRestyle(on) {
  if (typeof userSettings !== 'undefined') userSettings.modernizeMainTables = on;
  try { chrome.storage.local.set({ modernizeMainTables: on }); } catch (e) { /* ignore */ }
  processMainTableModern();
}

// Classic / enhanced switch, at the right end of the line just above the table
function ensureMainTableSwitch(table, modern) {
  let btn = document.getElementById('cno-main-table-switch');
  const label = modern ? 'Show classic table' : 'Show enhanced table';
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cno-main-table-switch';
    btn.className = 'cno-gt-switch';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMainTableRestyle(!(typeof userSettings !== 'undefined' && userSettings.modernizeMainTables !== false));
    });
  }
  cnoSetIconLabel(btn, modern ? 'classic' : 'enhanced', label);
  btn.title = modern
    ? 'Show the table the way CNO draws it (same as turning off "Restyle Results Tables" in the options)'
    : 'Turn the restyled table back on (same as "Restyle Results Tables" in the options)';

  // Lives on the injury-status line (which always reserves its space above the table)
  const banner = document.getElementById('cno-injury-refresh-banner');
  if (banner) {
    if (btn.parentNode !== banner || banner.lastElementChild !== btn) {
      btn.style.marginLeft = '12px';
      banner.appendChild(btn);
    }
  } else if (btn.nextElementSibling !== table) {
    btn.style.marginLeft = '';
    table.parentNode.insertBefore(btn, table);
  }
}

// "Tomorrow at 1:00 PM" -> day line + smaller time line (the original text is kept to put back)
function splitDateCell(td) {
  const el = td.querySelector('datetime') || td;
  if (el.dataset.lhRendered !== undefined && el.textContent === el.dataset.lhRendered) return;
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const m = text.match(/^(.*?)\s+at\s+(.+)$/i);
  if (!m) return;
  el.dataset.lhOrig = el.textContent;
  el.textContent = '';
  const day = document.createElement('span');
  day.className = 'lh-day';
  day.textContent = m[1];
  const time = document.createElement('span');
  time.className = 'lh-time';
  time.textContent = m[2];
  el.appendChild(day);
  el.appendChild(time);
  el.dataset.lhRendered = el.textContent;
}

function restoreDateCells(table) {
  table.querySelectorAll('[data-lh-orig]').forEach(el => {
    if (el.dataset.lhRendered !== undefined && el.textContent === el.dataset.lhRendered) el.textContent = el.dataset.lhOrig;
    delete el.dataset.lhOrig;
    delete el.dataset.lhRendered;
  });
}

function restoreMainTable(table) {
  table.classList.remove('lh-main');
  table.style.removeProperty('--lh-row-pad');
  if (typeof restoreSplitCells === 'function') restoreSplitCells(table);
  restoreDateCells(table);
  table.querySelectorAll('.cno-fv-pop').forEach(el => el.remove());
  table.querySelectorAll('.lh-has-fv').forEach(el => el.classList.remove('lh-has-fv'));
  table.querySelectorAll('.lh-has-sub').forEach(el => el.classList.remove('lh-has-sub'));
  table.querySelectorAll('.lh-center').forEach(el => el.classList.remove('lh-center'));
  table.querySelectorAll('th[data-lh-abbr]').forEach(th => { th.removeAttribute('data-lh-abbr'); th.removeAttribute('title'); });
  table.querySelectorAll('[data-lh-sport]').forEach(el => el.removeAttribute('data-lh-sport'));
  table.classList.remove('lh-has-league');
  table.querySelectorAll(MAIN_ROLE_CLASSES.map(c => '.' + c).join(',')).forEach(el => el.classList.remove(...MAIN_ROLE_CLASSES));
}

function processMainTableModern() {
  if (!isCnoListPage()) return;
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table) return;
  const modern = isMainTableModern();
  ensureMainTableSwitch(table, modern);

  if (!modern) {
    if (table.classList.contains('lh-main')) restoreMainTable(table);
    return;
  }

  if (typeof loadGameTablePrefs === 'function') loadGameTablePrefs(); // liquidity threshold
  table.classList.add('lh-main');
  const pad = { compact: '5px', standard: '7px', spacious: '10px' }[userSettings.mainTableDensity] || '7px';
  if (table.style.getPropertyValue('--lh-row-pad') !== pad) table.style.setProperty('--lh-row-pad', pad);

  const roles = getMainTableRoles(table);
  const sportIdx = roles.indexOf('sport');
  const leagueIdx = roles.indexOf('league');
  const threshold = typeof cnoGameLiqThreshold === 'number' ? cnoGameLiqThreshold : 100;

  const fairIdx = Array.from(table.querySelectorAll('thead th')).findIndex(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'fair odds');
  Array.from(table.querySelectorAll('thead th')).forEach((th, i) => {
    MAIN_ROLE_CLASSES.forEach(c => th.classList.toggle(c, MAIN_ROLE_TO_CLASS[roles[i]] === c));
    th.classList.toggle('lh-fair', i === fairIdx);
  });

  // Shorter price headers on tables with hedge bets (display only: the header's real text is kept,
  // since other features look columns up by it)
  const headTexts = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  const hasHedge = headTexts.some(h => h.startsWith('hedge'));
  const ABBR = { 'low hold odds': 'L.H. Odds', 'hedge bet odds': 'H.B. Odds', 'promo bet odds': 'P.B. Odds' };
  Array.from(table.querySelectorAll('thead th')).forEach((th, i) => {
    const abbr = hasHedge ? ABBR[headTexts[i]] : null;
    if (abbr) {
      if (!th.style.getPropertyValue('--lh-th-fs')) th.style.setProperty('--lh-th-fs', getComputedStyle(th).fontSize);
      if (th.getAttribute('data-lh-abbr') !== abbr) th.setAttribute('data-lh-abbr', abbr);
      th.title = th.textContent.trim();
    } else if (th.hasAttribute('data-lh-abbr')) {
      th.removeAttribute('data-lh-abbr');
      th.removeAttribute('title');
    }
  });

  // EV% / HV% / ROI% (metrics) and EV Hit%: centered
  const centerCols = new Set();
  Array.from(table.querySelectorAll('thead th')).forEach((th, i) => {
    const h = th.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    const center = roles[i] === 'metric' || h === 'ev hit%';
    th.classList.toggle('lh-center', center);
    if (center) centerCols.add(i);
  });
  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    Array.from(row.children).forEach((td, i) => td.classList.toggle('lh-center', centerCols.has(i)));
  });

  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    if (row.children.length < 2) return;
    Array.from(row.children).forEach((td, i) => {
      const role = roles[i];
      MAIN_ROLE_CLASSES.forEach(c => td.classList.toggle(c, MAIN_ROLE_TO_CLASS[role] === c));
      if (role === 'price' && typeof splitExchangeCell === 'function') {
        splitExchangeCell(td);
        const sub = td.querySelector('.lh-sub');
        if (sub) sub.classList.toggle('lh-low', Number(sub.dataset.liq) < threshold);
        td.classList.toggle('lh-has-sub', !!sub);
      } else if (role === 'date') {
        splitDateCell(td);
      } else if (role === 'calc') {
        updateFvDevigPop(td);
      }
    });
    // Sport shown as a small line above the League (via CSS, so the League cell's text is unchanged)
    if (sportIdx !== -1 && leagueIdx !== -1) {
      const sportCell = row.children[sportIdx];
      const leagueCell = row.children[leagueIdx];
      const sport = sportCell ? getCleanCellText(sportCell) : '';
      if (leagueCell && leagueCell.getAttribute('data-lh-sport') !== sport) leagueCell.setAttribute('data-lh-sport', sport);
    }
  });
  table.classList.toggle('lh-has-league', sportIdx !== -1 && leagueIdx !== -1);

  table.dataset.lhMainDone = 'true';
}

// "FV Devig ↗" (and "Sharp FV") to the right of the Calc button, shown while the Calc cell is
// hovered. It's a separate element in the same cell (absolutely positioned, so it doesn't change
// the row's height).
function updateFvDevigPop(td) {
  const btn = td.querySelector('input[type="button"][value="Calc"]');
  const url = btn && typeof getCalcRowDeviggerUrl === 'function' ? getCalcRowDeviggerUrl(btn) : null;
  let pop = td.querySelector('.cno-fv-pop');
  if (!url) {
    if (pop) pop.remove();
    td.classList.remove('lh-has-fv');
    return;
  }
  if (!pop) {
    pop = document.createElement('div');
    pop.className = 'cno-fv-pop';
    const link = document.createElement('a');
    link.className = 'cno-fv-link';
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = 'Open this bet in the Devigger using the listed Fair Odds';
    link.innerHTML = 'FV Devig <span aria-hidden="true">↗</span>';
    pop.appendChild(link);
    td.appendChild(pop);
  }
  const link = pop.querySelector('a.cno-fv-link');
  if (link.getAttribute('href') !== url) link.setAttribute('href', url);
  td.classList.add('lh-has-fv');
}

// Line the pop up under the button when the cell is hovered
document.addEventListener('mouseover', (e) => {
  const td = e.target && e.target.closest ? e.target.closest('td.lh-calc.lh-has-fv') : null;
  if (!td) return;
  // Moving around inside the same cell: already set up for this hover
  if (e.relatedTarget && td.contains(e.relatedTarget)) return;
  const btn = td.querySelector('input[type="button"][value="Calc"]');
  const pop = td.querySelector('.cno-fv-pop');
  if (!btn || !pop) return;
  cnoSyncSharpLink(td, btn, pop);
  // To the right of Calc, level with it (it covers the Date cell only while hovered)
  pop.style.left = `${btn.offsetLeft + btn.offsetWidth + 3}px`;
  pop.style.top = `${btn.offsetTop + btn.offsetHeight / 2}px`;
  pop.style.setProperty('--lh-calc-h', `${btn.offsetHeight}px`);
  pop.style.removeProperty('min-width');
});

// Restyle a freshly drawn results table before the browser paints it (no flash of the old look)
if (isCnoListPage()) {
  new MutationObserver(() => {
    if (typeof userSettingsLoaded !== 'undefined' && !userSettingsLoaded) return;
    const t = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
    if (!t || t.dataset.lhMainDone || !isMainTableModern()) return;
    try { processMainTableModern(); } catch (e) { console.warn('CNO Helper: results table restyle error', e); }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

// CNO's Calc popup copies the row's text (date, odds, fair odds...) from the table when Calc is
// clicked. Just before that, put this row's restyled cells back to the site's original text, then
// restyle them again right after, so the popup gets exactly what it expects.
document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('input[type="button"][value="Calc"]') : null;
  if (!btn) return;
  const table = btn.closest('#ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1.lh-main');
  const row = btn.closest('tr');
  if (!table || !row) return;
  if (typeof restoreSplitCells === 'function') restoreSplitCells(row);
  restoreDateCells(row);
  setTimeout(() => { try { processMainTableModern(); } catch (err) { /* ignore */ } }, 0);
}, true);

// 0.2197 -> "+355", 0.75 -> "-300"
function cnoProbabilityToAmerican(p) {
  if (!isFinite(p) || p <= 0 || p >= 1) return null;
  const dec = 1 / p;
  const american = dec >= 2 ? Math.round((dec - 1) * 100) : -Math.round(100 / (dec - 1));
  return american > 0 ? `+${american}` : String(american);
}

// Adds a surge amount to American odds, stepping across the gap between -100 and +100
// (there are no odds in between): -110 + 20 = +110, -120 + 15 = -105, +150 + 25 = +175.
function cnoAddToAmericanOdds(odds, add) {
  const a = parseInt(String(odds).replace('+', ''), 10);
  if (isNaN(a) || !isFinite(add) || add === 0) return null;
  const x = a >= 100 ? a - 100 : a + 100;   // continuous scale: -110 -> -10, +110 -> +10
  const y = x + add;
  const result = y >= 0 ? Math.round(y + 100) : Math.round(y - 100);
  return result > 0 ? `+${result}` : String(result);
}

// ====================================================
// ODDS BOOST: DEFAULT BOOST AMOUNT ("Set as default | Clear" next to Boost Amount)
// Saves the current boost type + amount. On page load (and after Clear Filters) an empty boost
// box gets the default; a value already there (Swap Page, saved filter) is left alone.
// ====================================================

const CNO_BOOST_DEFAULT_KEY = 'cno_default_boost';
let cnoBoostDefault = null;
let cnoBoostDefaultLoaded = false;
let cnoBoostDefaultAppliedOnLoad = false;

if (window.location.pathname.toLowerCase().includes('odds-boost.aspx')) {
  try {
    chrome.storage.local.get([CNO_BOOST_DEFAULT_KEY], (d) => {
      cnoBoostDefault = (d && d[CNO_BOOST_DEFAULT_KEY]) || null;
      cnoBoostDefaultLoaded = true;
      updateBoostDefaultLinks();
    });
  } catch (e) { cnoBoostDefaultLoaded = true; }
}

function getBoostInputs() {
  const pctSpan = document.getElementById('spanBoostPercentage');
  const oddsSpan = document.getElementById('spanBoostOdds');
  return {
    pct: pctSpan ? pctSpan.querySelector('input[type="text"]') : null,
    odds: oddsSpan ? oddsSpan.querySelector('input[type="text"]') : null
  };
}

function createBoostDefaultLinks() {
  const wrap = document.createElement('span');
  wrap.id = 'cno-boost-default-links';
  wrap.style.cssText = 'margin-left: 8px; font-size: 0.72rem !important; font-weight: 500 !important; color: #94a3b8 !important; text-transform: none; letter-spacing: 0;';

  const mk = (text, title, onClick) => {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = text;
    a.title = title;
    a.tabIndex = -1;
    a.style.cssText = 'color: #64748b !important; text-decoration: none; font-weight: 500 !important;';
    a.addEventListener('mouseover', () => { a.style.textDecoration = 'underline'; });
    a.addEventListener('mouseout', () => { a.style.textDecoration = 'none'; });
    a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    return a;
  };

  const setLink = mk('Set as default', 'Use the current boost type and amount whenever this page opens', () => {
    const typeEl = document.querySelector('input[name$="RadioButtonListOddsBoostType"]:checked');
    const { pct, odds } = getBoostInputs();
    const value = {
      type: typeEl ? typeEl.value : 'profit',
      pct: pct ? pct.value.trim() : '',
      odds: odds ? odds.value.trim() : ''
    };
    if (!value.pct && !value.odds) {
      showSavedFilterToast('Enter a boost amount first.');
      return;
    }
    cnoBoostDefault = value;
    chrome.storage.local.set({ [CNO_BOOST_DEFAULT_KEY]: value }, () => {
      showSavedFilterToast(`Default boost saved: ${value.type === 'surge' ? value.odds : value.pct + '%'}`.replace('%%', '%'));
      updateBoostDefaultLinks();
    });
  });
  const sep = document.createElement('span');
  sep.textContent = ' | ';
  sep.style.cssText = 'color: #cbd5e1 !important;';
  const clearLink = mk('Clear', 'Stop filling in a default boost', () => {
    cnoBoostDefault = null;
    chrome.storage.local.remove(CNO_BOOST_DEFAULT_KEY, () => {
      showSavedFilterToast('Default boost cleared.');
      updateBoostDefaultLinks();
    });
  });
  clearLink.className = 'cno-boost-default-clear';

  wrap.appendChild(setLink);
  wrap.appendChild(sep);
  wrap.appendChild(clearLink);
  return wrap;
}

function updateBoostDefaultLinks() {
  const clearLink = document.querySelector('#cno-boost-default-links .cno-boost-default-clear');
  if (!clearLink) return;
  const has = !!cnoBoostDefault;
  clearLink.style.opacity = has ? '1' : '0.45';
  clearLink.style.pointerEvents = has ? 'auto' : 'none';
  const label = clearLink.closest('label');
  if (label) label.title = has ? `Default boost: ${cnoBoostDefault.type === 'surge' ? cnoBoostDefault.odds : cnoBoostDefault.pct}` : '';
}

// Fill an empty boost box with the default. force: after Clear Filters (boxes were just emptied)
function applyBoostDefault(force = false) {
  if (!cnoBoostDefault) return;
  const { pct, odds } = getBoostInputs();
  if (!pct && !odds) return;
  if (!force && ((pct && pct.value.trim()) || (odds && odds.value.trim()))) return; // something's already there

  const radio = document.querySelector(`input[name$="RadioButtonListOddsBoostType"][value="${cnoBoostDefault.type}"]`);
  if (radio && !radio.checked) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (pct && cnoBoostDefault.pct !== undefined) pct.value = cnoBoostDefault.pct;
  if (odds && cnoBoostDefault.odds !== undefined) odds.value = cnoBoostDefault.odds;
  syncBoostUIState(getFilterAccordionContainer() || document);
}

// Once per page load, after the filter panel is ready (and after any saved-filter apply)
function processBoostDefaultOnLoad() {
  if (cnoBoostDefaultAppliedOnLoad || !cnoBoostDefaultLoaded) return;
  if (!window.location.pathname.toLowerCase().includes('odds-boost.aspx')) { cnoBoostDefaultAppliedOnLoad = true; return; }
  const container = getFilterAccordionContainer();
  if (container && !container.classList.contains('cno-ready')) return;
  try { if (sessionStorage.getItem(PENDING_FILTER_APPLY_KEY)) return; } catch (e) { /* ignore */ }
  cnoBoostDefaultAppliedOnLoad = true;
  applyBoostDefault(false);
  updateBoostDefaultLinks();
}

// ====================================================
// MULTI-LEAGUE FILTER (Market Parameters)
// Pick several leagues; rows from other leagues are hidden (CNO's results aren't changed).
// Only usable when League is "All". The choices are the League dropdown's leagues, limited to the
// selected Sport when there is one. Cleared by Clear Filters; saved with saved filters.
// ====================================================

let cnoMultiLeagueSelection = null; // null = all leagues (no filter), else an array of league names

const CNO_LEAGUE_SPORT = {
  NBA: 'basketball', NCAAB: 'basketball', NCAAW: 'basketball', WNBA: 'basketball',
  NFL: 'football', NCAAF: 'football',
  MLB: 'baseball',
  NHL: 'hockey'
};
function cnoLeagueSport(league) {
  return CNO_LEAGUE_SPORT[league.toUpperCase()] || 'soccer'; // the remaining leagues on CNO are soccer
}

function getLeagueDropdown() { return document.querySelector('[id$="DropDownListLeague"]'); }
function getSportDropdown() { return document.querySelector('[id$="DropDownListSport"]'); }

function isAllValue(el) {
  if (!el) return true;
  const v = (el.value || '').toLowerCase();
  return !v || v === 'all' || v === '-1' || v === '0';
}

function getMultiLeagueChoices() {
  const leagueEl = getLeagueDropdown();
  if (!leagueEl) return [];
  const sportEl = getSportDropdown();
  const sport = !isAllValue(sportEl) ? (sportEl.options[sportEl.selectedIndex].text || '').trim().toLowerCase() : '';
  return Array.from(leagueEl.options)
    .filter(o => !isAllValue({ value: o.value }) && o.text.trim().toLowerCase() !== 'all')
    .map(o => o.text.replace(/\s+/g, ' ').trim())
    .filter(name => !sport || cnoLeagueSport(name) === sport);
}

function setMultiLeagueSelection(list) {
  cnoMultiLeagueSelection = (list && list.length) ? list.slice() : null;
  syncMultiLeaguePicker();
  processMultiLeagueFilter();
}

function createMultiLeagueRow() {
  const row = document.createElement('div');
  row.className = 'cno-field';
  row.id = 'cno-multi-league';
  row.style.cssText = 'margin-top: 4px; position: relative;';

  const label = document.createElement('label');
  label.textContent = 'Refine: Leagues';
  label.title = 'Shows only the leagues you pick. This hides rows CNO already returned; it does not change what CNO searches, so use a large Result Count (e.g. 300) to make sure the leagues you want are in the results. Set League to "All" to use it.';
  const leaguesHint = createRowsFilterHint();
  leaguesHint.style.marginLeft = '4px'; // the shared hint sits tight against checkbox labels; give it room after text
  label.appendChild(leaguesHint);
  row.appendChild(label);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cno-ml-toggle';
  toggle.style.cssText = `
    display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%;
    padding: 5px 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px;
    font-size: 0.82rem; color: #0f172a; cursor: pointer; text-align: left;
  `;
  toggle.innerHTML = '<span class="cno-ml-summary" style="flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></span><span style="color:#64748b;">▾</span>';

  // Clear: back to all leagues (same look as the text boxes' clear buttons)
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'cno-ml-clear';
  clearBtn.tabIndex = -1;
  clearBtn.title = 'Clear: show all leagues';
  clearBtn.innerHTML = ERASER_SVG_ICON;
  clearBtn.style.cssText = `
    background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; width: 34px; padding: 0;
    cursor: pointer; color: #475569; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; align-self: stretch; transition: background-color 0.15s, color 0.15s;
  `;
  clearBtn.addEventListener('mouseover', () => { if (!clearBtn.disabled) { clearBtn.style.background = '#e2e8f0'; clearBtn.style.color = '#0f172a'; } });
  clearBtn.addEventListener('mouseout', () => { clearBtn.style.background = '#f1f5f9'; clearBtn.style.color = '#475569'; });
  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMultiLeagueSelection(null);
  });

  const toggleRow = document.createElement('div');
  toggleRow.style.cssText = 'display:flex; align-items:stretch; gap:4px; width:100%;';
  toggle.style.flex = '1 1 auto';
  toggle.style.minWidth = '0';
  toggleRow.appendChild(toggle);
  toggleRow.appendChild(clearBtn);
  row.appendChild(toggleRow);

  const panel = document.createElement('div');
  panel.className = 'cno-ml-panel';
  panel.style.cssText = `
    display: none; position: fixed; z-index: 1000001;
    background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;
    box-shadow: 0 10px 24px rgba(15,23,42,0.16); overflow: hidden; min-width: 200px;
  `;
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex; gap:6px; padding:7px 8px; background:#f8fafc; border-bottom:1px solid #e2e8f0;';
  const mkAction = (text, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.cssText = 'flex:1; padding:4px 6px; font-size:0.75rem; font-weight:700; color:#0369a1; background:#ffffff; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;';
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    return b;
  };
  actions.appendChild(mkAction('Select all', () => setMultiLeagueSelection(null)));
  actions.appendChild(mkAction('Select none', () => { cnoMultiLeagueSelection = []; syncMultiLeaguePicker(); processMultiLeagueFilter(); }));
  const list = document.createElement('div');
  list.className = 'cno-ml-list';
  list.style.cssText = 'max-height: 240px; overflow-y: auto; overscroll-behavior: contain; padding: 4px;'; // scrolling past the end doesn't scroll the page
  const hint = document.createElement('div');
  hint.textContent = 'Applies right away. None selected = all leagues.';
  hint.style.cssText = 'padding:6px 10px; font-size:0.7rem; color:#64748b; background:#f8fafc; border-top:1px solid #e2e8f0;';
  panel.appendChild(actions);
  panel.appendChild(list);
  panel.appendChild(hint);
  row.appendChild(panel);

  const place = () => {
    const r = toggle.getBoundingClientRect();
    const width = Math.max(r.width, 200);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}px`;
    const below = window.innerHeight - r.bottom;
    if (below < 300 && r.top > below) { panel.style.top = ''; panel.style.bottom = `${window.innerHeight - r.top + 3}px`; }
    else { panel.style.bottom = ''; panel.style.top = `${r.bottom + 3}px`; }
  };
  const close = () => { panel.style.display = 'none'; };
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggle.disabled) return;
    if (panel.style.display === 'none') { buildMultiLeagueList(); panel.style.display = 'block'; place(); }
    else close();
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  panel.addEventListener('wheel', (e) => { if (!e.target.closest('.cno-ml-list')) e.preventDefault(); }, { passive: false });
  document.addEventListener('click', (e) => { if (!row.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', (e) => { if (panel.style.display !== 'none' && !panel.contains(e.target)) close(); }, true);

  setTimeout(syncMultiLeaguePicker, 0);
  return row;
}

function buildMultiLeagueList() {
  const list = document.querySelector('#cno-multi-league .cno-ml-list');
  if (!list) return;
  list.innerHTML = '';
  const chosen = cnoMultiLeagueSelection ? new Set(cnoMultiLeagueSelection.map(x => x.toLowerCase())) : null;
  getMultiLeagueChoices().forEach(name => {
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display:flex; align-items:center; gap:7px; padding:4px 6px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:500; color:#0f172a; margin:0;';
    lbl.addEventListener('mouseover', () => lbl.style.background = '#f0f9ff');
    lbl.addEventListener('mouseout', () => lbl.style.background = 'none');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = name;
    cb.checked = !chosen || chosen.has(name.toLowerCase());
    cb.style.cssText = 'width:14px; height:14px; margin:0; accent-color:#0284c7; cursor:pointer;';
    cb.addEventListener('change', () => {
      const all = Array.from(list.querySelectorAll('input[type="checkbox"]'));
      const picked = all.filter(c => c.checked).map(c => c.value);
      cnoMultiLeagueSelection = picked.length === all.length ? null : picked;
      syncMultiLeaguePicker(false);
      processMultiLeagueFilter();
    });
    const span = document.createElement('span');
    span.textContent = name;
    lbl.appendChild(cb);
    lbl.appendChild(span);
    list.appendChild(lbl);
  });
}

function syncMultiLeaguePicker(rebuildList = true) {
  const row = document.getElementById('cno-multi-league');
  if (!row) return;
  const toggle = row.querySelector('.cno-ml-toggle');
  const summary = row.querySelector('.cno-ml-summary');
  const enabled = isAllValue(getLeagueDropdown());
  toggle.disabled = !enabled;
  row.style.opacity = enabled ? '1' : '0.5';
  toggle.style.cursor = enabled ? 'pointer' : 'not-allowed';
  toggle.title = enabled ? '' : 'Set League to "All" to pick several leagues';
  const sel = cnoMultiLeagueSelection;
  const clearBtn = row.querySelector('.cno-ml-clear');
  if (clearBtn) {
    const canClear = enabled && !!sel;
    clearBtn.disabled = !canClear;
    clearBtn.style.opacity = canClear ? '1' : '0.45';
    clearBtn.style.cursor = canClear ? 'pointer' : 'default';
  }
  const text = !sel ? 'All leagues' : sel.length === 0 ? 'None selected (shows all)' : sel.length <= 3 ? sel.join(', ') : `${sel.length} leagues`;
  if (summary.textContent !== text) summary.textContent = text;
  const panel = row.querySelector('.cno-ml-panel');
  if (rebuildList && panel && panel.style.display !== 'none') buildMultiLeagueList();
}

function processMultiLeagueFilter() {
  syncMultiLeaguePicker(false);
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const active = !!(table && isCnoListPage() && cnoMultiLeagueSelection && cnoMultiLeagueSelection.length &&
    document.getElementById('cno-multi-league') && isAllValue(getLeagueDropdown()));
  if (!active) {
    document.querySelectorAll('.cno-league-hidden').forEach(el => el.classList.remove('cno-league-hidden'));
    return;
  }
  const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  const leagueIdx = heads.indexOf('league');
  if (leagueIdx === -1) return;
  const keep = new Set(cnoMultiLeagueSelection.map(x => x.toLowerCase()));
  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    const cell = row.children[leagueIdx];
    if (!cell) return;
    const hide = !keep.has(cnoCellText(cell).toLowerCase());
    row.classList.toggle('cno-league-hidden', hide);
    const next = row.nextElementSibling;
    if (next && next.classList.contains('footable-row-detail')) next.classList.toggle('cno-league-hidden', hide);
  });
}

// ====================================================
// "N ROWS HIDDEN" NOTE above the table, for every filter that hides rows
// ====================================================

function processHiddenRowsNote() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const banner = document.getElementById('cno-injury-refresh-banner');
  let note = document.getElementById('cno-injured-hidden-note');
  if (!table || !banner) { if (note) note.remove(); return; }

  const rows = Array.from(table.querySelectorAll('tbody tr:not(.footable-row-detail)'));
  const reasons = [
    ['cno-injured-hidden', 'injured players', !!(document.getElementById('cno-exclude-injured-cb') || {}).checked],
    ['cno-under-hidden', 'player unders', !!(document.getElementById('cno-exclude-player-unders-cb') || {}).checked],
    ['cno-league-hidden', 'other leagues', !!(cnoMultiLeagueSelection && cnoMultiLeagueSelection.length)],
    ['cno-weather-hidden', 'rainout risk', cnoMlbWeatherFilter !== 'all'],
  ];
  const parts = [];
  let total = 0;
  const counted = new Set();
  reasons.forEach(([cls, label, on]) => {
    if (!on) return;
    const n = rows.filter(r => r.classList.contains(cls)).length;
    rows.forEach(r => { if (r.classList.contains(cls)) counted.add(r); });
    parts.push(`${label} (${n})`);
  });
  total = counted.size;

  if (!parts.length) { if (note) note.remove(); return; }
  if (!note || note.parentNode !== banner) {
    if (note) note.remove();
    note = document.createElement('span');
    note.id = 'cno-injured-hidden-note';
    note.style.cssText = 'margin-right: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 500; color: #94a3b8;';
    banner.insertBefore(note, banner.firstChild);
  }
  const text = `${total} row${total === 1 ? '' : 's'} hidden: ${parts.join(', ')}`;
  if (note.dataset.text !== text) {
    note.dataset.text = text;
    note.innerHTML = '';
    const icon = createRowsFilterHint();
    icon.style.marginLeft = '0';
    note.appendChild(icon);
    note.appendChild(document.createTextNode(text));
  }
}

// ====================================================
// ODDS BOOST: MAKE SURE A BOOST TYPE IS SELECTED BEFORE THE FIRST LOAD
// CNO's page loads with no Boost Type radio checked and fetches its results right away, which
// gives "Please select a Boost Type option". As soon as the radios exist, pick the saved default
// type (or Profit Boost) and fill in the saved default amount, so that first load works.
// ====================================================

if (window.location.pathname.toLowerCase().includes('odds-boost.aspx')) {
  let boostTypeReady = false;
  const ensureBoostType = () => {
    if (boostTypeReady) return;
    const radios = Array.from(document.querySelectorAll('input[name$="RadioButtonListOddsBoostType"]'));
    if (!radios.length) return;
    boostTypeReady = true;
    const pick = (type) => {
      const r = radios.find(x => x.value === type) || radios.find(x => x.value === 'profit') || radios[0];
      if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    if (radios.some(r => r.checked)) return;
    pick('profit'); // right away, in case the saved default takes a moment to read
    try {
      chrome.storage.local.get([CNO_BOOST_DEFAULT_KEY], (d) => {
        const def = d && d[CNO_BOOST_DEFAULT_KEY];
        if (!def) return;
        cnoBoostDefault = def;
        pick(def.type);
        applyBoostDefault(false); // fills the saved amount if the box is empty
      });
    } catch (e) { /* ignore */ }
  };
  const obs = new MutationObserver(() => { ensureBoostType(); if (boostTypeReady) obs.disconnect(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', ensureBoostType);
}

// ====================================================
// SHARP FV (Custom Sharp Book Devigging)
// "Sharp FV" next to "FV Devig" under the Calc button. It reads the line's game page (fresh every
// time), takes the prices of the user's sharp books for every side of the line, and devigs them
// with the CNO Devigger API:
//   Average  -> one call: AVG(...)/AVG(...) of the usable sharp books
//   Weighted -> one call per book, the fair chances pooled in log-odds with the weights (a book
//               that can't be used has its weight shared out in proportion), then one final call
//               with the pooled fair odds for EV% and Kelly.
// Not on Low Hold / hedge tables.
// ====================================================

const CNO_DEVIG_API = 'https://api.crazyninjaodds.com/api/devigger/v1/sportsbook_devigger.aspx';
const CNO_DEVIG_METHOD_CODES = { multiplicative: 0, additive: 1, power: 2, shin: 3, worstcase: 4 };
const CNO_DEVIG_METHOD_NAMES = { multiplicative: 'Multiplicative', additive: 'Additive', power: 'Power', shin: 'Shin', worstcase: 'Worst-case' };

let cnoSharpConfig = null;
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get([CNO_SHARP_CONFIG_KEY], (d) => { cnoSharpConfig = (d && d[CNO_SHARP_CONFIG_KEY]) || null; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CNO_SHARP_CONFIG_KEY]) cnoSharpConfig = changes[CNO_SHARP_CONFIG_KEY].newValue || null;
  });
}

// Everything Sharp FV needs from a results row (null = no Sharp FV for this row)
function cnoSharpRowInfo(btn) {
  if (!userSettings.customSharpDevig || !cnoSharpConfig) return null;
  const row = btn.closest('tr');
  const table = btn.closest('table');
  if (!row || !table) return null;
  const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  if (heads.some(h => h.startsWith('hedge'))) return null;
  // The Free Bet page names its columns "Free Bet Name" / "Free Bet Odds" / "Free Bet Sportsbook"
  const cellAt = (name) => {
    let i = heads.indexOf(name);
    if (i < 0) i = heads.indexOf(`free bet ${name}`);
    return i >= 0 ? row.children[i] : null;
  };
  const textAt = (name) => { const c = cellAt(name); return c ? getCleanCellText(c) : ''; };
  const sport = textAt('sport');
  const league = textAt('league');
  // No set for this sport/league and market type: no Sharp FV (and the game page is never read)
  const set = cnoFindSharpSet(cnoSharpConfig, sport, league, textAt('market'));
  if (!set) return null;
  const gameLink = row.querySelector('a[href*="game.aspx"]');
  if (!gameLink) return null;
  const fvUrl = getCalcRowDeviggerUrl(btn);
  if (!fvUrl) return null;

  // Date: the restyled cell splits it into day / time
  const dateCell = cellAt('date');
  let dateText = '';
  if (dateCell) {
    const day = dateCell.querySelector('.lh-day'), time = dateCell.querySelector('.lh-time');
    dateText = day && time ? `${day.textContent.trim()} · ${time.textContent.trim()}` : getCleanCellText(dateCell).replace(/\s+at\s+/i, ' · ');
  }
  const bookCell = cellAt('sportsbook');
  const betLink = bookCell ? (bookCell.querySelector('a[href*="deeplink.aspx"]') || bookCell.querySelector('a[href]')) : null;
  const oddsCell = cellAt('odds');
  // CNO's own numbers for comparison: fair odds (the same ones FV Devig uses) and the EV% column
  const cnoFair = (new URL(fvUrl).searchParams.get('LegOdds') || '').split('//')[0].trim();
  const evIdx = heads.findIndex(h => h.endsWith('ev%') && h !== 'ev hit%');
  const evText = evIdx !== -1 && row.children[evIdx] ? getCleanCellText(row.children[evIdx]) : '';
  const evLabel = evIdx !== -1 ? Array.from(table.querySelectorAll('thead th'))[evIdx].textContent.replace(/\s+/g, ' ').trim() : '';
  return {
    cnoFair: cnoFair ? (/^[+-]/.test(cnoFair) ? cnoFair : `+${cnoFair}`) : '',
    cnoEv: evText,
    cnoEvLabel: evLabel,
    sport, league, set, fvUrl,
    gameUrl: gameLink.href,
    devigMethod: cnoSharpConfig.devigMethod || 'worstcase',
    event: textAt('event'),
    market: textAt('market'),
    betName: textAt('bet name'),
    dateText,
    bookName: bookCell ? getCleanCellText(bookCell) : '',
    betUrl: betLink && /^https?:/i.test(betLink.href) ? betLink.href : '',
    tableOdds: oddsCell ? extractAmericanOdds(getCleanCellText(oddsCell)) : null
  };
}

// Odds Surge amount on the Odds Boost page (null when not surging)
function cnoCurrentSurge() {
  if (!window.location.pathname.toLowerCase().includes('odds-boost.aspx')) return null;
  const type = document.querySelector('input[name$="RadioButtonListOddsBoostType"]:checked');
  if (!type || type.value !== 'surge') return null;
  const input = document.querySelector('#spanBoostOdds input[type="text"]');
  const v = input ? parseFloat(input.value.replace(/[^0-9.+-]/g, '')) : NaN;
  return isFinite(v) && v !== 0 ? v : null;
}

const CNO_SHARP_ICON_FV = cnoIconSvg('devig', 12);
const CNO_SHARP_ICON_TARGET = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>';

// Shows "Sharp FV" next to "FV Devig" only when it applies (checked on hover, so settings changes apply right away)
function cnoSyncSharpLink(td, btn, pop) {
  const fvLink = pop.querySelector('a.cno-fv-link:not(.cno-sharp-link)');
  if (fvLink && !fvLink.dataset.lhIcon) {
    fvLink.innerHTML = `${CNO_SHARP_ICON_FV}<span>FV Devig</span><span aria-hidden="true">↗</span>`;
    fvLink.dataset.lhIcon = '1';
  }
  const want = !!cnoSharpRowInfo(btn);
  let link = pop.querySelector('a.cno-sharp-link');
  if (want && !link) {
    link = document.createElement('a');
    link.className = 'cno-fv-link cno-sharp-link';
    link.href = '#';
    link.innerHTML = `${CNO_SHARP_ICON_TARGET}<span>Sharp FV</span>`;
    link.title = 'Fair value and EV% from your custom sharp books';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const b = td.querySelector('input[type="button"][value="Calc"]');
      if (b) cnoOpenSharpPopup(b);
    });
    pop.appendChild(link);
  } else if (!want && link) {
    link.remove();
  }
}

// ---------- game page ----------

// The game page's odds table isn't in the page itself; CNO loads it right after with a second
// request (its "delayed load" timer). Do the same, without opening the page.
async function cnoFetchGameTable(gameUrl) {
  const url = new URL(gameUrl, window.location.origin).href;
  const html = await fetch(url, { credentials: 'include', cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('game page ' + r.status); return r.text(); });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const form = doc.getElementById('form1') || doc.querySelector('form');
  const sm = html.match(/PageRequestManager\._initialize\('([^']+)'/);
  const timer = html.match(/"uniqueID":"([^"]*TimerAjaxDelayedLoad)"/);
  const panel = html.match(/'t([^']*UpdatePanelGridView)'/);
  if (!form || !sm || !timer || !panel) throw new Error('game page layout changed');

  const p = new URLSearchParams();
  form.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.name || ['submit', 'button', 'image'].includes(el.type)) return;
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
    if (el.tagName === 'SELECT') { Array.from(el.selectedOptions).forEach(o => p.append(el.name, o.value)); return; }
    p.append(el.name, el.value);
  });
  p.set(sm[1], `${panel[1]}|${timer[1]}`);
  p.set('__EVENTTARGET', timer[1]);
  p.set('__EVENTARGUMENT', '');
  p.set('__ASYNCPOST', 'true');

  const txt = await fetch(url, {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-MicrosoftAjax': 'Delta=true', 'X-Requested-With': 'XMLHttpRequest' },
    body: p.toString()
  }).then(r => { if (!r.ok) throw new Error('game odds ' + r.status); return r.text(); });

  // Partial-page response: "length|type|id|content|" repeated
  let i = 0, content = null;
  while (i < txt.length) {
    const a = txt.indexOf('|', i); if (a < 0) break;
    const len = parseInt(txt.slice(i, a), 10);
    const b = txt.indexOf('|', a + 1); const c = txt.indexOf('|', b + 1);
    if (isNaN(len) || b < 0 || c < 0) break;
    const type = txt.slice(a + 1, b), id = txt.slice(b + 1, c);
    if (type === 'updatePanel' && id.endsWith('UpdatePanelGridView')) content = txt.slice(c + 1, c + 1 + len);
    i = c + 1 + len + 1;
  }
  if (!content) throw new Error('no odds table in the response');
  const table = new DOMParser().parseFromString(content, 'text/html').querySelector('table[id*="GridView"]');
  if (!table) throw new Error('no odds table in the response');
  table.cnoDoc = doc; // the page itself (its Market / Sub-market dropdowns)
  return table;
}

function cnoParseGameCell(cell) {
  if (!cell) return null;
  const text = cell.textContent.replace(/\s+/g, ' ').trim();
  const odds = extractAmericanOdds(text);
  if (!odds) return null;
  const liq = text.match(/\(\$([\d,]+(?:\.\d+)?)/);
  return { odds, liq: liq ? parseFloat(liq[1].replace(/,/g, '')) : null };
}

function cnoImplied(odds) {
  const a = parseFloat(String(odds).replace('+', ''));
  return a < 0 ? -a / (-a + 100) : 100 / (a + 100);
}

// The game page's column code for a book named in the results table ("FanDuel" -> "FD")
function cnoBookCodeForName(name) {
  const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = norm(name);
  if (!want) return Promise.resolve(null);
  const fromMap = Object.entries(typeof BOOK_HEADER_FULLNAME_MAP !== 'undefined' ? BOOK_HEADER_FULLNAME_MAP : {}).find(([, full]) => norm(full) === want);
  return new Promise(resolve => {
    chrome.storage.local.get([CNO_BOOKS_CACHE_KEY], (d) => {
      const sheet = parseBooksCsv(d && d[CNO_BOOKS_CACHE_KEY]).find(b => norm(b.fullName) === want);
      resolve(sheet ? sheet.shortCode : (fromMap ? fromMap[0] : null));
    });
  });
}

// ---------- devigger API ----------

async function cnoDevigApi(legOdds, finalOdds, method, extra) {
  const p = new URLSearchParams({ api: 'open', LegOdds: legOdds, FinalOdds: String(finalOdds).replace('+', ''), Correlation_Bool: '0', Boost_Bool: '0' });
  p.set('DevigMethod', String(CNO_DEVIG_METHOD_CODES[method] !== undefined ? CNO_DEVIG_METHOD_CODES[method] : 4));
  ['Multiplicative', 'Additive', 'Power', 'Shin'].forEach(m => p.set(`WorstCase_${m}`, '1'));
  p.set('Args', 'ev_p,kelly,dm,fb_p');
  Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
  const res = await fetch(`${CNO_DEVIG_API}?${p.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('devigger ' + res.status);
  const data = await res.json();
  if (!data || !data.Final) throw new Error('devigger returned no result');
  return data;
}

// 0.5157 -> "-106.47", 0.4843 -> "+106.47" (HIT() rounds to whole odds, which moves the fair value a little)
function cnoExactAmerican(p) {
  const v = p >= 0.5 ? -(p / (1 - p)) * 100 : ((1 - p) / p) * 100;
  return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
}

function cnoSharpFinal(d) {
  const f = d.Final || {};
  return { fair: f.FairValue, ev: f.EV_Percentage, kellyFull: f.Kelly_Full, fb: f.FB_Percentage, legJuice: d['Leg#1'] ? d['Leg#1'].MarketJuice : undefined };
}

function getGameBookFullNameSafe(code) {
  try { if (typeof getGameBookFullName === 'function') { const n = getGameBookFullName(code); if (n) return n; } } catch (e) { /* ignore */ }
  return code;
}

// ---------- the calculation ----------

// Reads the game page and devigs each sharp book. The final EV% calls are separate
// (cnoSharpFinals) so a profit boost can be added without reading everything again.
async function cnoComputeSharp(info) {
  const fv = new URL(info.fvUrl);
  const pageBoost = {};
  ['Boost_Bool', 'Boost_Text', 'Boost_Type'].forEach(k => { if (fv.searchParams.get(k) !== null) pageBoost[k] = fv.searchParams.get(k); });
  const comment = (fv.searchParams.get('LegOdds') || '').split('//').slice(1).join('//').trim();

  const [table, betCode] = await Promise.all([cnoFetchGameTable(info.gameUrl), cnoBookCodeForName(info.bookName)]);
  const readAt = new Date();
  const codes = Array.from((table.rows[0] || { cells: [] }).cells).map(c => c.textContent.replace(/\s+/g, '').toUpperCase());
  const rows = Array.from(table.rows).slice(1).filter(r => r.id && r.cells.length > 2);
  const sideId = new URL(info.gameUrl, window.location.origin).searchParams.get('side_id');
  const target = rows.find(r => r.id === sideId);
  if (!target) throw new Error("couldn't find this line on the game page");

  // Soccer 3-way "<Team> Yes" / "Draw Yes": that sub-market is one-way at almost every book, so
  // the sharp prices come from the "Common" sub-market's full 3-way (Home / Draw / Away) instead.
  // The bet's own odds still come from its own line.
  let sharpCodes = codes, sharpRows = rows, sharpTarget = target, viaCommon = false;
  const targetName = target.cells[0].textContent.replace(/\s+/g, ' ').trim();
  if (/^soccer$/i.test(info.sport || '') && /3-way/i.test(info.market || '') && /\s+yes$/i.test(targetName)) {
    const sel = table.cnoDoc && table.cnoDoc.querySelector('select[id$="DropDownListSubMarket"]');
    const common = sel && Array.from(sel.options).find(o => /^common$/i.test(o.textContent.trim()));
    if (common) {
      const u = new URL(info.gameUrl, window.location.origin);
      u.searchParams.set('submarket_id', common.value);
      u.searchParams.delete('side_id');
      const ct = await cnoFetchGameTable(u.href);
      const cRows = Array.from(ct.rows).slice(1).filter(r => r.id && r.cells.length > 2);
      const want = targetName.replace(/\s+yes$/i, '').trim().toLowerCase();
      const cTarget = cRows.find(r => r.cells[0].textContent.replace(/\s+/g, ' ').trim().toLowerCase() === want);
      if (cTarget) {
        sharpCodes = Array.from((ct.rows[0] || { cells: [] }).cells).map(c => c.textContent.replace(/\s+/g, '').toUpperCase());
        sharpRows = cRows;
        sharpTarget = cTarget;
        viaCommon = true;
      }
    }
  }

  const group = (groupGameRows(sharpRows, { betName: 0 }).find(g => g.includes(sharpTarget)) || [sharpTarget]);
  if (group.length < 2) throw new Error("couldn't find the other side of this line on the game page");
  // One-way lists (e.g. every player's anytime TD) group together but aren't one market
  if (group.length > 3) throw Object.assign(new Error('Sharp FV works on 2-way and 3-way lines only.'), { plain: true });
  const sides = [sharpTarget].concat(group.filter(r => r !== sharpTarget));
  const sideNames = sides.map(r => r.cells[0].textContent.replace(/\s+/g, ' ').trim());

  // The bet's own odds, fresh from the game page (falls back to the table's)
  const betCol = betCode ? codes.indexOf(betCode.toUpperCase()) : -1;
  const fresh = betCol !== -1 ? cnoParseGameCell(target.cells[betCol]) : null;
  const baseOdds = fresh ? fresh.odds : info.tableOdds;
  if (!baseOdds) throw new Error("couldn't read this bet's odds");
  const surge = cnoCurrentSurge();
  const finalOdds = (surge !== null && cnoAddToAmericanOdds(baseOdds, surge)) || baseOdds;

  // Each sharp book: its prices for every side, and whether it can be used
  const books = info.set.books.map(b => {
    const col = sharpCodes.indexOf(b.code);
    const cells = sides.map(r => col === -1 ? null : cnoParseGameCell(r.cells[col]));
    const out = { code: b.code, name: getGameBookFullNameSafe(b.code), setWeight: b.weight, minLiq: b.minLiq, cells, usable: false, reason: '' };
    const have = cells.filter(Boolean).length;
    if (!have) out.reason = 'No line';
    else if (have < sides.length) out.reason = 'Missing a side';
    else if (CNO_SHARP_EXCHANGES.includes(b.code) && b.minLiq > 0 && cells.some(c => !(c.liq >= b.minLiq))) out.reason = `Under $${b.minLiq.toLocaleString()} liquidity`;
    else out.usable = true;
    if (have === sides.length) out.juice = cells.reduce((t, c) => t + cnoImplied(c.odds), 0) - 1;
    return out;
  });
  const usable = books.filter(b => b.usable);
  const r = {
    info, readAt, sideNames, books, usable: usable.length, method: info.devigMethod, mode: info.set.mode,
    freshOdds: fresh ? fresh.odds : null, betCode, baseOdds, finalOdds, gameFinalOdds: finalOdds, surge, pageBoost, comment, viaCommon
  };
  if (!usable.length) return r;

  // Each usable book devigged on its own (its FV is shown in the table; Weighted pools them)
  const perBook = await Promise.all(usable.map(b => cnoDevigApi(b.cells.map(c => c.odds).join('/'), b.cells[0].odds, info.devigMethod, {})));
  usable.forEach((b, i) => {
    const d = perBook[i];
    b.fair = d['Leg#1'] ? d['Leg#1'].FairValue : d.Final.FairValue;
  });

  r.avgLeg = sides.map((_, i) => usable.length === 1 ? usable[0].cells[i].odds : `AVG(${usable.map(b => b.cells[i].odds).join(',')})`).join('/');
  if (info.set.mode !== 'weighted') {
    usable.forEach(b => { b.share = 1 / usable.length; });
    r.leg = r.avgLeg;
  } else {
    // Weights of the usable books, scaled back up to 100%, pooled in log-odds
    const total = usable.reduce((t, b) => t + (b.setWeight > 0 ? b.setWeight : 0), 0);
    usable.forEach(b => { b.share = total > 0 ? (b.setWeight > 0 ? b.setWeight : 0) / total : 1 / usable.length; });
    let logit = 0;
    usable.forEach(b => {
      const f = Math.min(Math.max(b.fair, 1e-6), 1 - 1e-6);
      logit += b.share * Math.log(f / (1 - f));
    });
    const pFair = 1 / (1 + Math.exp(-logit));
    r.leg = `${cnoExactAmerican(pFair)}/${cnoExactAmerican(1 - pFair)}`;
    r.juice = usable.reduce((t, b) => t + b.share * b.juice, 0);
  }
  return r;
}

// EV%, Kelly and the devigger link, with the page's boost or one typed into the popup
async function cnoSharpFinals(r, extraBoostPct) {
  const boost = Object.assign({}, r.pageBoost);
  if (extraBoostPct > 0) Object.assign(boost, { Boost_Bool: '1', Boost_Text: String(extraBoostPct), Boost_Type: '0' });
  const calls = [cnoDevigApi(r.leg, r.finalOdds, r.method, boost)];
  if (r.mode === 'weighted' && r.usable > 1) calls.push(cnoDevigApi(r.avgLeg, r.finalOdds, r.method, boost));
  const [main, avg] = await Promise.all(calls);
  Object.assign(r, cnoSharpFinal(main));
  if (r.mode !== 'weighted') r.juice = r.legJuice;
  r.average = avg ? cnoSharpFinal(avg) : null;
  r.boostPct = extraBoostPct > 0 ? extraBoostPct : null;

  // "Open in devigger": the sharp line, this bet's odds and boost, and a description that
  // lists each sharp book's FV and weight
  const link = new URL(r.info.fvUrl);
  const sharpDesc = r.books.filter(b => b.usable)
    .map(b => `${b.code} ${cnoProbabilityToAmerican(b.fair) || '?'} ${Math.round(b.share * 1000) / 10}%`).join(', ');
  // The Devigger's server refuses a "%" in the address; it reads "_PCT_" as % (its own links do this)
  // Weighted links carry one fair number (the Devigger shows 0% juice for it), so the sharps'
  // weighted juice goes in the comment
  const juiceDesc = r.mode === 'weighted' && isFinite(r.juice) ? `vig ${(r.juice * 100).toFixed(1)}%` : '';
  const desc = [r.comment, sharpDesc ? `Sharps: ${sharpDesc}` : '', juiceDesc].filter(Boolean).join(' | ').replace(/%/g, '_PCT_');
  // Weighted: just the pooled fair odds (one number, already no-vig). The two-sided
  // "+135.38/-135.38" form made the Devigger report 0% juice. Average sets keep their AVG(...) line.
  const legForLink = r.mode === 'weighted' ? String(r.leg).split('/')[0] : r.leg;
  link.searchParams.set('LegOdds', desc ? `${legForLink}     // ${desc}` : legForLink);
  link.searchParams.set('FinalOdds', String(r.finalOdds).replace('+', ''));
  ['Boost_Bool', 'Boost_Text', 'Boost_Type'].forEach(k => link.searchParams.delete(k));
  Object.entries(boost).forEach(([k, v]) => link.searchParams.set(k, v));
  r.deviggerUrl = link.toString();
  return r;
}

// ---------- popup ----------

let cnoSharpPopupState = null; // { btn, el }

// Show / hide the dollar bet size (remembered until toggled back)
const CNO_SHARP_SHOW_BETSIZE_KEY = 'sharpShowBetSize';
let cnoSharpShowBetSize = true;
try {
  chrome.storage.local.get({ [CNO_SHARP_SHOW_BETSIZE_KEY]: true }, (d) => { cnoSharpShowBetSize = d[CNO_SHARP_SHOW_BETSIZE_KEY] !== false; });
} catch (e) { /* ignore */ }
const CNO_SHARP_ICON_EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const CNO_SHARP_ICON_EYE_OFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

function cnoCloseSharpPopup() {
  if (cnoSharpPopupState && cnoSharpPopupState.el) cnoSharpPopupState.el.remove();
  cnoSharpPopupState = null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cnoSharpPopupState && !document.getElementById('cno-qr-overlay')) cnoCloseSharpPopup();
});

function cnoSharpEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

// The Calc button last clicked, so the Calc popup knows which row it's showing
let cnoLastCalcBtn = null;
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('input[type="button"][value="Calc"]') : null;
  if (b) cnoLastCalcBtn = b;
}, true);

// "Custom Sharp EV" next to "Open in Devigger" in CNO's Calc popup
function cnoSyncCalcSharpBtn(container) {
  const btn = cnoLastCalcBtn && cnoLastCalcBtn.isConnected ? cnoLastCalcBtn : null;
  const want = !!(btn && cnoSharpRowInfo(btn));
  let a = container.querySelector('a.cno-calc-sharp-btn');
  if (want && !a) {
    a = document.createElement('a');
    a.className = 'cno-devigger-btn cno-calc-sharp-btn';
    a.href = '#';
    a.title = 'Fair value and EV% from your custom sharp books';
    a.innerHTML = `${cnoIconSvg('target')}<span>Custom Sharp EV</span>`;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (cnoLastCalcBtn && cnoLastCalcBtn.isConnected) cnoOpenSharpPopup(cnoLastCalcBtn, a);
    });
    container.appendChild(a);
  } else if (!want && a) {
    a.remove();
  }
}

function cnoOpenSharpPopup(btn, anchor) {
  const info = cnoSharpRowInfo(btn);
  if (!info) return;
  cnoCloseSharpPopup();
  // Opened from the Calc popup: sit beside that popup instead of the table row
  const place = (el) => cnoPlaceSharpPopup(el, anchor ? cnoSharpAnchorBox(anchor) : btn);

  const el = cnoSharpEl('div', 'cno-sharp-popup');
  el.setAttribute('role', 'dialog');

  // Title row
  const head = cnoSharpEl('div', 'cno-sharp-head');
  head.appendChild(cnoSharpEl('span', 'cno-sharp-title', 'Custom sharp FV'));
  const typeShort = { player: 'Player', nonplayer: 'Non-player' }[cnoSharpMarketType(info.set.marketType)];
  head.appendChild(cnoSharpEl('span', 'cno-sharp-tag', [info.set.key, typeShort, info.set.mode === 'weighted' ? 'weighted' : 'average'].filter(Boolean).join(' · ')));
  head.appendChild(cnoSharpEl('span', 'cno-sharp-spacer'));
  const refresh = cnoSharpEl('button', 'cno-sharp-iconbtn', '↻');
  refresh.type = 'button';
  refresh.title = 'Get the latest odds again';
  const close = cnoSharpEl('button', 'cno-sharp-iconbtn', '✕');
  close.type = 'button';
  close.title = 'Close';
  close.addEventListener('click', cnoCloseSharpPopup);
  head.appendChild(refresh);
  head.appendChild(close);
  el.appendChild(head);

  // The bet: event and time, market, then bet name (links to the book) + QR, odds and book
  const bet = cnoSharpEl('div', 'cno-sharp-betinfo');
  const line1 = [info.event, info.dateText].filter(Boolean).join('  ·  ');
  if (line1) bet.appendChild(cnoSharpEl('div', 'cno-sharp-event', line1));
  if (info.market) bet.appendChild(cnoSharpEl('div', 'cno-sharp-market', info.market));
  const betLine = cnoSharpEl('div', 'cno-sharp-betline');
  let nameEl;
  if (info.betUrl) {
    nameEl = cnoSharpEl('a', 'cno-sharp-betname', info.betName || 'Open bet');
    nameEl.href = info.betUrl;
    nameEl.target = '_blank';
    nameEl.rel = 'noopener';
    nameEl.title = `Open this bet at ${info.bookName || 'the sportsbook'}`;
  } else {
    nameEl = cnoSharpEl('span', 'cno-sharp-betname', info.betName);
  }
  betLine.appendChild(nameEl);
  if (info.betUrl) {
    const qr = cnoSharpEl('button', 'cno-sharp-qr', 'QR');
    qr.type = 'button';
    qr.title = 'Show QR code for this bet';
    qr.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const oddsNow = el.querySelector('.cno-sharp-oddsval');
      openQrPopup(info.betUrl, info.bookName, { event: info.event, market: info.market, betName: info.betName, odds: oddsNow ? oddsNow.value : info.tableOdds });
    });
    betLine.appendChild(qr);
  }
  const oddsWrap = cnoSharpEl('span', 'cno-sharp-odds');
  // The bet's odds: editable, like the Calc popup (EV%, Kelly... recalculate)
  const oddsInput = document.createElement('input');
  oddsInput.type = 'text';
  oddsInput.className = 'cno-sharp-oddsval';
  oddsInput.value = info.tableOdds || '';
  oddsInput.title = 'Your odds. Change them to recalculate.';
  oddsInput.setAttribute('aria-label', 'Bet odds');
  oddsInput.spellcheck = false;
  // After an edit: "Unedited odds: -310" in small text under the box (click the odds to put them back)
  const oddsBox = cnoSharpEl('span', 'cno-sharp-oddsbox');
  const origOdds = cnoSharpEl('span', 'cno-sharp-origodds');
  origOdds.hidden = true;
  origOdds.appendChild(document.createTextNode('Unedited odds: '));
  const origOddsBtn = cnoSharpEl('button', 'cno-sharp-origodds-btn');
  origOddsBtn.type = 'button';
  origOddsBtn.title = 'Put these odds back in the box';
  origOdds.appendChild(origOddsBtn);
  oddsBox.appendChild(oddsInput);
  oddsBox.appendChild(origOdds);
  oddsWrap.appendChild(oddsBox);
  if (info.bookName) oddsWrap.appendChild(cnoSharpEl('span', 'cno-sharp-book', info.bookName));
  betLine.appendChild(oddsWrap);
  bet.appendChild(betLine);
  const oddsNote = cnoSharpEl('div', 'cno-sharp-oddsnote');
  bet.appendChild(oddsNote);
  el.appendChild(bet);

  // Positive EV page: optional profit boost
  let boostInput = null;
  if (window.location.pathname.toLowerCase().includes('positive-ev.aspx')) {
    const boostRow = cnoSharpEl('label', 'cno-sharp-boost');
    boostRow.appendChild(cnoSharpEl('span', '', 'Add profit boost'));
    boostInput = document.createElement('input');
    boostInput.type = 'number';
    boostInput.min = '0';
    boostInput.step = '1';
    boostInput.placeholder = '0';
    boostRow.appendChild(boostInput);
    boostRow.appendChild(cnoSharpEl('span', '', '%'));
    el.appendChild(boostRow);
  }

  const body = cnoSharpEl('div', 'cno-sharp-body');
  el.appendChild(body);
  document.body.appendChild(el);
  cnoSharpPopupState = { btn, el, anchor: anchor || null, fromCalc: !!(anchor && anchor.closest && anchor.closest('[id$="PanelPopupCalc"]')) };
  place(el);

  let current = null; // last calculation (game page + per-book devigs)
  let defaultsCache = null;
  let oddsEdited = false; // the user typed their own odds (kept until ↻)
  const isOpen = () => cnoSharpPopupState && cnoSharpPopupState.el === el;
  const boostPct = () => (boostInput ? (cnoSharpNumber(boostInput.value) || 0) : 0);
  const showError = (err) => {
    if (!isOpen()) return;
    console.warn('CNO Helper: Sharp FV error', err);
    body.textContent = '';
    body.appendChild(cnoSharpEl('div', 'cno-sharp-error', err && err.plain ? err.message
      : `Couldn't work out the sharp fair value: ${err && err.message ? err.message : 'something went wrong'}. Try again with ↻.`));
  };
  const showResult = (r) => {
    if (!isOpen()) return;
    // The bet's current odds from the game page (unless the user typed their own)
    if (!oddsEdited) { oddsInput.value = r.finalOdds || ''; oddsInput.classList.remove('cno-bad'); }
    const notes = [];
    oddsNote.className = 'cno-sharp-oddsnote';
    origOdds.hidden = !oddsEdited;
    bet.classList.toggle('cno-edited', oddsEdited); // room for the line under the box
    if (oddsEdited) origOddsBtn.textContent = r.gameFinalOdds || '—';
    if (oddsEdited) {
      // (the unedited odds show under the box)
    } else if (!r.freshOdds) {
      notes.push(`⚠ ${info.bookName || 'The book'}'s line wasn't found on the game page, so the table's odds are used.`);
      oddsNote.classList.add('cno-warn');
    } else if (info.tableOdds && r.freshOdds !== info.tableOdds) {
      notes.push(`Updated from the game page (table showed ${info.tableOdds}).`);
    }
    if (r.viaCommon) notes.push('Sharp prices from the full 3-way (Common) market.');
    if (r.surge !== null && !oddsEdited) notes.push(`Includes the ${r.surge > 0 ? '+' : ''}${r.surge} surge (${r.baseOdds} listed).`);
    oddsNote.textContent = notes.join(' ');
    cnoRenderSharpResult(body, r, defaultsCache);
    place(el);
  };

  const run = () => {
    oddsEdited = false;
    body.textContent = '';
    body.appendChild(cnoSharpEl('div', 'cno-sharp-loading', 'Getting the latest odds…'));
    const freshInfo = cnoSharpRowInfo(btn) || info;
    Promise.all([cnoComputeSharp(freshInfo), new Promise(res => getSiteDefaults(res))])
      .then(([r, defaults]) => {
        defaultsCache = defaults;
        current = r;
        return r.usable ? cnoSharpFinals(r, boostPct()) : r;
      })
      .then(showResult)
      .catch(showError)
      .finally(() => { if (isOpen()) place(el); });
  };

  // A new boost only needs the final calls again
  if (boostInput) {
    let t = null;
    const reapply = () => {
      if (!current || !current.usable) return;
      cnoSharpFinals(current, boostPct()).then(showResult).catch(showError);
    };
    boostInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(reapply, 450); });
    boostInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); reapply(); } });
  }

  // Typed odds: whole American odds like -110 or +125
  let oddsTimer = null;
  const applyOdds = () => {
    const raw = oddsInput.value.trim().replace(/\s+/g, '');
    const m = raw.match(/^([+-]?)(\d{3,5})$/);
    const n = m ? parseInt(m[2], 10) * (m[1] === '-' ? -1 : 1) : NaN;
    const ok = m && Math.abs(n) >= 100;
    oddsInput.classList.toggle('cno-bad', !ok);
    if (!ok || !current || !current.usable) return;
    const odds = n > 0 ? `+${n}` : String(n);
    if (current.gameFinalOdds === undefined) current.gameFinalOdds = current.finalOdds;
    oddsEdited = odds !== current.gameFinalOdds;
    if (current.finalOdds === odds) return;
    current.finalOdds = odds;
    cnoSharpFinals(current, boostPct()).then(showResult).catch(showError);
  };
  oddsInput.addEventListener('input', () => { clearTimeout(oddsTimer); oddsTimer = setTimeout(applyOdds, 500); });
  oddsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(oddsTimer); applyOdds(); } });
  oddsInput.addEventListener('blur', () => { clearTimeout(oddsTimer); applyOdds(); });
  origOddsBtn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the box from applying on blur first
  origOddsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!current || current.gameFinalOdds === undefined) return;
    clearTimeout(oddsTimer);
    oddsInput.value = current.gameFinalOdds;
    applyOdds();
  });

  refresh.addEventListener('click', run);
  run();
}

// The Calc popup's own panel (the nearest wide, positioned box around the button)
function cnoSharpAnchorBox(anchor) {
  let n = anchor.parentElement;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if ((cs.position === 'fixed' || cs.position === 'absolute') && n.offsetWidth >= 280) return n;
    n = n.parentElement;
  }
  return anchor;
}

function cnoPlaceSharpPopup(el, btn) {
  const r = btn.getBoundingClientRect();
  const w = el.offsetWidth || 400;
  let left = r.right + 12;
  if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 12);
  let top = r.top - 8;
  const h = el.offsetHeight || 0;
  if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - 8 - h);
  el.style.left = `${left + window.scrollX}px`;
  el.style.top = `${top + window.scrollY}px`;
}

// 1234.5 -> "$1,234.50", -12 -> "-$12.00"
function cnoFmtMoney(n) {
  const v = Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}$${v}`;
}

function cnoFmtPct(x, signed) {
  if (x === null || x === undefined || !isFinite(x)) return '—';
  const v = Math.round(x * 1000) / 10;
  return `${signed && v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function cnoKellyLabel(mult) {
  if (Math.abs(mult - 0.25) < 1e-9) return 'QK';
  if (Math.abs(mult - 0.5) < 1e-9) return 'HK';
  if (Math.abs(mult - 1) < 1e-9) return 'Full Kelly';
  return `${mult}× Kelly`;
}

function cnoRenderSharpResult(body, r, defaults) {
  body.textContent = '';
  const setName = r.info.set.key === 'All' ? 'sharp books' : `${r.info.set.key} sharp books`;

  if (!r.usable) {
    body.appendChild(cnoSharpEl('div', 'cno-sharp-error',
      `No sharp EV%: none of your ${setName} (${r.books.map(b => b.name).join(', ')}) have ${r.sideNames.length === 2 ? 'both sides' : `all ${r.sideNames.length} sides`} of this line.`));
  } else {
    const mult = defaults && cnoSharpNumber(defaults.TextBoxKellyMultiplier) > 0 ? cnoSharpNumber(defaults.TextBoxKellyMultiplier) : 0.25;
    const bankroll = defaults ? cnoSharpNumber(defaults.TextBoxKellyBankroll) : null;
    const kellyPct = r.kellyFull > 0 ? r.kellyFull * mult : 0; // % of bankroll = units

    const tiles = cnoSharpEl('div', 'cno-sharp-tiles');
    const tile = (label, value, cls, sub, tileCls) => {
      const t = cnoSharpEl('div', 'cno-sharp-tile' + (tileCls ? ' ' + tileCls : ''));
      t.appendChild(cnoSharpEl('div', 'cno-sharp-tile-label', label));
      t.appendChild(cnoSharpEl('div', 'cno-sharp-tile-value' + (cls ? ' ' + cls : ''), value));
      if (sub) t.appendChild(cnoSharpEl('div', 'cno-sharp-tile-sub', sub));
      tiles.appendChild(t);
      return t;
    };
    // Order: Sharp EV% (the big one), QK, FBC, Fair odds
    const evTile = tile('Sharp EV%', cnoFmtPct(r.ev, true), r.ev > 0 ? 'cno-pos' : (r.ev < 0 ? 'cno-neg' : ''), `Juice ${cnoFmtPct(r.juice)}`, 'cno-sharp-tile-main');
    if (r.boostPct) { // the boost note goes on its own line under "Sharp EV%"
      evTile.querySelector('.cno-sharp-tile-label').appendChild(cnoSharpEl('div', 'cno-sharp-tile-boost', `(${r.boostPct}% boost)`));
    }
    const kLabel = cnoKellyLabel(mult);
    const kTile = tile(kLabel, kellyPct > 0 ? `${kellyPct.toFixed(2)}u` : '—', '',
      kellyPct > 0 && !(bankroll > 0) ? 'Set a bankroll in CNO Settings' : (kellyPct > 0 ? ' ' : 'No bet'));
    // Free bet conversion: what a free bet on this line is worth (as a % of the free bet)
    tile('FBC', isFinite(r.fb) ? `${(r.fb * 100).toFixed(1)}%` : '—', '', '');
    tile('Fair odds', cnoProbabilityToAmerican(r.fair) || '—', '', isFinite(r.fair) ? `${(r.fair * 100).toFixed(1)}% to hit` : '');
    // Bet size in dollars, with a show/hide eye (remembered)
    if (kellyPct > 0 && bankroll > 0) {
      const sub = kTile.querySelector('.cno-sharp-tile-sub');
      sub.textContent = '';
      sub.classList.add('cno-sharp-betsize');
      const amount = cnoFmtMoney(kellyPct / 100 * bankroll).replace(/\.\d+$/, ''); // whole dollars
      const label = cnoSharpEl('span', 'cno-sharp-betsize-amt', '');
      const eye = cnoSharpEl('button', 'cno-sharp-eye');
      eye.type = 'button';
      const paint = () => {
        label.textContent = cnoSharpShowBetSize ? amount : '$—';
        eye.innerHTML = cnoSharpShowBetSize ? CNO_SHARP_ICON_EYE : CNO_SHARP_ICON_EYE_OFF;
        eye.title = cnoSharpShowBetSize ? 'Hide bet size' : 'Show bet size';
      };
      eye.addEventListener('click', (e) => {
        e.preventDefault();
        cnoSharpShowBetSize = !cnoSharpShowBetSize;
        try { chrome.storage.local.set({ [CNO_SHARP_SHOW_BETSIZE_KEY]: cnoSharpShowBetSize }); } catch (err) { /* ignore */ }
        paint();
      });
      paint();
      sub.appendChild(label);
      sub.appendChild(eye);
    }
    body.appendChild(tiles);
  }

  // Sharp books used (or not)
  const tbl = cnoSharpEl('table', 'cno-sharp-books');
  const hr = document.createElement('tr');
  ['Book', 'Odds', 'FV', 'Juice', r.mode === 'weighted' ? 'Weight' : 'Used']
    .forEach((h, i) => hr.appendChild(cnoSharpEl('th', i >= 2 ? 'cno-r' : '', h)));
  tbl.appendChild(hr);
  r.books.forEach(b => {
    const tr = document.createElement('tr');
    if (!b.usable) tr.className = 'cno-sharp-unused';
    tr.appendChild(cnoSharpEl('td', '', b.name));
    const pricesTd = document.createElement('td');
    pricesTd.appendChild(document.createTextNode(b.cells.map(c => c ? c.odds : '—').join(' / ')));
    if (b.reason) pricesTd.appendChild(cnoSharpEl('div', 'cno-sharp-warn', '⚠ ' + b.reason));
    else if (b.cells.some(c => c && c.liq !== null)) pricesTd.appendChild(cnoSharpEl('div', 'cno-sharp-sub', `$${Math.min(...b.cells.map(c => c.liq || 0)).toLocaleString()} avail.`));
    tr.appendChild(pricesTd);
    tr.appendChild(cnoSharpEl('td', 'cno-r cno-sharp-fv', b.usable && isFinite(b.fair) ? (cnoProbabilityToAmerican(b.fair) || '—') : '—'));
    tr.appendChild(cnoSharpEl('td', 'cno-r', b.juice !== undefined ? cnoFmtPct(b.juice) : '—'));
    const wTd = cnoSharpEl('td', 'cno-r', b.usable ? (r.mode === 'weighted' ? `${Math.round(b.share * 1000) / 10}%` : '✓') : (r.mode === 'weighted' ? '0%' : '—'));
    // The weight you set, only when it was shifted (a book was skipped)
    const used = b.usable ? Math.round(b.share * 1000) / 10 : 0;
    if (r.mode === 'weighted' && b.setWeight !== undefined && b.setWeight !== null && Math.abs(used - b.setWeight) > 0.05) {
      wTd.appendChild(cnoSharpEl('div', 'cno-sharp-sub', `set ${b.setWeight}%`));
    }
    tr.appendChild(wTd);
    tbl.appendChild(tr);
  });
  body.appendChild(tbl);

  // For comparison: a straight average of the sharps (weighted sets) and CNO's own FV / EV%
  const compare = (label, fair, ev, title) => {
    const row = cnoSharpEl('div', 'cno-sharp-avg');
    if (title) row.title = title;
    row.appendChild(cnoSharpEl('span', '', label));
    row.appendChild(cnoSharpEl('span', '', ev === null ? `FV ${fair || '—'}` : `FV ${fair || '—'} · EV% ${ev || '—'}`));
    body.appendChild(row);
  };
  if (r.average) compare('Straight average of sharps', cnoProbabilityToAmerican(r.average.fair), cnoFmtPct(r.average.ev, true));
  if (r.info.cnoFair || r.info.cnoEv) {
    // CNO's EV% is for the table's odds, so it's left out once the odds have been edited
    const edited = (r.gameFinalOdds !== undefined && r.finalOdds !== r.gameFinalOdds) || !!r.boostPct;
    compare(`CNO${r.info.cnoEvLabel && r.info.cnoEvLabel.toLowerCase() !== 'ev%' ? ` (${r.info.cnoEvLabel.replace(/\s*EV%$/i, '')})` : ''}`,
      r.info.cnoFair, edited ? null : r.info.cnoEv,
      edited ? "CNO's own fair odds from the table (its EV% is for the table's odds with no boost, so it's hidden while you use your own odds or a boost)"
        : "CNO's own fair odds and EV% from the table (against the table's odds)");
  }

  const foot = cnoSharpEl('div', 'cno-sharp-foot');
  foot.appendChild(cnoSharpEl('span', '', `${CNO_DEVIG_METHOD_NAMES[r.method] || r.method} · prices from ${r.readAt.toLocaleTimeString()}`));
  const links = cnoSharpEl('span', 'cno-sharp-foot-links');
  if (r.usable && isFinite(r.ev)) {
    const copy = cnoSetIconLabel(cnoSharpEl('a', 'cno-sharp-open cno-sharp-copy'), 'discord', 'Copy for Discord');
    copy.href = '#';
    copy.title = 'Copy this result as a Discord post';
    copy.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const done = (ok) => {
        cnoSetIconLabel(copy, 'discord', ok ? 'Copied ✓' : 'Copy failed');
        setTimeout(() => { if (copy.isConnected) cnoSetIconLabel(copy, 'discord', 'Copy for Discord'); }, 1600);
      };
      try {
        navigator.clipboard.writeText(cnoSharpShareText(r)).then(() => done(true), () => done(false));
      } catch (err) { done(false); }
    });
    links.appendChild(copy);
  }
  if (r.deviggerUrl) {
    const a = cnoSetIconLabel(cnoSharpEl('a', 'cno-sharp-open'), 'devig', 'Open in Devigger', '↗');
    a.href = r.deviggerUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    links.appendChild(a);
  }
  foot.appendChild(links);
  body.appendChild(foot);
}

// ---------- shared pieces of the Discord copies ----------

// "Today at 4:25 PM" / "Sat, Nov 28 · 12:30 PM" -> "Today @ 4:25PM ET" / "Sat Nov 28 @ 12:30PM ET"
function cnoShareWhen(dateText) {
  const t = String(dateText || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^(.*?)\s*(?:\bat\b|·|@)\s*(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/i);
  if (!m) return t;
  const day = m[1].replace(/,/g, '').trim();
  const time = `${m[2]}${m[3] && m[3] !== '00' ? ':' + m[3] : ''}${m[4].toUpperCase()}`;
  let tz = '';
  try {
    tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName').value;
  } catch (e) { /* ignore */ }
  const us = tz.match(/^([ECMP])[SD]T$/);
  if (us) tz = `${us[1]}T`;
  return `${day ? day + ' @ ' : ''}${time}${tz ? ' ' + tz : ''}`;
}

// Bet title: "1st Quarter Moneyline 3-way Draw" (market first for Draw / Over / Under / Yes /
// No / numbers), otherwise "Las Vegas Raiders Moneyline" (bet first)
function cnoShareBetTitle(betName, market) {
  const bet = String(betName || '').replace(/\s+/g, ' ').trim();
  const mkt = String(market || '').replace(/\s+/g, ' ').trim();
  if (!mkt) return bet || 'Bet';
  if (!bet) return mkt;
  return /^(draw|tie|over|under|yes|no|odd|even|[+-]?\d)/i.test(bet) ? `${mkt} ${bet}` : `${bet} ${mkt}`;
}

// The heading, the event line, a blank line and the boost line (when there's a boost)
function cnoShareHeaderLines(o) {
  const book = String(o.book || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  const title = `${cnoShareBetTitle(o.betName, o.market)} ${o.odds}`.trim().replace(/[[\]]/g, '');
  const linked = o.url ? `**[${title}](<${o.url}>)**` : `**${title}**`;
  const tag = o.boosted ? `boosted to ${o.boosted}` : (o.tag || '');
  const lines = [`## ${book ? book + ': ' : ''}${linked}${tag ? `  *(${tag})*` : ''}`];
  const sub = [o.event, cnoShareWhen(o.dateText)].filter(Boolean).join(' | ');
  if (sub) lines.push(sub);
  if (o.boosted) {
    lines.push('');
    lines.push(`${o.boostPct}% profit boost. ${o.odds} boosted to ${o.boosted}.`);
  }
  return lines;
}

function cnoShareKelly(fullUnits, fbText) {
  const k = fullUnits > 0 ? fullUnits : 0;
  return k > 0
    ? `(Full=${k.toFixed(2)}u, 1/2=${(k / 2).toFixed(2)}u, 1/4=${(k / 4).toFixed(2)}u, FB = ${fbText})`
    : `(No Kelly bet; FB = ${fbText})`;
}

function cnoShareFooterLines(deviggerUrl) {
  const out = [];
  if (deviggerUrl) out.push('', `[View/Edit Devig](<${deviggerUrl}>)`);
  out.push('', `-# Generated by [CNO's Little Helper](<${CNO_LH_SITE_URL}>)`);
  return out;
}

function cnoShareSignedOdds(o) {
  const n = Number(String(o).replace('+', ''));
  return isFinite(n) && n !== 0 ? `${n > 0 ? '+' : ''}${Math.round(n)}` : String(o || '');
}

// Profit-boosted American odds, or '' with no boost
function cnoShareBoosted(odds, boostPct) {
  const d = americanToDecimal(String(odds).replace('+', ''));
  if (!(boostPct > 0) || !d) return '';
  const bd = 1 + (d - 1) * (1 + boostPct / 100);
  const a = bd >= 2 ? Math.round((bd - 1) * 100) : Math.round(-100 / (bd - 1));
  return `${a > 0 ? '+' : ''}${a}`;
}

// "Copy for Discord": the sharp result as a post, in the Devigger's copy format. No dollar amounts.
function cnoSharpShareText(r) {
  const info = r.info;
  const am = (p) => cnoProbabilityToAmerican(p) || '—';
  const pct1 = (x) => `${(x * 100).toFixed(1)}%`;
  const odds = cnoShareSignedOdds(r.finalOdds);
  const boosted = cnoShareBoosted(r.finalOdds, r.boostPct);
  const lines = cnoShareHeaderLines({
    book: info.bookName, betName: info.betName, market: info.market, odds, boosted, boostPct: r.boostPct,
    url: info.betUrl, event: info.event, dateText: info.dateText
  });
  lines.push('', `Odds: ${boosted || odds}; **EV: ${pct1(r.ev)}**`, '');

  // The sharp books
  const weighted = r.mode === 'weighted';
  const setName = info.set && info.set.key && info.set.key !== 'All' ? `${info.set.key} ` : '';
  lines.push(`**${setName}Sharps** (${weighted ? 'weighted' : 'average'}, ${(CNO_DEVIG_METHOD_NAMES[r.method] || r.method).toLowerCase()}):`);
  const priceOf = (b) => b.cells.map(c => c ? cnoShareSignedOdds(c.odds) : '—').join('/');
  const codeW = Math.max(...r.books.map(b => (b.code || b.name).length));
  const priceW = Math.max(...r.books.map(b => priceOf(b).length));
  r.books.forEach(b => {
    const code = (b.code || b.name).padEnd(codeW);
    if (!b.usable) {
      lines.push(`\`${code}  ${priceOf(b).padEnd(priceW)}  not used${b.reason ? `: ${b.reason}` : ''}\``);
      return;
    }
    const w = weighted ? `  ${Math.round(b.share * 1000) / 10}%` : '';
    const juice = b.juice !== undefined ? `  (${pct1(b.juice)} juice)` : '';
    lines.push(`\`${code}  ${priceOf(b).padEnd(priceW)}  FV ${am(b.fair)}${juice}${w}\``);
  });
  lines.push('');

  const parts = [`FV: ${am(r.fair)} (${pct1(r.fair)})`];
  if (info.cnoFair) { const abbr = cnoDevigMethodAbbrev(); parts.push(`CNO${abbr ? ' ' + abbr : ''} FV: ${info.cnoFair}`); }
  parts.push(cnoShareKelly(r.kellyFull, pct1(r.fb)));
  lines.push(parts.join('; '));
  return lines.concat(cnoShareFooterLines(r.deviggerUrl)).join('\n');
}

// ====================================================
// CALC POPUP: "COPY FOR DISCORD"
// Under the calculator's last line (above Close). Same format as the Sharp FV popup's copy, but
// the fair odds and EV are CNO's. EV, Kelly and free bet conversion are worked out from CNO's
// fair win chance and the odds (boosted when there's a boost); no dollar amounts.
// ====================================================

// CNO's devig method, abbreviated: "LW-WC" (Liquidity-Weighted - Worst-case), "LW-M", "UMC-P"...
// From the table's EV% header (what the table was worked out with), else the Devig Method dropdown.
function cnoDevigMethodAbbrev() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (table) {
    for (const th of table.querySelectorAll('thead th')) {
      const m = th.textContent.replace(/\s+/g, ' ').trim().match(/^(\S+)\s+EV%$/i);
      if (m) return m[1];
    }
  }
  const sel = document.querySelector('select[id$="DropDownListDevigMethod"]');
  const text = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : '';
  if (!text) return '';
  const initials = (part) => part.split('/').map(seg => seg.split(/[\s-]+/).filter(Boolean).map(w => w[0].toUpperCase()).join('')).join('/');
  return text.split(/\s+-\s+/).map(initials).join('-');
}

function cnoSyncCalcShare(table, data) {
  let wrap = table.nextElementSibling && table.nextElementSibling.classList.contains('cno-calc-share') ? table.nextElementSibling : null;
  if (!wrap) {
    wrap = cnoSharpEl('div', 'cno-calc-share');
    const a = cnoSetIconLabel(cnoSharpEl('a', 'cno-sharp-open cno-calc-share-btn'), 'discord', 'Copy for Discord');
    a.href = '#';
    a.title = "Copy this bet as a Discord post (CNO's fair odds)";
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const done = (ok) => {
        cnoSetIconLabel(a, 'discord', ok ? 'Copied ✓' : 'Copy failed');
        setTimeout(() => { if (a.isConnected) cnoSetIconLabel(a, 'discord', 'Copy for Discord'); }, 1600);
      };
      const betLink = wrap.parentNode && wrap.parentNode.querySelector('a.cno-calc-book-link');
      const text = cnoCalcShareText(Object.assign({}, wrap._data, { betUrl: betLink ? betLink.href : '' }));
      if (!text) { done(false); return; }
      try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (err) { done(false); }
    });
    wrap.appendChild(a);
    table.parentNode.insertBefore(wrap, table.nextSibling);
  }
  wrap._data = data;
}

// The promo calculators' type, reward and EV% ("Free Bet", "Risk-Free Bet", "Bet & Get Bet",
// "Win & Get Bet"); null for a plain +EV calculator
function cnoCalcPromoInfo(d) {
  const type = String(d.promoType || '').toLowerCase();
  const reward = String(d.reward || '').replace(/\s+/g, ' ').trim(); // "$100 (70%)"
  const rm = reward.match(/^(\$[\d,.]+)\s*\(([\d.]+%)\)/);
  const rewardText = rm ? `${rm[1].replace(/\.00$/, '')} @ ${rm[2]}` : reward;
  const ev = String(d.promoEv || '').trim();
  if (!ev) return null;
  const ev1 = (() => { const n = parseFloat(ev); return isFinite(n) ? `${n.toFixed(1)}%` : ev; })();
  if (/risk/.test(type)) return { tag: `RISK-FREE BET${rm ? `, ${rm[2]} conversion` : ''}`, label: 'RISK-FREE BET', ev: ev1 };
  if (/bet\s*&\s*get/.test(type)) return { tag: `BET & GET${rewardText ? `, ${rewardText}` : ''}`, label: 'BET & GET', ev: ev1 };
  if (/win\s*&\s*get/.test(type)) return { tag: `WIN & GET${rewardText ? `, ${rewardText}` : ''}`, label: 'WIN & GET', ev: ev1 };
  if (/free bet/.test(type)) return { tag: 'FREE BET', label: 'FREE BET', ev: ev1 };
  return null;
}

function cnoCalcShareText(d) {
  if (!d) return '';
  const dec = americanToDecimal(String(d.finalOdds).replace('+', ''));
  const p = d.fairPct > 0 && d.fairPct < 1 ? d.fairPct : (americanToDecimal(d.fairOdds) ? 1 / americanToDecimal(d.fairOdds) : NaN);
  if (!dec || !isFinite(p)) return '';
  const pct1 = (x) => `${(x * 100).toFixed(1)}%`;
  const odds = cnoShareSignedOdds(d.finalOdds);
  const boostPct = parseFloat(d.boostVal) > 0 ? parseFloat(d.boostVal) : 0;
  const boosted = cnoShareBoosted(d.finalOdds, boostPct);
  const bd = boosted ? americanToDecimal(boosted.replace('+', '')) : dec;
  const ev = p * bd - 1;
  const kelly = Math.max(0, ev / (bd - 1)) * 100; // % of bankroll = units
  const fb = p * (bd - 1);

  // Promo pages (Free Bet, Risk-Free, Bet & Get, Win & Get): CNO's promo EV%, no Kelly
  const promo = cnoCalcPromoInfo(d);
  if (promo) {
    const lines = cnoShareHeaderLines({
      book: d.book, betName: d.betName, market: d.market, odds, tag: promo.tag,
      url: d.betUrl, event: d.event, dateText: d.dateText
    });
    const abbr = cnoDevigMethodAbbrev();
    lines.push('', `Odds: ${odds}; **${promo.label} EV: ${promo.ev}**`, '');
    lines.push(`**CNO${abbr ? ' ' + abbr : ''}** FV: ${cnoShareSignedOdds(d.fairOdds)} (${pct1(p)})`);
    return lines.concat(cnoShareFooterLines(d.deviggerUrl)).join('\n');
  }

  const lines = cnoShareHeaderLines({
    book: d.book, betName: d.betName, market: d.market, odds, boosted, boostPct,
    url: d.betUrl, event: d.event, dateText: d.dateText
  });
  lines.push('', `Odds: ${boosted || odds}; **EV: ${pct1(ev)}**`, '');
  const abbr = cnoDevigMethodAbbrev();
  lines.push(`**CNO${abbr ? ' ' + abbr : ''}** FV: ${cnoShareSignedOdds(d.fairOdds)} (${pct1(p)}); ${cnoShareKelly(kelly, pct1(fb))}`);
  return lines.concat(cnoShareFooterLines(d.deviggerUrl)).join('\n');
}

// ====================================================
// ROW STRIPES WITH HIDDEN ROWS
// CNO colors every other row (white / light blue) when it draws the table. Once the extension
// hides rows (Exclude Player Unders, injured players, Refine: Leagues, hedge book filter, game
// page refinements), neighbors can end up the same color. While any rows are hidden, restripe
// the visible ones in order. Game tables that are paired (2-/3-way bands) keep their own bands.
// ====================================================

const CNO_HIDDEN_ROW_RE = /\bcno-[a-z]+-hidden\b/;

function processRowStriping() {
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table || !table.tBodies.length) return;
  const rows = Array.from(table.tBodies[0].rows).filter(r => !r.classList.contains('footable-row-detail'));
  const anyHidden = !table.classList.contains('lh-paired') && rows.some(r => CNO_HIDDEN_ROW_RE.test(r.className));
  let i = 0;
  rows.forEach(r => {
    let want = '';
    if (anyHidden && !CNO_HIDDEN_ROW_RE.test(r.className)) {
      want = i % 2 === 0 ? 'lh-stripe-a' : 'lh-stripe-b';
      i++;
    }
    if (want !== 'lh-stripe-a') r.classList.remove('lh-stripe-a');
    if (want !== 'lh-stripe-b') r.classList.remove('lh-stripe-b');
    if (want && !r.classList.contains(want)) r.classList.add(want);
  });
}

// ====================================================
// POSITIVE EV PAGE: "ADD PROFIT BOOST" IN CNO'S CALC POPUP
// A box under the popup's buttons. With a boost typed in, the Devigger API works out the boosted
// bet from CNO's Fair Odds and the popup's odds; the popup then shows a "Boosted Odds" line under
// Odds, and its EV%, QK and Kelly show the boosted values. Clearing the box puts CNO's back.
// Starts empty for each bet. "Open in Devigger" carries the boost too.
// ====================================================

const CNO_CALC_ODDS_INPUT_ID = 'ContentPlaceHolderMain_ContentPlaceHolderRight_TabContainerPopupCalc_TabPanelPopupCalc_EV_TextBoxPopupCalc_BetOdds';
const CNO_CALC_BOOSTED_SPANS = ['PopupCalc_EVPercentage', 'PopupCalc_KellyUnits', 'PopupCalc_KellyWager'];

function cnoCalcBoostPct(scope) {
  const input = (scope || document).querySelector('.cno-calc-boost input');
  const v = input ? cnoSharpNumber(input.value) : null;
  return v > 0 ? v : 0;
}

function cnoSyncCalcBoost(container, fairOdds, finalOdds) {
  if (!window.location.pathname.toLowerCase().includes('positive-ev.aspx')) return;
  if (!document.getElementById(CNO_CALC_ODDS_INPUT_ID)) return; // the one-bet (EV) Calc popup only
  let box = container.nextElementSibling && container.nextElementSibling.classList.contains('cno-calc-boost') ? container.nextElementSibling : null;
  if (!box) {
    box = document.createElement('div');
    box.className = 'cno-calc-boost';
    const label = document.createElement('label');
    label.appendChild(document.createTextNode('Add profit boost '));
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.placeholder = '0';
    // Small ✕ inside the box to clear it
    const field = document.createElement('span');
    field.className = 'cno-calc-boost-field';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'cno-calc-boost-clear';
    clear.title = 'Clear the boost';
    clear.textContent = '✕';
    clear.hidden = true;
    clear.addEventListener('mousedown', (e) => e.preventDefault());
    clear.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      clear.hidden = true;
      cnoRunCalcBoost(box);
    });
    field.appendChild(input);
    field.appendChild(clear);
    label.appendChild(field);
    label.appendChild(document.createTextNode(' %'));
    input.addEventListener('input', () => { clear.hidden = !input.value; });
    const status = document.createElement('span');
    status.className = 'cno-calc-boost-out';
    box.appendChild(label);
    box.appendChild(status);
    container.parentNode.insertBefore(box, container.nextSibling);
    let t = null;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => cnoRunCalcBoost(box), 400); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); clearTimeout(t); cnoRunCalcBoost(box); } });
  }
  // A different bet: start empty again
  if (box._forBtn !== cnoLastCalcBtn) {
    box._forBtn = cnoLastCalcBtn;
    box.querySelector('input').value = '';
    box.querySelector('.cno-calc-boost-clear').hidden = true;
    box.querySelector('.cno-calc-boost-out').textContent = '';
    box._result = null;
    box._run = (box._run || 0) + 1;
    cnoClearCalcBoost();
  }
  // Odds edited in the popup: recalculate
  const key = `${fairOdds}|${finalOdds}`;
  if (box.dataset.odds !== key) {
    box.dataset.fair = fairOdds;
    box.dataset.final = finalOdds;
    box.dataset.odds = key;
    if (cnoCalcBoostPct(box)) {
      box._result = null; // the old boosted numbers no longer fit these odds
      cnoClearCalcBoost();
      cnoRunCalcBoost(box);
    }
  }
  // CNO redraws its numbers when the odds change; keep the boosted ones showing
  if (box._result) cnoApplyCalcBoost(box._result);
}

async function cnoRunCalcBoost(box) {
  const status = box.querySelector('.cno-calc-boost-out');
  const pct = cnoCalcBoostPct(box);
  const run = (box._run = (box._run || 0) + 1);
  if (!pct) { box._result = null; status.textContent = ''; cnoClearCalcBoost(); return; }
  status.className = 'cno-calc-boost-out cno-busy';
  status.textContent = 'Working it out…';
  try {
    const [d, defaults] = await Promise.all([
      cnoDevigApi(box.dataset.fair, box.dataset.final, 'worstcase', { Boost_Bool: '1', Boost_Text: String(pct), Boost_Type: '0' }),
      new Promise(res => getSiteDefaults(res))
    ]);
    if (run !== box._run) return; // a newer calculation started
    // Kelly settings: the popup's own Settings tab first, then CNO's Settings page
    const popupVal = (suffix) => { const e = document.querySelector(`[id$="TabPanelPopupCalc_Settings_TextBoxPopupCalc_${suffix}"]`); return e ? cnoSharpNumber(e.value) : null; };
    const mult = popupVal('KellyMultiplier') > 0 ? popupVal('KellyMultiplier')
      : (defaults && cnoSharpNumber(defaults.TextBoxKellyMultiplier) > 0 ? cnoSharpNumber(defaults.TextBoxKellyMultiplier) : 0.25);
    const bankroll = popupVal('KellyBankroll') > 0 ? popupVal('KellyBankroll') : (defaults ? cnoSharpNumber(defaults.TextBoxKellyBankroll) : null);
    const f = d.Final || {};
    const units = (f.Kelly_Full || 0) * mult; // % of bankroll
    const money = cnoFmtMoney;
    box._result = {
      odds: f.Odds || '',
      values: {
        PopupCalc_EVPercentage: `${((f.EV_Percentage || 0) * 100).toFixed(2)}%`,
        PopupCalc_KellyUnits: `${units.toFixed(2)}u`,
        PopupCalc_KellyWager: bankroll > 0 ? money(units / 100 * bankroll) : null
      }
    };
    status.textContent = '';
    cnoApplyCalcBoost(box._result);
  } catch (e) {
    if (run !== box._run) return;
    box._result = null;
    cnoClearCalcBoost();
    status.className = 'cno-calc-boost-out cno-neg';
    status.textContent = "Couldn't reach the Devigger. Try again.";
  }
}

// "Boosted Odds" under the Odds line, and the boosted EV% / QK / Kelly
function cnoApplyCalcBoost(r) {
  const input = document.getElementById(CNO_CALC_ODDS_INPUT_ID);
  const oddsRow = input && input.closest('tr');
  if (!oddsRow) return;
  let row = oddsRow.nextElementSibling && oddsRow.nextElementSibling.classList.contains('cno-boosted-odds-row') ? oddsRow.nextElementSibling : null;
  if (!row) {
    row = document.createElement('tr');
    row.className = 'cno-boosted-odds-row';
    const td1 = document.createElement('td');
    const b = document.createElement('b');
    b.textContent = 'Boosted Odds';
    td1.appendChild(b);
    const td2 = document.createElement('td');
    td2.style.textAlign = 'center';
    const span = document.createElement('span');
    span.className = 'cno-boosted-odds';
    td2.appendChild(span);
    row.appendChild(td1);
    row.appendChild(td2);
    oddsRow.parentNode.insertBefore(row, oddsRow.nextSibling);
  }
  const span = row.querySelector('.cno-boosted-odds');
  if (span.textContent !== r.odds) span.textContent = r.odds;

  CNO_CALC_BOOSTED_SPANS.forEach(id => {
    const el = document.getElementById(id);
    const want = r.values[id];
    if (!el || want == null) return;
    if (el.textContent !== want) {
      // Anything else in there is CNO's own (new) value: keep it to put back later
      if (el.dataset.cnoBoosted !== el.textContent) el.dataset.cnoOrig = el.textContent;
      el.textContent = want;
      el.dataset.cnoBoosted = want;
    }
    el.classList.add('cno-boosted-val');
  });
}

function cnoClearCalcBoost() {
  document.querySelectorAll('tr.cno-boosted-odds-row').forEach(r => r.remove());
  CNO_CALC_BOOSTED_SPANS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.cnoBoosted === undefined) return;
    if (el.textContent === el.dataset.cnoBoosted && el.dataset.cnoOrig !== undefined) el.textContent = el.dataset.cnoOrig;
    delete el.dataset.cnoBoosted;
    delete el.dataset.cnoOrig;
    el.classList.remove('cno-boosted-val');
  });
}

// ====================================================
// EVENT INJURY REPORT (NBA, WNBA, NFL, MLB)
// A hover icon in the Event cell opens a popup listing each team's injured players from the
// injury sheets (already loaded on their schedule). The sheets give teams as short names
// ("NOP"); they're matched to the event's full team names with the list below.
// ====================================================

const CNO_INJURY_LEAGUES = ['NBA', 'WNBA', 'NFL', 'MLB'];

// [short name, city, nickname]; extra short names some sources use are in CNO_TEAM_ALIASES
const CNO_TEAMS = {
  NBA: [['ATL', 'Atlanta', 'Hawks'], ['BKN', 'Brooklyn', 'Nets'], ['BOS', 'Boston', 'Celtics'], ['CHA', 'Charlotte', 'Hornets'],
    ['CHI', 'Chicago', 'Bulls'], ['CLE', 'Cleveland', 'Cavaliers'], ['DAL', 'Dallas', 'Mavericks'], ['DEN', 'Denver', 'Nuggets'],
    ['DET', 'Detroit', 'Pistons'], ['GSW', 'Golden State', 'Warriors'], ['HOU', 'Houston', 'Rockets'], ['IND', 'Indiana', 'Pacers'],
    ['LAC', 'Los Angeles', 'Clippers'], ['LAL', 'Los Angeles', 'Lakers'], ['MEM', 'Memphis', 'Grizzlies'], ['MIA', 'Miami', 'Heat'],
    ['MIL', 'Milwaukee', 'Bucks'], ['MIN', 'Minnesota', 'Timberwolves'], ['NOP', 'New Orleans', 'Pelicans'], ['NYK', 'New York', 'Knicks'],
    ['OKC', 'Oklahoma City', 'Thunder'], ['ORL', 'Orlando', 'Magic'], ['PHI', 'Philadelphia', '76ers'], ['PHX', 'Phoenix', 'Suns'],
    ['POR', 'Portland', 'Trail Blazers'], ['SAC', 'Sacramento', 'Kings'], ['SAS', 'San Antonio', 'Spurs'], ['TOR', 'Toronto', 'Raptors'],
    ['UTA', 'Utah', 'Jazz'], ['WAS', 'Washington', 'Wizards']],
  WNBA: [['ATL', 'Atlanta', 'Dream'], ['CHI', 'Chicago', 'Sky'], ['CON', 'Connecticut', 'Sun'], ['DAL', 'Dallas', 'Wings'],
    ['GSV', 'Golden State', 'Valkyries'], ['IND', 'Indiana', 'Fever'], ['LVA', 'Las Vegas', 'Aces'], ['LAS', 'Los Angeles', 'Sparks'],
    ['MIN', 'Minnesota', 'Lynx'], ['NYL', 'New York', 'Liberty'], ['PHO', 'Phoenix', 'Mercury'], ['PDX', 'Portland', 'Fire'],
    ['SEA', 'Seattle', 'Storm'], ['TOR', 'Toronto', 'Tempo'], ['WAS', 'Washington', 'Mystics']],
  NFL: [['ARI', 'Arizona', 'Cardinals'], ['ATL', 'Atlanta', 'Falcons'], ['BAL', 'Baltimore', 'Ravens'], ['BUF', 'Buffalo', 'Bills'],
    ['CAR', 'Carolina', 'Panthers'], ['CHI', 'Chicago', 'Bears'], ['CIN', 'Cincinnati', 'Bengals'], ['CLE', 'Cleveland', 'Browns'],
    ['DAL', 'Dallas', 'Cowboys'], ['DEN', 'Denver', 'Broncos'], ['DET', 'Detroit', 'Lions'], ['GB', 'Green Bay', 'Packers'],
    ['HOU', 'Houston', 'Texans'], ['IND', 'Indianapolis', 'Colts'], ['JAX', 'Jacksonville', 'Jaguars'], ['KC', 'Kansas City', 'Chiefs'],
    ['LAC', 'Los Angeles', 'Chargers'], ['LAR', 'Los Angeles', 'Rams'], ['LV', 'Las Vegas', 'Raiders'], ['MIA', 'Miami', 'Dolphins'],
    ['MIN', 'Minnesota', 'Vikings'], ['NE', 'New England', 'Patriots'], ['NO', 'New Orleans', 'Saints'], ['NYG', 'New York', 'Giants'],
    ['NYJ', 'New York', 'Jets'], ['PHI', 'Philadelphia', 'Eagles'], ['PIT', 'Pittsburgh', 'Steelers'], ['SEA', 'Seattle', 'Seahawks'],
    ['SF', 'San Francisco', '49ers'], ['TB', 'Tampa Bay', 'Buccaneers'], ['TEN', 'Tennessee', 'Titans'], ['WAS', 'Washington', 'Commanders']],
  MLB: [['AZ', 'Arizona', 'Diamondbacks'], ['ATL', 'Atlanta', 'Braves'], ['BAL', 'Baltimore', 'Orioles'], ['BOS', 'Boston', 'Red Sox'],
    ['CHC', 'Chicago', 'Cubs'], ['CWS', 'Chicago', 'White Sox'], ['CIN', 'Cincinnati', 'Reds'], ['CLE', 'Cleveland', 'Guardians'],
    ['COL', 'Colorado', 'Rockies'], ['DET', 'Detroit', 'Tigers'], ['HOU', 'Houston', 'Astros'], ['KC', 'Kansas City', 'Royals'],
    ['LAA', 'Los Angeles', 'Angels'], ['LAD', 'Los Angeles', 'Dodgers'], ['MIA', 'Miami', 'Marlins'], ['MIL', 'Milwaukee', 'Brewers'],
    ['MIN', 'Minnesota', 'Twins'], ['NYM', 'New York', 'Mets'], ['NYY', 'New York', 'Yankees'], ['ATH', '', 'Athletics'],
    ['PHI', 'Philadelphia', 'Phillies'], ['PIT', 'Pittsburgh', 'Pirates'], ['SD', 'San Diego', 'Padres'], ['SF', 'San Francisco', 'Giants'],
    ['SEA', 'Seattle', 'Mariners'], ['STL', 'St. Louis', 'Cardinals'], ['TB', 'Tampa Bay', 'Rays'], ['TEX', 'Texas', 'Rangers'],
    ['TOR', 'Toronto', 'Blue Jays'], ['WSH', 'Washington', 'Nationals']]
};
const CNO_TEAM_ALIASES = {
  NBA: { NY: 'NYK', GS: 'GSW', SA: 'SAS', NO: 'NOP', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' },
  WNBA: { LV: 'LVA', LA: 'LAS', NY: 'NYL', PHX: 'PHO', CONN: 'CON', WSH: 'WAS', GS: 'GSV' },
  NFL: { WSH: 'WAS', JAC: 'JAX', LA: 'LAR', LVR: 'LV', OAK: 'LV', SD: 'LAC', GNB: 'GB', KAN: 'KC', NWE: 'NE', NOR: 'NO', SFO: 'SF', TAM: 'TB' },
  MLB: { ARI: 'AZ', CHW: 'CWS', WAS: 'WSH', SDP: 'SD', SFG: 'SF', TBR: 'TB', KCR: 'KC', OAK: 'ATH', LV: 'ATH' }
};

function cnoTeamCode(league, code) {
  const c = String(code || '').toUpperCase();
  return (CNO_TEAM_ALIASES[league] && CNO_TEAM_ALIASES[league][c]) || c;
}

function cnoTeamFullName(league, code) {
  const t = (CNO_TEAMS[league] || []).find(x => x[0] === cnoTeamCode(league, code));
  return t ? [t[1], t[2]].filter(Boolean).join(' ') : code;
}

// "Golden State Warriors" -> "GSW" (matched on the nickname, so "LA Clippers" works too)
function cnoTeamFromEventSide(league, side) {
  const norm = (x) => ` ${String(x || '').toLowerCase().replace(/\(#\d+\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const s = norm(side);
  const hit = (CNO_TEAMS[league] || []).find(t => s.includes(norm(t[2])));
  return hit ? hit[0] : null;
}

const CNO_INJURY_ICON_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M12 9v5M9.5 11.5h5"/><path d="M9 17.5h6"/></svg>';

function processEventInjuryIcons() {
  if (!isCnoListPage()) return;
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  if (!table) return;
  const on = typeof userSettings === 'undefined' || userSettings.enableInjuryBadges !== false;
  if (!on) { table.querySelectorAll('.cno-injury-list-btn').forEach(b => b.remove()); return; }
  const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  const leagueIdx = heads.indexOf('league');
  const eventIdx = heads.indexOf('event');
  if (leagueIdx === -1 || eventIdx === -1) return;
  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(row => {
    const cell = row.children[eventIdx];
    const leagueCell = row.children[leagueIdx];
    if (!cell || !leagueCell) return;
    const league = cnoCellText(leagueCell).toUpperCase();
    const existing = cell.querySelector('.cno-injury-list-btn');
    if (!CNO_INJURY_LEAGUES.includes(league)) { if (existing) existing.remove(); return; }
    if (existing) return;
    const btn = createHoverFilterBtn('Injury report for this game', () => cnoOpenInjuryPopup(btn, row, league), CNO_INJURY_ICON_SVG);
    btn.classList.add('cno-injury-list-btn');
    getHoverTray(cell).appendChild(btn);
  });
}

const CNO_INJURY_SEVERITY = { OUT: 0, IL: 0, IR: 0, 'NFI-R': 0, PUP: 0, S: 0, D: 1, Q: 2, GTD: 2, D2D: 2, PROB: 3 };

let cnoInjuryPopup = null;
function cnoCloseInjuryPopup() {
  if (cnoInjuryPopup) cnoInjuryPopup.remove();
  cnoInjuryPopup = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cnoInjuryPopup) cnoCloseInjuryPopup(); });
document.addEventListener('mousedown', (e) => {
  if (cnoInjuryPopup && !cnoInjuryPopup.contains(e.target) && !(e.target.closest && e.target.closest('.cno-injury-list-btn'))) cnoCloseInjuryPopup();
}, true);

function cnoOpenInjuryPopup(btn, row, league) {
  cnoCloseInjuryPopup();
  const table = row.closest('table');
  const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  const cellAt = (name) => { const i = heads.indexOf(name); return i >= 0 ? row.children[i] : null; };
  const eventCell = cellAt('event');
  const link = eventCell && eventCell.querySelector('a');
  const eventText = link ? getCleanCellText(link) : getCleanCellText(eventCell);
  const dateCell = cellAt('date');
  let dateText = '';
  if (dateCell) {
    const day = dateCell.querySelector('.lh-day'), time = dateCell.querySelector('.lh-time');
    dateText = day && time ? `${day.textContent.trim()} · ${time.textContent.trim()}` : getCleanCellText(dateCell).replace(/\s+at\s+/i, ' · ');
  }

  // Teams in the event, in the order shown (away @ home)
  const teams = eventText.split(/\s+(?:@|vs\.?|v)\s+/i).map(sd => ({ side: sd.trim(), code: cnoTeamFromEventSide(league, sd) }));

  // Everyone on the injury sheets for those teams
  const byTeam = {};
  const haveTeams = typeof injuryDataMap !== 'undefined' && Array.from(injuryDataMap.values()).some(v => v && v.team !== undefined);
  if (haveTeams) {
    injuryDataMap.forEach((v, key) => {
      if (!key.startsWith(`${league}|`) || !v || !v.team) return;
      const code = cnoTeamCode(league, v.team);
      if (teams.some(t => t.code === code)) (byTeam[code] = byTeam[code] || []).push(v);
    });
  }

  const el = cnoSharpEl('div', 'cno-sharp-popup cno-injury-popup');
  el.setAttribute('role', 'dialog');
  const head = cnoSharpEl('div', 'cno-sharp-head');
  head.appendChild(cnoSharpEl('span', 'cno-sharp-title', 'Injury report'));
  head.appendChild(cnoSharpEl('span', 'cno-sharp-tag', league));
  head.appendChild(cnoSharpEl('span', 'cno-sharp-spacer'));
  const close = cnoSharpEl('button', 'cno-sharp-iconbtn', '✕');
  close.type = 'button';
  close.title = 'Close';
  close.addEventListener('click', cnoCloseInjuryPopup);
  head.appendChild(close);
  el.appendChild(head);
  el.appendChild(cnoSharpEl('div', 'cno-sharp-event', [eventText, dateText].filter(Boolean).join('  ·  ')));
  if (!haveTeams) el.appendChild(cnoSharpEl('div', 'cno-sharp-loading', 'The injury report is still loading. Try again in a moment.'));

  teams.forEach(t => {
    const list = (t.code && byTeam[t.code]) || [];
    const th = cnoSharpEl('div', 'cno-inj-team');
    th.appendChild(cnoSharpEl('span', '', t.code ? cnoTeamFullName(league, t.code) : t.side));
    th.appendChild(cnoSharpEl('span', 'cno-inj-count', t.code ? (list.length ? `${list.length} listed` : '') : 'team not recognized'));
    el.appendChild(th);
    if (!t.code || !haveTeams) return;
    if (!list.length) { el.appendChild(cnoSharpEl('div', 'cno-inj-none', 'No one listed')); return; }
    list.sort((a, b) => ((CNO_INJURY_SEVERITY[a.status] ?? 4) - (CNO_INJURY_SEVERITY[b.status] ?? 4)) || String(a.rawName).localeCompare(String(b.rawName)))
      .forEach(p => {
        const r = cnoSharpEl('div', 'cno-inj-row');
        r.appendChild(cnoSharpEl('span', 'cno-inj-name', p.rawName));
        r.appendChild(cnoSharpEl('span', 'cno-inj-pos', p.pos || ''));
        const info = (typeof STATUS_MAP !== 'undefined' && STATUS_MAP[p.status]) || null;
        const badge = cnoSharpEl('span', 'cno-inj-badge', info ? info.label : (p.rawStatus || p.status));
        badge.style.background = info ? info.bg : '#64748b';
        r.appendChild(badge);
        const ret = p.returnDate && !/^[\s-]*$/.test(p.returnDate) ? `back ${p.returnDate}` : '';
        r.appendChild(cnoSharpEl('span', 'cno-inj-detail', [p.injury, ret].filter(Boolean).join(' · ')));
        el.appendChild(r);
      });
  });
  const ts = typeof latestInjuryTimestamp !== 'undefined' && latestInjuryTimestamp ? ` · injury report updated ${latestInjuryTimestamp}` : '';
  el.appendChild(cnoSharpEl('div', 'cno-sharp-foot', `Worst status first${ts}`));

  document.body.appendChild(el);
  el._anchor = btn;
  cnoInjuryPopup = el;
  cnoPlaceSharpPopup(el, btn);
}

// ====================================================
// CLOSE THE SHARP FV AND INJURY REPORT POPUPS ON UPDATE
// Right when Update / Refresh is clicked (or its shortcut), and as a backstop whenever the row
// a popup belongs to is gone (CNO redrew the table).
// ====================================================

function cnoCloseRowPopups() {
  if (typeof cnoCloseSharpPopup === 'function') cnoCloseSharpPopup();
  cnoCloseInjuryPopup();
}

document.addEventListener('click', (e) => {
  const t = e.target && e.target.closest ? e.target.closest('[id*="ButtonUpdate"], #ButtonRefresh, #ButtonRefresh_Faux') : null;
  if (t) cnoCloseRowPopups();
}, true);

// Opened from the Calc popup's "Custom Sharp EV": close it once the Calc popup has closed
function cnoSharpCalcClosed() {
  const st = cnoSharpPopupState;
  if (!st || !st.fromCalc || !st.anchor) return false;
  return !st.anchor.isConnected || st.anchor.offsetParent === null;
}

document.addEventListener('click', () => {
  if (!cnoSharpPopupState || !cnoSharpPopupState.anchor) return;
  setTimeout(() => { if (cnoSharpCalcClosed()) cnoCloseSharpPopup(); }, 50); // after CNO closes its popup
});

function processRowPopupsStillValid() {
  if (cnoSharpPopupState && cnoSharpPopupState.btn && !cnoSharpPopupState.btn.isConnected) cnoCloseSharpPopup();
  if (cnoSharpCalcClosed()) cnoCloseSharpPopup();
  if (cnoInjuryPopup && cnoInjuryPopup._anchor && !cnoInjuryPopup._anchor.isConnected) cnoCloseInjuryPopup();
}

// ====================================================
// CALC POPUP: BOOK NAME LINKS TO THE BET (+ hover QR button)
// The popup's Book ("DraftKings") becomes the same link as the Sportsbook cell of the row the
// popup is for, with a QR button on hover (the QR opens over the popup). Two-bet popups (Low
// Hold, hedge) get it on both books. CNO rewrites the name each time the popup opens, so this
// runs every pass and re-adds the link when needed.
// ====================================================

function processCalcBookLinks() {
  const btn = cnoLastCalcBtn && cnoLastCalcBtn.isConnected ? cnoLastCalcBtn : null;
  const spans = Array.from(document.querySelectorAll('span[id^="PopupCalc"][id$="SportsbookSite"]')).filter(s => s.offsetParent !== null);
  if (!btn || !spans.length) return;
  const row = btn.closest('tr');
  const table = btn.closest('table');
  if (!row || !table) return;
  const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  const bookCol = heads.findIndex(h => h.includes('sportsbook') && !h.startsWith('hedge'));
  const hedgeCol = heads.findIndex(h => h.includes('sportsbook') && h.startsWith('hedge'));
  const nameCol = (hedge) => heads.findIndex(h => h.startsWith('hedge') === hedge && (h === 'bet name' || h === 'bet' || h.endsWith(' name')));
  const oddsCol = (hedge) => heads.findIndex(h => h.startsWith('hedge') === hedge && h !== 'fair odds' && (h === 'odds' || h.endsWith(' odds')));
  const textAt = (i) => (i >= 0 && row.children[i]) ? getCleanCellText(row.children[i]) : '';

  spans.forEach(span => {
    const isHedge = /(^|_)Hedge_/.test(span.id.replace(/^PopupCalc_/, '_')) || /HedgeTab_Hedge/.test(span.id);
    const col = isHedge ? hedgeCol : bookCol;
    const cell = col >= 0 ? row.children[col] : null;
    const link = cell ? (cell.querySelector('a[href*="deeplink.aspx"]') || cell.querySelector('a[href]')) : null;
    const existing = span.querySelector('a.cno-calc-book-link');
    const name = existing ? existing.textContent : span.textContent.trim();
    if (!link || !/^https?:/i.test(link.href) || !name || getCleanCellText(cell) !== name) {
      if (existing) { span.textContent = name; span.classList.remove('cno-calc-book'); }
      return;
    }
    if (existing && existing.getAttribute('href') === link.href) return;

    span.textContent = '';
    span.classList.add('cno-calc-book');
    const a = document.createElement('a');
    a.className = 'cno-calc-book-link';
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = `Open this bet at ${name}`;
    a.textContent = name;
    span.appendChild(a);
    span.appendChild(createQrBtn(a, () => name, () => {
      const popupText = (suffix) => { const el = document.querySelector(`[id^="PopupCalc"][id$="${suffix}"]`); return el ? el.textContent.trim() : ''; };
      return { event: popupText('EventName'), market: popupText('_Market'), betName: textAt(nameCol(isHedge)), odds: extractAmericanOdds(textAt(oddsCol(isHedge))) || textAt(oddsCol(isHedge)) };
    }));
  });
}

// ====================================================
// DEVIGGER PAGE: QR BUTTON NEXT TO "COPY DEVIG'S URL"
// Always visible; shows a QR code of the same link that button copies (CNO keeps it in a hidden
// textarea). Re-added whenever the Devigger redraws its results.
// ====================================================

function processDeviggerQrButton() {
  if (!/sportsbook_devigger\.aspx/i.test(window.location.pathname)) return;
  document.querySelectorAll('button[onclick*="Textbox_DevigsURL"]').forEach(copyBtn => {
    if (copyBtn.nextElementSibling && copyBtn.nextElementSibling.classList.contains('cno-devig-qr')) return;
    const m = (copyBtn.getAttribute('onclick') || '').match(/CopyToClipboard\('([^']+)'\)/);
    const getUrl = () => {
      const box = m ? document.getElementById(m[1]) : null;
      return box ? String(box.value || box.textContent || '').trim() : '';
    };
    const fakeLink = { get href() { return getUrl(); } };
    const qr = createQrBtn(fakeLink, () => 'Devigger link', () => ({}));
    qr.classList.remove('cno-hover-filter-btn'); // always visible here
    qr.classList.add('cno-devig-qr');
    qr.title = "Show a QR code for this devig's link";
    copyBtn.insertAdjacentElement('afterend', qr);
  });
}

// ====================================================
// MLB: "EXCL. WEATHER" (rows only; shown when League is MLB)
// Uses the same Rotowire weather data as the weather icons. Not remembered between page loads
// (it's a per-search choice), but saved filters keep it and Clear Filters resets it.
// ====================================================

let cnoMlbWeatherFilter = 'all'; // 'all' | 'likely' | 'possible' (possible + likely)
const CNO_MLB_WEATHER_OPTIONS = [
  { value: 'all', label: 'Include All' },
  { value: 'likely', label: 'Exclude Likely Delay/Rainout' },
  { value: 'possible', label: 'Exclude Possible and Likely Delay/Rainout' }
];

function createMlbWeatherRow() {
  const row = document.createElement('div');
  row.className = 'cno-field';
  row.id = 'cno-mlb-weather-row';
  row.style.cssText = 'display:none; margin-top:4px;';
  const label = document.createElement('label');
  label.textContent = 'Excl. Weather';
  label.title = 'Hides MLB games that Rotowire flags for a possible or likely delay/rainout. This hides rows CNO already returned; it does not change what CNO searches.';
  const weatherHint = createRowsFilterHint();
  weatherHint.style.marginLeft = '4px'; // room after the text (like Refine: Leagues)
  label.appendChild(weatherHint);
  const select = document.createElement('select');
  select.id = 'cno-mlb-weather-select';
  CNO_MLB_WEATHER_OPTIONS.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    select.appendChild(opt);
  });
  select.value = cnoMlbWeatherFilter;
  select.addEventListener('change', () => setMlbWeatherFilter(select.value));
  row.appendChild(label);
  row.appendChild(select);
  return row;
}

function setMlbWeatherFilter(value) {
  cnoMlbWeatherFilter = CNO_MLB_WEATHER_OPTIONS.some(o => o.value === value) ? value : 'all';
  const select = document.getElementById('cno-mlb-weather-select');
  if (select && select.value !== cnoMlbWeatherFilter) select.value = cnoMlbWeatherFilter;
  processMlbWeatherFilter();
  if (typeof processRowStriping === 'function') processRowStriping();
  if (typeof processHiddenRowsNote === 'function') processHiddenRowsNote();
}

function cnoIsMlbLeagueChosen() {
  const dd = typeof getLeagueDropdown === 'function' ? getLeagueDropdown() : null;
  const opt = dd && dd.options ? dd.options[dd.selectedIndex] : null;
  return !!(opt && opt.textContent.trim().toUpperCase() === 'MLB');
}

function processMlbWeatherFilter() {
  const row = document.getElementById('cno-mlb-weather-row');
  const weatherOn = typeof userSettings === 'undefined' || userSettings.enableMlbWeather !== false;
  const show = !!row && cnoIsMlbLeagueChosen() && weatherOn;
  if (row) {
    const want = show ? 'flex' : 'none';
    if (row.style.display !== want) row.style.display = want;
  }
  const table = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
  const active = show && cnoMlbWeatherFilter !== 'all' && !!table && isCnoListPage();
  if (!active) {
    document.querySelectorAll('.cno-weather-hidden').forEach(el => el.classList.remove('cno-weather-hidden'));
    return;
  }
  const hideFor = cnoMlbWeatherFilter === 'likely' ? ['likely'] : ['possible', 'likely'];
  table.querySelectorAll('tbody tr:not(.footable-row-detail)').forEach(r => {
    const hide = hideFor.includes(r.dataset.cnoWeather);
    r.classList.toggle('cno-weather-hidden', hide);
    const next = r.nextElementSibling;
    if (next && next.classList.contains('footable-row-detail')) next.classList.toggle('cno-weather-hidden', hide);
  });
}

// ====================================================
// LOW HOLD CALC POPUP: "COPY FOR DISCORD"
// Under the popup's last row (ROI), above Close. Stakes are scaled to $100 on the first side
// (said so in the post); the hold / ROI come from the two odds. Links to each bet and to
// TheSpread's hedge calculator, filled in with the same stake and odds.
// ====================================================

const CNO_LH_ODDS_A_ID = 'ContentPlaceHolderMain_ContentPlaceHolderRight_TextBoxPopupCalc_LowHold_BetOdds';
const CNO_LH_ODDS_B_ID = 'ContentPlaceHolderMain_ContentPlaceHolderRight_TextBoxPopupCalc_Hedge_BetOdds';

function processLowHoldShare() {
  const oddsA = document.getElementById(CNO_LH_ODDS_A_ID);
  if (!oddsA || oddsA.offsetParent === null) return;
  const table = oddsA.closest('table');
  if (!table || !table.parentNode) return;
  if (table.nextElementSibling && table.nextElementSibling.classList.contains('cno-calc-share')) return;
  const wrap = cnoSharpEl('div', 'cno-calc-share');
  const a = cnoSetIconLabel(cnoSharpEl('a', 'cno-sharp-open cno-calc-share-btn'), 'discord', 'Copy for Discord');
  a.href = '#';
  a.title = 'Copy this low hold as a Discord post (per $100 on the first side)';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const done = (ok) => {
      cnoSetIconLabel(a, 'discord', ok ? 'Copied ✓' : 'Copy failed');
      setTimeout(() => { if (a.isConnected) cnoSetIconLabel(a, 'discord', 'Copy for Discord'); }, 1600);
    };
    const text = cnoLowHoldShareText();
    if (!text) { done(false); return; }
    try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (err) { done(false); }
  });
  wrap.appendChild(a);
  table.parentNode.insertBefore(wrap, table.nextSibling);
}

// American odds as a "numerator-denominator" decimal-odds fraction (TheSpread's link format)
function cnoSpreadOddsToken(am) {
  const n = Number(String(am).replace('+', ''));
  if (!isFinite(n) || Math.abs(n) < 100) return '';
  const scale = Number.isInteger(n) ? 1 : 100;
  const x = Math.round(Math.abs(n) * scale), h = 100 * scale;
  return n > 0 ? `${x + h}-${h}` : `${x + h}-${x}`;
}

function cnoLowHoldShareText() {
  const byId = (id) => document.getElementById(`ContentPlaceHolderMain_ContentPlaceHolderRight_${id}`) || document.getElementById(id);
  const text = (id) => { const el = byId(id); return el ? (typeof getCleanCellText === 'function' ? getCleanCellText(el) : el.textContent).replace(/\s+/g, ' ').trim() : ''; };
  const inA = document.getElementById(CNO_LH_ODDS_A_ID), inB = document.getElementById(CNO_LH_ODDS_B_ID);
  if (!inA || !inB) return '';
  const oddsA = cnoShareSignedOdds(inA.value.trim()), oddsB = cnoShareSignedOdds(inB.value.trim());
  const dA = americanToDecimal(oddsA.replace('+', '')), dB = americanToDecimal(oddsB.replace('+', ''));
  if (!dA || !dB) return '';

  // Per $100 on the first side
  const stakeA = 100, stakeB = stakeA * dA / dB;
  const payout = stakeA * dA, cost = stakeA + stakeB, profit = payout - cost, roi = profit / cost;
  const hold = 1 / dA + 1 / dB - 1;
  const money = (n) => cnoFmtMoney(Math.round(n * 100) / 100).replace(/\.00$/, '');
  const pct2 = (x) => `${(x * 100).toFixed(2)}%`;

  const linkOf = (spanId) => { const el = byId(spanId); const l = el && el.querySelector('a.cno-calc-book-link'); return l ? l.href : ''; };
  const side = (pre, odds, stake) => {
    const book = text(`PopupCalc_${pre}_SportsbookSite`).replace(/\s*\([^)]*\)\s*$/, '');
    const title = `${text(`PopupCalc_${pre}_BetName`)} ${odds}`.trim().replace(/[[\]]/g, '');
    const url = linkOf(`PopupCalc_${pre}_SportsbookSite`);
    return `${book ? book + ': ' : ''}${url ? `**[${title}](<${url}>)**` : `**${title}**`} · ${money(stake)}`;
  };

  const lines = [roi > 0 ? `## Arb: **+${pct2(roi)} ROI**` : `## Low Hold: **${pct2(hold)}**`];
  const sub = [text('PopupCalc_EventName'), text('PopupCalc_Market'), cnoShareWhen(text('PopupCalc_Date'))].filter(Boolean).join(' | ');
  if (sub) lines.push(sub);
  lines.push('', side('LowHold', oddsA, stakeA), side('Hedge', oddsB, stakeB), '-# Stakes per $100 on the first side', '');
  lines.push(`Payout ${money(payout)} · Cost ${money(cost)} · **Profit ${money(profit)} (ROI ${roi > 0 ? '+' : ''}${pct2(roi)})**`);
  const o = cnoSpreadOddsToken(oddsA), h = cnoSpreadOddsToken(oddsB);
  if (o && h) lines.push('', `[Open in Hedge Calculator](<https://www.thespread.com/betting-tools/hedge-calculator/#f=a&m=eq&s=${stakeA}&o=${o}&h=${h}>)`);
  lines.push('', `-# Generated by [CNO's Little Helper](<${CNO_LH_SITE_URL}>)`);
  return lines.join('\n');
}

// ====================================================
// SITE MENU: OPEN ON HOVER
// The top menu's General / Tools / Calculators open on click (the site toggles "submenu-active").
// With a mouse on the full-width layout, they open on hover instead, using the site's own class
// (so they look the same) and close a moment after the pointer leaves. A click on the heading
// while it's hover-opened leaves it open. Phones / narrow layouts keep the site's click menu.
// ====================================================

(function cnoSetupHoverMenus() {
  // Full-width layout: the site hides its hamburger (.toggle) there; on the phone layout it shows
  const isWide = () => {
    const t = document.querySelector('nav ul.menu > li.toggle');
    return !t || getComputedStyle(t).display === 'none';
  };
  const setup = () => {
    const menu = document.querySelector('nav ul.menu');
    if (!menu || menu.dataset.cnoHover) return;
    menu.dataset.cnoHover = '1';
    menu.querySelectorAll(':scope > li.has-submenu').forEach(item => {
      let timer = null;
      item.addEventListener('mouseenter', () => {
        if (!isWide()) return;
        clearTimeout(timer);
        menu.querySelectorAll(':scope > li.submenu-active').forEach(o => { if (o !== item) o.classList.remove('submenu-active'); });
        item.classList.add('submenu-active');
        item.dataset.cnoHoverOpen = '1';
      });
      item.addEventListener('mouseleave', () => {
        if (!item.dataset.cnoHoverOpen) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          item.classList.remove('submenu-active');
          delete item.dataset.cnoHoverOpen;
        }, 250); // time to cross the gap down to the submenu
      });
      // The site's click toggle would close a hover-opened menu: skip it for the heading itself
      item.addEventListener('click', (e) => {
        if (!item.dataset.cnoHoverOpen || !item.classList.contains('submenu-active')) return;
        if (e.target.closest('.submenu')) return; // links in the submenu work as normal
        e.stopImmediatePropagation();
      }, true);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
