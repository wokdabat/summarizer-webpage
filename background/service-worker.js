const STORAGE_KEY = "summaries";
const MAX_SUMMARIES = 50;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_SUMMARY") {
    saveSummary(message.payload)
      .then((summary) => sendResponse({ success: true, summary }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_SUMMARIES") {
    getSummaries()
      .then((summaries) => sendResponse({ success: true, summaries }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "DELETE_SUMMARY") {
    deleteSummary(message.id)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "CLEAR_SUMMARIES") {
    clearSummaries()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function getSummaries() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function saveSummary(payload) {
  const summaries = await getSummaries();
  const summary = {
    id: crypto.randomUUID(),
    title: payload.title,
    url: payload.url,
    summary: payload.summary,
    excerpt: payload.excerpt,
    createdAt: new Date().toISOString(),
  };

  summaries.unshift(summary);

  if (summaries.length > MAX_SUMMARIES) {
    summaries.length = MAX_SUMMARIES;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: summaries });
  return summary;
}

async function deleteSummary(id) {
  const summaries = await getSummaries();
  const filtered = summaries.filter((s) => s.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

async function clearSummaries() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}
