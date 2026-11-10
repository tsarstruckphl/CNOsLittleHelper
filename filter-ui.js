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

  if (targetPage.includes('odds-boost.aspx')) {
    params.set('profit_strategy', '1');
  }

  const baseUrl = targetPage.includes('odds-boost.aspx') 
    ? '/site/tools/odds-boost.aspx' 
    : '/site/tools/positive-ev.aspx';

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
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

  const isClassic = localStorage.getItem('cno_use_classic_view') === 'true';

  let crossToolBtn = document.getElementById('cno-cross-tool-btn');
  if (isPosEvPage || isOddsBoostPage) {
    if (!crossToolBtn) {
      crossToolBtn = document.createElement('button');
      crossToolBtn.id = 'cno-cross-tool-btn';
      crossToolBtn.type = 'button';
    }

    crossToolBtn.style.cssText = `
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

    crossToolBtn.textContent = isPosEvPage ? '🚀 Switch to Odds Boost' : '🎲 Switch to Positive EV';

    crossToolBtn.onclick = (e) => {
      e.stopPropagation();
      const targetPage = isPosEvPage ? '/site/tools/odds-boost.aspx' : '/site/tools/positive-ev.aspx';
      const container = getFilterAccordionContainer() || document;
      const targetUrl = buildCrossToolUrl(targetPage, container);
      window.location.href = targetUrl;
    };

    if (!btnGroup.contains(crossToolBtn)) {
      btnGroup.appendChild(crossToolBtn);
    }
  } else if (crossToolBtn) {
    crossToolBtn.remove();
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