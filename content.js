// ====================================================
// RUNNER & INITIALIZATION
// ====================================================

refreshUserSettings(() => {
  processAccordionPanes();
  applyModernUiClass();
  Promise.all([loadAllInjuryData(), loadAPRankings(), loadMLBWeatherData(), loadMarketSheetsData()]).then(() => {
    runAll();
    scheduleNextInjuryDataLoad();
  });
});

setInterval(() => {
  if (userSettings.enableApRankings) loadAPRankings();
}, AP_CACHE_TTL_MS);

setInterval(() => {
  if (userSettings.enableMlbWeather) loadMLBWeatherData();
}, WEATHER_CACHE_TTL_MS);

setInterval(() => {
  loadMarketSheetsData();
}, MARKET_CACHE_TTL_MS);

function runAll() {
processUpdateBannerAlert(); // Added update banner check
  restyleFilterPanel();
  syncBoostUIState(getFilterAccordionContainer() || document);
  addGameDeviggerCheckbox();
  setupGameRightClickDevigger();
  processOddsTable();
  processCalcPopup();
  processCalcBookLinks();
  processLowHoldShare();
  processDeviggerQrButton();
  processInjuryBadges();
  processPlayerTableRefreshTimestamp();
  processAPRankings();
  processMLBWeatherBadges();
  processNoticeDismiss();
  processAccordionPanes();
  applyModernUiClass();
  processModernSpacing();
  processPendingFilterApply();
  processEventFilterIcons();
  processEventInjuryIcons();
  processRowPopupsStillValid();
  processCellFilterIcons();
  processSportsbookQrButtons();
  processMainTableModern();
  processHedgeBookFilter();
  processInjuredRowExclusion();
  processExcludePlayerUnders();
  processMultiLeagueFilter();
  processMlbWeatherFilter();
  processHiddenRowsNote();
  processUnusedExtraColumn();
  processGameBookColumns();
  processGameHeaderFilterMenus();
  processGameColFilter();
  processRowStriping();
  processGameTableModern();
  processGameRowOrdering();
  processGameFocusRow();
  processGameQrButtons();
  processGameFilterLayout();
  processPageHeaderLayout();
  processGameHeaderWidths();
  processCalcButtons();
  processBoostDefaultOnLoad();
  processBoostAutoFocus();
}

// Every half second while the tab is visible; a background tab waits and catches up the moment
// it's shown again
setInterval(() => { if (!document.hidden) runAll(); }, 500);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && typeof userSettingsLoaded !== 'undefined' && userSettingsLoaded) runAll();
});

// Run as soon as the page has been read in full (the filter panel waits for that), instead of
// waiting for the next half-second tick
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { if (userSettingsLoaded) runAll(); });
}

if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
  Sys.WebForms.PageRequestManager.getInstance().add_endRequest(() => {
    const targetTable = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
    if (targetTable) delete targetTable.dataset.hasRightClick;
    runAll();
  });
}