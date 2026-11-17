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
  processCellFilterIcons();
  processSportsbookQrButtons();
  processMainTableModern();
  processHedgeBookFilter();
  processInjuredRowExclusion();
  processExcludePlayerUnders();
  processMultiLeagueFilter();
  processHiddenRowsNote();
  processUnusedExtraColumn();
  processGameBookColumns();
  processGameHeaderFilterMenus();
  processGameColFilter();
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

setInterval(runAll, 500);

if (typeof Sys !== 'undefined' && Sys.WebForms && Sys.WebForms.PageRequestManager) {
  Sys.WebForms.PageRequestManager.getInstance().add_endRequest(() => {
    const targetTable = document.getElementById('ContentPlaceHolderMain_ContentPlaceHolderRight_GridView1');
    if (targetTable) delete targetTable.dataset.hasRightClick;
    runAll();
  });
}