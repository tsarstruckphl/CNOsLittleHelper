const GITHUB_RELEASE_API = 'https://api.github.com/repos/tsarstruckphl/CNOsLittleHelper/releases/latest';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

chrome.runtime.onStartup.addListener(() => {
  checkLatestRelease();
});

chrome.runtime.onInstalled.addListener(() => {
  checkLatestRelease();
});

async function checkLatestRelease() {
  try {
    const data = await chrome.storage.local.get(['cno_last_update_check', 'updateAvailable', 'latestVersion']);
    const now = Date.now();

    if (data.cno_last_update_check && (now - data.cno_last_update_check < CHECK_INTERVAL_MS)) {
      if (data.updateAvailable) {
        setBadgeState(true);
      }
      return;
    }

    const response = await fetch(GITHUB_RELEASE_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!response.ok) return;

    const release = await response.json();
    const latestVersion = (release.tag_name || '').replace(/^v/i, '').trim();
    const currentVersion = chrome.runtime.getManifest().version;

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
      updateAvailable: updateAvailable,
      latestVersion: latestVersion,
      downloadUrl: zipDownloadUrl,
      releasePageUrl: release.html_url
    });

    setBadgeState(updateAvailable);
  } catch (err) {
    console.warn('CNO Helper update check error:', err);
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

function setBadgeState(hasUpdate) {
  if (hasUpdate) {
    chrome.action.setBadgeText({ text: 'NEW' });
    chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}