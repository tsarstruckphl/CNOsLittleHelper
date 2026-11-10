// ====================================================
// IMMEDIATE FOUC PREVENTION (TOP-LEVEL INJECTION)
// ====================================================
(function injectEarlyFoucStyles() {
  if (document.getElementById('cno-fouc-style')) return;
  const style = document.createElement('style');
  style.id = 'cno-fouc-style';
  style.textContent = `
    /* Instantly hide filter panes across accordion and markets page until cno-ready is attached */
    #ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion > div:first-of-type .accordionContent:not(.cno-ready),
    #ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion > div:nth-child(3) .accordionContent:not(.cno-ready),
    #cno-markets-filter-wrapper:not(.cno-ready),
    #cno-games-filter-wrapper:not(.cno-ready) {
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
})();

// ====================================================
// SETTINGS & CONFIGURATION
// ====================================================

let userSettings = {
  enableApRankings: true,
  enableInjuryBadges: true,
  enableMlbWeather: true,
  enableFilterModernization: true,
  enablePctBadges: true
};

function refreshUserSettings(callback) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({
      enableApRankings: true,
      enableInjuryBadges: true,
      enableMlbWeather: true,
      enableFilterModernization: true,
      enablePctBadges: true
    }, (items) => {
      userSettings = items;
      if (callback) callback();
    });
  } else {
    if (callback) callback();
  }
}

function getFilterAccordionContainer() {
  const accordion = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_MyAccordion');
  if (accordion) {
    return accordion.querySelector('.accordionContent');
  }
  return document.querySelector('.accordionContent');
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes) => {
    let needsFilterReset = false;

    for (let [key, { newValue }] of Object.entries(changes)) {
      if (key in userSettings) {
        userSettings[key] = newValue !== undefined ? newValue : true;
        if (key === 'enableFilterModernization') {
          needsFilterReset = true;
        }
      }
    }

    if (!userSettings.enableApRankings) {
      document.querySelectorAll('.cno-ap-rank').forEach(el => el.remove());
      document.querySelectorAll('[data-has-ap-ranked]').forEach(el => delete el.dataset.hasApRanked);
    }

    if (needsFilterReset && !userSettings.enableFilterModernization) {
      const container = getFilterAccordionContainer();
      if (container && container.dataset.originalHTML) {
        container.innerHTML = container.dataset.originalHTML;
        delete container.dataset.restyled;
        container.classList.add('cno-ready');
      }
    }

    if (!userSettings.enablePctBadges) {
      document.querySelectorAll('.cno-badge').forEach(el => el.remove());
      document.querySelectorAll('[data-converted]').forEach(el => delete el.dataset.converted);
    }

    if (!userSettings.enableInjuryBadges) {
      document.querySelectorAll('.cno-injury-badge').forEach(el => el.remove());
    }

    if (!userSettings.enableMlbWeather) {
      document.querySelectorAll('.cno-weather-badge').forEach(el => el.remove());
      document.querySelectorAll('[data-has-weather]').forEach(el => delete el.dataset.hasWeather);
    }

    if (typeof runAll === 'function') runAll();
  });
}

// ====================================================
// HELPER & CONVERSION FUNCTIONS
// ====================================================

function americanToPercentage(americanOdds) {
  if (!americanOdds) return null;
  
  const match = String(americanOdds).match(/([+-]\d+)/);
  if (!match) return null;

  const odds = parseFloat(match[1]);
  if (isNaN(odds)) return null;

  let prob = 0;
  if (odds > 0) {
    prob = 100 / (odds + 100);
  } else if (odds < 0) {
    prob = Math.abs(odds) / (Math.abs(odds) + 100);
  } else {
    return null;
  }

  return (prob * 100).toFixed(1);
}

function percentageToAmerican(pctVal) {
  const prob = parseFloat(pctVal);
  if (isNaN(prob) || prob <= 0 || prob >= 100) return null;

  let american;
  if (prob >= 50) {
    american = Math.round(- (prob / (100 - prob)) * 100);
  } else {
    american = Math.round(+ ((100 - prob) / prob) * 100);
  }

  return american > 0 ? `+${american}` : `${american}`;
}

function calculatePreCommissionPct(netPctVal) {
  const pNet = parseFloat(netPctVal) / 100;
  if (isNaN(pNet) || pNet <= 0 || pNet >= 1) return null;

  const pPre = (0.98 * pNet) / (1 - 0.02 * pNet);
  return (pPre * 100).toFixed(1);
}

function createBadgeInput(percentage, isProphetX = false) {
  let titleAttr = '';
  if (isProphetX) {
    const preComm = calculatePreCommissionPct(percentage);
    if (preComm) titleAttr = ` title="${preComm}% pre-commission"`;
  }
  return `<input class="cno-badge cno-badge-input" type="text" value="${percentage}%"${titleAttr} style="background:#f1f5f9; color:#475569; padding:1px 4px; border-radius:3px; font-size:0.85em; font-weight:500; margin-left:4px; display:inline-block; border:1px solid #e2e8f0; width:48px; text-align:center; outline:none;" />`;
}

function createBadgeStatic(percentage, isCompact = false, isProphetX = false) {
  const paddingStyle = isCompact ? 'padding:0px 3px; line-height:1.0; font-size:0.75em;' : 'padding:1px 4px; font-size:0.8em;';
  let titleAttr = '';
  if (isProphetX) {
    const preComm = calculatePreCommissionPct(percentage);
    if (preComm) titleAttr = ` title="${preComm}% pre-commission"`;
  }
  return `<span class="cno-badge"${titleAttr} style="background:#f1f5f9; color:#475569; ${paddingStyle} font-weight:500; margin-left:4px; display:inline-block; border:1px solid #e2e8f0;">${percentage}%</span>`;
}

function convertOddsInContainer(container, isCompact = false, isProphetX = false) {
  if (!userSettings.enablePctBadges) {
    const existing = container.querySelector('.cno-badge');
    if (existing) existing.remove();
    delete container.dataset.converted;
    return;
  }

  if (!container || container.dataset.converted) return;

  const rawText = container.textContent.trim();
  const pct = americanToPercentage(rawText);

  if (pct) {
    container.insertAdjacentHTML('beforeend', createBadgeStatic(pct, isCompact, isProphetX));
    container.dataset.converted = "true";
  }
}