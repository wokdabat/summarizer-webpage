const STORAGE_KEY = "summaries";
const SETTINGS_KEY = "settings";
const MAX_SUMMARIES = 50;
const DEFAULT_MODEL = "gpt-4o-mini";

const DEFAULT_SETTINGS = {
  apiKey: "",
  model: DEFAULT_MODEL,
};

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

  if (message.type === "GET_SETTINGS") {
    getSettings()
      .then((settings) => sendResponse({ success: true, settings }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    saveSettings(message.payload)
      .then((settings) => sendResponse({ success: true, settings }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "SUMMARIZE_PAGE") {
    summarizePage(message.payload)
      .then((summary) => sendResponse({ success: true, summary }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "FETCH_YOUTUBE_CAPTION") {
    fetchYouTubeCaption(message.url)
      .then((text) => sendResponse({ success: true, text }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function getSummaries() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function getSettings() {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

async function saveSettings(payload) {
  const settings = {
    apiKey: (payload.apiKey || "").trim(),
    model: payload.model || DEFAULT_MODEL,
  };

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

async function summarizePage(payload) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    throw new Error("Add your OpenAI API key in the extension popup settings.");
  }

  const prompt =
    payload.contentType === "youtube"
      ? `Summarize the following YouTube video in clear, concise prose. ` +
        `Focus on the main topics, key points, and important takeaways from the transcript. ` +
        `Use short paragraphs or bullet points when helpful.\n\n` +
        `Title: ${payload.title}\n` +
        `URL: ${payload.url}\n\n` +
        `Content:\n${payload.text}`
      : `Summarize the following webpage in clear, concise prose. ` +
        `Focus on the main points, key takeaways, and important details. ` +
        `Use short paragraphs or bullet points when helpful.\n\n` +
        `Title: ${payload.title}\n` +
        `URL: ${payload.url}\n\n` +
        `Content:\n${payload.text}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      input: prompt,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }

  const summary =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("\n")
      .trim();

  if (!summary) {
    throw new Error("OpenAI returned an empty summary.");
  }

  return summary;
}

async function fetchYouTubeCaption(url) {
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Caption request failed (${response.status})`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Caption response was empty");
  }

  return text;
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
