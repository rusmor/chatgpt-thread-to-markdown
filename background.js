const CHATGPT_HOSTS = new Set(["chatgpt.com", "www.chatgpt.com"]);

async function showTemporaryBadge(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }, 3500);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    await showTemporaryBadge(tab.id, "ERR", "#b42318");
    return;
  }

  if (!CHATGPT_HOSTS.has(url.hostname)) {
    await showTemporaryBadge(tab.id, "GPT", "#b42318");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["exporter.js"]
    });
  } catch (error) {
    console.error("ChatGPT Markdown export failed:", error);
    await showTemporaryBadge(tab.id, "ERR", "#b42318");
  }
});
