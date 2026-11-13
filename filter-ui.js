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
  const elBetContains = document.querySelector('[id$="TextBoxBetNameContains"]');
  const elExcludeCb = document.querySelector('#cno-exclude-injured-cb');

  if (elBetContains) {
    const currentVal = elBetContains.value;

    if (elExcludeCb && elExcludeCb.checked && !elExcludeCb.disabled) {
      if (sessionStorage.getItem(BET_CONTAINS_STORAGE_KEY) === null) {
        sessionStorage.setItem(BET_CONTAINS_STORAGE_KEY, currentVal);
      }
      const selectedCategory = getSelectedLeagueName(container);
      const names = typeof getInjuredPlayerNames === 'function' ? getInjuredPlayerNames(selectedCategory, 'full') : [];
      elBetContains.value = buildExcludeInjuredSyntax(sessionStorage.getItem(BET_CONTAINS_STORAGE_KEY), names);
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

function updateExcludeInjuredCheckboxState(container = document) {
  const cb = container.querySelector('#cno-exclude-injured-cb') || document.querySelector('#cno-exclude-injured-cb');
  const cbWrap = container.querySelector('.cno-exclude-injured-wrapper') || document.querySelector('.cno-exclude-injured-wrapper');
  if (!cb || !cbWrap) return;

  const isEligible = isEligibleInjuryLeagueSelected(container);
  const disabledTooltip = "Select MLB, NBA, NFL, or WNBA from league to enable; right-click to filter to only injured players";
  const enabledTooltip = "Right-click to filter to filter to only injured players";

  if (!isEligible) {
    cb.checked = false;
    cb.disabled = true;
    cbWrap.title = disabledTooltip;
    cbWrap.style.opacity = '0.5';
    cbWrap.style.cursor = 'not-allowed';
    cb.style.cursor = 'not-allowed';
  } else {
    cb.disabled = false;
    cbWrap.title = enabledTooltip;
    cbWrap.style.opacity = '1.0';
    cbWrap.style.cursor = 'pointer';
    cb.style.cursor = 'pointer';
  }
}

function updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookWrapper, hedgeMainWrapper, sortByWrapper = null) {
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
  const hasBoost = destKey === 'odds-boost';
  const hasReward = ['risk-free-bet', 'win-and-get', 'bet-and-get'].includes(destKey);

  // Only carry over fields the destination page actually has
  if (hasBoost) {
    const boostTypeEl = document.querySelector('input[name$="RadioButtonListOddsBoostType"]:checked');
    if (boostTypeEl && boostTypeEl.value) params.set('boost_type', boostTypeEl.value.trim());

    const pctEl = getEl('TextBoxBoostPercentage') || (document.getElementById('spanBoostPercentage') || document).querySelector('input[type="text"]');
    const oddsEl = getEl('TextBoxBoostOdds') || (document.getElementById('spanBoostOdds') || document).querySelector('input[type="text"]');
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
  { key: 'positive-ev', label: 'Positive EV', icon: '🎲' },
  { key: 'odds-boost', label: 'Odds Boost', icon: '🚀' },
  { key: 'free-bet-converter', label: 'Free Bet', icon: '🎁' },
  { key: 'risk-free-bet', label: 'Risk Free Bet', icon: '🛡️' },
  { key: 'bet-and-get', label: 'Bet and Get', icon: '🎟️' },
  { key: 'win-and-get', label: 'Win and Get', icon: '🏆' },
  { key: 'low-hold', label: 'Low Hold', icon: '📉' }
];

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
      item.textContent = `${p.icon} ${p.label}`;
      item.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; padding:7px 10px; font-size:0.85rem; font-weight:600; color:#0369a1; cursor:pointer; border-radius:4px; white-space:nowrap;';
      item.addEventListener('mouseover', () => item.style.background = '#f0f9ff');
      item.addEventListener('mouseout', () => item.style.background = 'none');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const container = getFilterAccordionContainer() || document;
        const url = buildCrossToolUrl(`/site/tools/${p.key}.aspx`, container);
        hide();
        window.location.href = url;
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

function clearAllPageFilters(container = document) {
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

  const elTop25Cb = container.querySelector('#cno-top25-cb') || document.querySelector('#cno-top25-cb');
  if (elTop25Cb) {
    elTop25Cb.checked = false;
  }

  const elIsLive = getEl('CheckBoxIsLive');
  if (elIsLive) {
    elIsLive.checked = false;
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
    const isClassic = localStorage.getItem('cno_use_classic_view') === 'true';

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

  const isClassic = localStorage.getItem('cno_use_classic_view') === 'true';

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
      switchBtn.textContent = '🔀 Switch Page ▾';
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

  toggleBtn.textContent = isClassic ? '⚡ Switch to Enhanced View' : '📜 Switch to Classic View';

  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    const currentlyClassic = localStorage.getItem('cno_use_classic_view') === 'true';
    const newClassicState = !currentlyClassic;
    localStorage.setItem('cno_use_classic_view', newClassicState.toString());

    const container = getFilterAccordionContainer() || 
                      document.getElementById('cno-markets-filter-wrapper') || 
                      document.getElementById('cno-games-filter-wrapper');
    if (container) {
      delete container.dataset.restyled;
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
    optionsBtn.textContent = '⚙️ CNO LH Options';
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
  if (container.dataset.originalHTML) {
    container.innerHTML = container.dataset.originalHTML;
  }

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
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT') {
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
      const cbWrap = document.createElement('label');
      cbWrap.className = 'cno-exclude-injured-wrapper';
      cbWrap.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        font-size: 0.76rem !important;
        font-weight: 600 !important;
        color: #334155 !important;
        line-height: 1.1;
        width: 105px;
        flex-shrink: 0;
        user-select: none;
        margin-left: 2px;
      `;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'cno-exclude-injured-cb';
      cb.checked = false;
      cb.style.cssText = 'width: 14px; height: 14px; accent-color: #0284c7; cursor: pointer; flex-shrink: 0; margin: 0;';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = 'Exclude Injured Players (slow)';
      labelSpan.style.cssText = 'display: inline-block; word-break: break-word;';

      cbWrap.appendChild(cb);
      cbWrap.appendChild(labelSpan);

      const triggerInjuredContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isEligibleInjuryLeagueSelected(container)) {
          return;
        }

        const existingMenu = document.getElementById('cno-injured-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'cno-injured-context-menu';
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
          min-width: 260px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        const createMenuItem = (title, mode) => {
          const item = document.createElement('div');
          item.textContent = title;
          item.style.cssText = `
            padding: 6px 12px;
            color: #0369a1;
            font-weight: 600;
            font-size: 0.82rem;
            cursor: pointer;
            user-select: none;
          `;

          item.addEventListener('mouseover', () => item.style.background = '#f0f9ff');
          item.addEventListener('mouseout', () => item.style.background = 'transparent');

          item.addEventListener('click', () => {
            const selectedCategory = getSelectedLeagueName(container);
            const names = typeof getInjuredPlayerNames === 'function' ? getInjuredPlayerNames(selectedCategory, mode) : [];
            inputEl.value = buildInjectInjuredSyntax(inputEl.value, names);
            menu.remove();
          });

          return item;
        };

        menu.appendChild(createMenuItem('Filter to only injured players by last name', 'last'));
        menu.appendChild(createMenuItem('Filter to only injured players by full name', 'full'));
        document.body.appendChild(menu);

        const closeMenu = (evt) => {
          if (!menu.contains(evt.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 50);
      };

      cbWrap.addEventListener('contextmenu', triggerInjuredContextMenu);
      cb.addEventListener('contextmenu', triggerInjuredContextMenu);

      inputRow.appendChild(cbWrap);
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

  if (localStorage.getItem('cno_use_classic_view') === 'true') {
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

    if (elSortByFB) {
      const currVal = elSortByFB.value || "1";
      elSortByFB.options.length = 0;
      const opt1 = new Option("Conversion%", "1");
      const opt2 = new Option("EV%", "2");
      elSortByFB.add(opt1);
      elSortByFB.add(opt2);
      elSortByFB.value = currVal;
    }

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

    updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookLabel, hedgeMainLabel, sortByWrapper);

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

    updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookLabel, hedgeMainLabel);

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

  updateProfitStrategyHedgeVisibility(elProfitStrategy, sameBookLabel, null);

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

  ['DropDownListSportsbookSite_All', 'DropDownListSportsbookSite_NonDFS', 'DropDownListSport', 'DropDownListLeague'].forEach(suffix => {
    const el = getEl(suffix);
    if (el && el.selectedIndex >= 0) {
      const opt = el.options[el.selectedIndex];
      sel.selects[suffix] = { value: opt.value, text: opt.text.trim() };
    }
  });

  [
    'TextBoxMinimumOdds', 'TextBoxMaximumOdds', 'TextBoxEventNameContains', 'TextBoxMaximumDateHours',
    'TextBoxMarketNameContains', 'TextBoxBetNameContains', 'TextBoxMinimumBetPoints', 'TextBoxMaximumBetPoints',
    'TextBoxReward', 'TextBoxFreeCreditConversionRate'
  ].forEach(suffix => {
    const el = getEl(suffix);
    if (el) sel.texts[suffix] = el.value;
  });

  // Save the user's own text, not the injected injured-player / Top 25 syntax
  const excludeCb = document.querySelector('#cno-exclude-injured-cb');
  const top25Cb = document.querySelector('#cno-top25-cb');

  if (sel.texts.TextBoxBetNameContains !== undefined && excludeCb && excludeCb.checked) {
    const raw = sessionStorage.getItem(BET_CONTAINS_STORAGE_KEY);
    if (raw !== null) sel.texts.TextBoxBetNameContains = raw;
  }
  if (sel.texts.TextBoxEventNameContains !== undefined && top25Cb && top25Cb.checked) {
    const raw = sessionStorage.getItem(AP_TOP25_STORAGE_KEY);
    if (raw !== null) sel.texts.TextBoxEventNameContains = raw;
  }

  const elLive = getEl('CheckBoxIsLive');
  if (elLive) sel.checks.live = elLive.checked;
  if (excludeCb) sel.checks.excludeInjured = excludeCb.checked;
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

function applyFilterSelections(container, sel) {
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
    DropDownListLeague: 'League'
  };
  // Sportsbook first, then Sport, then League (sport/league are mutually exclusive)
  ['DropDownListSportsbookSite_All', 'DropDownListSportsbookSite_NonDFS', 'DropDownListSport', 'DropDownListLeague'].forEach(suffix => {
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

  const excludeCb = document.querySelector('#cno-exclude-injured-cb');
  if (excludeCb && checks.excludeInjured !== undefined) {
    if (checks.excludeInjured && excludeCb.disabled) {
      failures.push('Exclude Injured Players (league not eligible)');
      excludeCb.checked = false;
    } else {
      excludeCb.checked = !!checks.excludeInjured;
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
    <h3 style="margin:0; font-size:1.05rem; color:#0284c7; font-weight:700;">${titleHtml}</h3>
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
  const { modal, body, close } = createSavedFilterModal('🔍 Choose Existing Filter', 440, 1000000);

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

  const { modal, body, close } = createSavedFilterModal('💾 Save Filter', 440);
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
  const saveBtn = makeSavedFilterModalBtn('💾 Save', 'primary');
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
        page[keyName] = { savedAt: Date.now(), selections: collectFilterSelections(container) };
        all[pageKey] = page;
        writeSavedFilters(all, () => {
          close();
          showSavedFilterToast(`Saved "${keyName}"`);
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

  const { modal, body, close } = createSavedFilterModal('📂 Apply Filters', 480);
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
      delBtn.textContent = '🗑️';
      delBtn.style.cssText = 'background:none; border:none; padding:8px 12px; font-size:1rem; cursor:pointer; flex-shrink:0;';
      delBtn.addEventListener('mouseover', () => delBtn.style.background = '#fee2e2');
      delBtn.addEventListener('mouseout', () => delBtn.style.background = 'none');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteByName(name);
      });

      const transferBtn = document.createElement('button');
      transferBtn.type = 'button';
      transferBtn.title = 'Copy to another page';
      transferBtn.textContent = '⇄';
      transferBtn.style.cssText = 'background:none; border:none; padding:8px 12px; font-size:1.1rem; font-weight:bold; color:#0369a1; cursor:pointer; flex-shrink:0;';
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
          { label: '✏️ Rename', onClick: () => renameByName(name) }
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
    btn.textContent = item.label;
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
  const { modal, body, close } = createSavedFilterModal('✏️ Rename Filter Selection', 420, 1000000);

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
  const { modal, body, close } = createSavedFilterModal('⇄ Copy to Another Page', 400, 1000000);

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
    applyBtn.textContent = '📂 Apply Filters';
    applyBtn.onclick = (e) => {
      e.stopPropagation();
      openApplyFilterModal(getFilterAccordionContainer() || document);
    };
  }

  let saveBtn = document.getElementById('cno-save-filters-btn');
  if (!saveBtn) {
    saveBtn = document.createElement('button');
    saveBtn.id = 'cno-save-filters-btn';
    saveBtn.type = 'button';
    // ~half a button of extra space before Clear Filters (plus the group's 6px gap)
    saveBtn.style.cssText = SAVED_FILTER_BTN_CSS + ' margin-right: 44px;';
    saveBtn.textContent = '💾 Save Filter';
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

function cnoShowUpdateHint(btn) {
  cnoHideUpdateHint();

  const tip = document.createElement('div');
  tip.id = 'cno-update-hint';
  tip.textContent = `Shortcut: ${cnoUpdateShortcutLabel()}`;
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
  const el = e.target && e.target.closest ? e.target.closest('input[type="submit"]') : null;
  if (el && el.id && el.id.endsWith(CNO_UPDATE_BUTTON_ID_SUFFIX)) return el;
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

const EVENT_FILTER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="display:block;"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5L3 4z"/></svg>`;

function getCleanEventText(link) {
  const clone = link.cloneNode(true);
  clone.querySelectorAll('.cno-ap-rank, .cno-weather-badge, .cno-injury-badge, .cno-badge, .cno-event-filter-btn').forEach(el => el.remove());
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

function processEventFilterIcons() {
  if (!document.querySelector('[id$="TextBoxEventNameContains"]')) return;

  document.querySelectorAll('a[href*="game.aspx"]').forEach(link => {
    if (!link.textContent.includes('@')) return;
    if (link.closest('#cno-update-banner-alert')) return;

    const next = link.nextElementSibling;
    if (next && next.classList && next.classList.contains('cno-event-filter-btn')) return;

    const btn = document.createElement('span');
    btn.className = 'cno-event-filter-btn';
    btn.setAttribute('role', 'button');
    btn.title = 'Filter to this event';
    btn.innerHTML = EVENT_FILTER_ICON_SVG;
    btn.style.cssText = 'display:inline-flex; align-items:center; vertical-align:middle; margin-left:5px; padding:2px; color:#0284c7; cursor:pointer; border-radius:3px;';
    btn.addEventListener('mouseover', () => { btn.style.background = '#e0f2fe'; });
    btn.addEventListener('mouseout', () => { btn.style.background = 'none'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyEventFilter(getCleanEventText(link));
    });

    link.insertAdjacentElement('afterend', btn);
  });
}
