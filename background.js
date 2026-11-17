// The Firefox build (made by build-firefox.ps1) has a "browser_specific_settings" section in its
// manifest. Firefox gets updates from addons.mozilla.org, so the GitHub update check is off there.
const CNO_IS_FIREFOX_BUILD = !!(chrome.runtime.getManifest().browser_specific_settings);
const CNO_UPDATE_CHECKS_ENABLED = !CNO_IS_FIREFOX_BUILD;
const UPGRADE_MENU_ID = 'cno-upgrade-menu';

const GITHUB_RELEASE_API = 'https://api.github.com/repos/tsarstruckphl/CNOsLittleHelper/releases/latest';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const UPDATE_ALARM_NAME = 'cno-update-check';

function ensureUpdateAlarm() {
  chrome.alarms.get(UPDATE_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(UPDATE_ALARM_NAME, { periodInMinutes: 24 * 60 });
    }
  });
}

if (CNO_UPDATE_CHECKS_ENABLED) {
  chrome.runtime.onStartup.addListener(() => {
    ensureUpdateAlarm();
    checkLatestRelease();
  });

  chrome.runtime.onInstalled.addListener(() => {
    ensureUpdateAlarm();
    checkLatestRelease();
  });

  // Re-check every 24 hours regardless of whether the browser was restarted.
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === UPDATE_ALARM_NAME) {
      checkLatestRelease(true);
    }
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === UPGRADE_MENU_ID) {
      // Jump straight to the version / update section of the options page
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') + '#cno-version-card' });
    }
  });
}

// Allows the extension's own pages (e.g. the options page) to request a fresh check.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'cno-check-update' && sender.id === chrome.runtime.id &&
      sender.url && sender.url.startsWith(chrome.runtime.getURL(''))) {
    if (!CNO_UPDATE_CHECKS_ENABLED) {
      sendResponse({ ok: false, disabled: true, currentVersion: chrome.runtime.getManifest().version });
      return;
    }
    checkLatestRelease(true).then(sendResponse);
    return true; // keep the channel open for the async response
  }
});

async function checkLatestRelease(force = false) {
  const currentVersion = chrome.runtime.getManifest().version;

  try {
    const data = await chrome.storage.local.get([
      'cno_last_update_check', 'cno_checked_version', 'updateAvailable', 'latestVersion', 'downloadUrl', 'releasePageUrl'
    ]);
    const now = Date.now();

    // The cache is only trusted if it was made by this same installed version; after the
    // extension is updated or its version changes, check GitHub again right away.
    if (!force && data.cno_last_update_check && data.cno_checked_version === currentVersion &&
        (now - data.cno_last_update_check < CHECK_INTERVAL_MS)) {
      const stillAvailable = isVersionHigher(data.latestVersion, currentVersion);
      setBadgeState(stillAvailable);
      return {
        ok: true,
        updateAvailable: stillAvailable,
        latestVersion: data.latestVersion || '',
        currentVersion: currentVersion,
        downloadUrl: data.downloadUrl || '',
        releasePageUrl: data.releasePageUrl || ''
      };
    }

    const response = await fetch(GITHUB_RELEASE_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!response.ok) return { ok: false, currentVersion: currentVersion };

    const release = await response.json();
    const latestVersion = (release.tag_name || '').replace(/^v/i, '').trim();

    const updateAvailable = isVersionHigher(latestVersion, currentVersion);

    let zipDownloadUrl = release.html_url;
    if (release.assets && release.assets.length > 0) {
      const zipAsset = release.assets.find(a => a.name.endsWith('.zip'));
      if (zipAsset) {
        zipDownloadUrl = zipAsset.browser_download_url;
      }
    }

    await chrome.storage.local.set({
      cno_last_update_check: now,
      cno_checked_version: currentVersion,
      updateAvailable: updateAvailable,
      latestVersion: latestVersion,
      downloadUrl: zipDownloadUrl,
      releasePageUrl: release.html_url
    });

    setBadgeState(updateAvailable);

    return {
      ok: true,
      updateAvailable: updateAvailable,
      latestVersion: latestVersion,
      currentVersion: currentVersion,
      downloadUrl: zipDownloadUrl,
      releasePageUrl: release.html_url
    };
  } catch (err) {
    console.warn('CNO Helper update check error:', err);
    return { ok: false, currentVersion: currentVersion };
  }
}

function isVersionHigher(latest, current) {
  if (!latest || !current) return false;
  const p1 = latest.split('.').map(Number);
  const p2 = current.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const v1 = p1[i] || 0;
    const v2 = p2[i] || 0;
    if (v1 > v2) return true;
    if (v1 < v2) return false;
  }
  return false;
}


// Adds/removes "Upgrade to new version" in the toolbar icon's right-click menu
function setUpgradeMenu(hasUpdate) {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) { /* ignore */ }
    if (hasUpdate) {
      chrome.contextMenus.create({
        id: UPGRADE_MENU_ID,
        title: 'Upgrade to new version',
        contexts: ['action']
      }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
    }
  });
}


function setBadgeState(hasUpdate) {
  setUpgradeMenu(hasUpdate);
  if (hasUpdate) {
    chrome.action.setBadgeText({ text: 'NEW' });
    chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Lets the content script's "CNO LH Options" button open the options page in a new tab
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'cno-open-options' && sender.id === chrome.runtime.id) {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  }
});
