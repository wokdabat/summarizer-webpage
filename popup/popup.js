const summaryList = document.getElementById("summary-list");
const emptyState = document.getElementById("empty-state");
const summaryCount = document.getElementById("summary-count");
const clearAllBtn = document.getElementById("clear-all");
const apiKeyInput = document.getElementById("api-key-input");
const toggleApiKeyBtn = document.getElementById("toggle-api-key");
const apiKeyStatus = document.getElementById("api-key-status");
const removeApiKeyBtn = document.getElementById("remove-api-key");
const modelSelect = document.getElementById("model-select");
const saveSettingsBtn = document.getElementById("save-settings");
const settingsStatus = document.getElementById("settings-status");
const modelBadge = document.getElementById("model-badge");

let savedApiKey = false;
const downloadNotice = document.getElementById("download-notice");
const downloadNoticeFile = document.getElementById("download-notice-file");
const downloadNoticeClose = document.getElementById("download-notice-close");
const downloadNoticeHint = document.getElementById("download-notice-hint");

function showDownloadNotice(filename, usedPicker) {
  downloadNoticeFile.textContent = filename;
  downloadNoticeHint.textContent = usedPicker
    ? "Your PDF was saved to the location you chose."
    : "Check your Downloads folder.";
  downloadNotice.classList.remove("hidden");
}

function hideDownloadNotice() {
  downloadNotice.classList.add("hidden");
}

downloadNoticeClose.addEventListener("click", hideDownloadNotice);

function updateApiKeyUi() {
  if (savedApiKey) {
    apiKeyInput.value = "";
    apiKeyInput.placeholder = "Key saved — paste a new key to replace";
    apiKeyStatus.classList.remove("hidden");
    removeApiKeyBtn.classList.remove("hidden");
  } else {
    apiKeyInput.placeholder = "sk-...";
    apiKeyStatus.classList.add("hidden");
    removeApiKeyBtn.classList.add("hidden");
  }
}

toggleApiKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleApiKeyBtn.textContent = isPassword ? "Hide" : "Show";
  toggleApiKeyBtn.title = isPassword ? "Hide key" : "Show key";
});

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (!response?.success) return;

    const { settings } = response;
    modelSelect.value = settings.model || "gpt-4o-mini";
    modelBadge.textContent = modelSelect.value;
    savedApiKey = Boolean(settings.hasApiKey);
    updateApiKeyUi();
  } catch {
    // Ignore load errors in popup.
  }
}

async function saveSettings({ removeApiKey = false } = {}) {
  settingsStatus.textContent = "Saving…";
  settingsStatus.className = "settings-status";

  try {
    const payload = {
      model: modelSelect.value,
    };

    const apiKey = apiKeyInput.value.trim();
    if (removeApiKey) {
      payload.removeApiKey = true;
    } else if (apiKey) {
      payload.apiKey = apiKey;
    } else if (!savedApiKey) {
      throw new Error("Enter your OpenAI API key");
    }

    const response = await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      payload,
    });

    if (!response?.success) {
      throw new Error(response?.error || "Could not save settings");
    }

    modelBadge.textContent = modelSelect.value;
    savedApiKey = Boolean(response.settings?.hasApiKey);
    apiKeyInput.value = "";
    updateApiKeyUi();
    settingsStatus.textContent = removeApiKey ? "Key removed" : "Saved";
    settingsStatus.className = "settings-status success";
  } catch (err) {
    settingsStatus.textContent = err.message || "Save failed";
    settingsStatus.className = "settings-status error";
  }

  setTimeout(() => {
    settingsStatus.textContent = "";
    settingsStatus.className = "settings-status";
  }, 2000);
}

async function loadSummaries() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SUMMARIES" });
    if (response?.success) {
      renderSummaries(response.summaries);
    }
  } catch {
    renderSummaries([]);
  }
}

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSummaries(summaries) {
  summaryCount.textContent = `${summaries.length} summar${summaries.length === 1 ? "y" : "ies"}`;

  summaryList.querySelectorAll(".summary-card").forEach((el) => el.remove());

  if (summaries.length === 0) {
    emptyState.style.display = "flex";
    return;
  }

  emptyState.style.display = "none";

  summaries.forEach((item) => {
    const card = document.createElement("article");
    card.className = "summary-card";
    card.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <button class="card-delete" data-id="${item.id}" title="Delete">&times;</button>
      </div>
      <div class="card-meta">
        <span>${formatDate(item.createdAt)}</span>
      </div>
      <p class="card-excerpt">${escapeHtml(item.excerpt || "")}</p>
      <div class="card-full">${escapeHtml(item.summary || "")}</div>
      <div class="card-actions">
        <button class="card-download" type="button" title="Download PDF">Download PDF</button>
        <a class="card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open page</a>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".card-delete") ||
        e.target.closest(".card-link") ||
        e.target.closest(".card-download")
      ) {
        return;
      }
      card.classList.toggle("expanded");
    });

    card.querySelector(".card-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ type: "DELETE_SUMMARY", id: item.id });
      loadSummaries();
    });

    card.querySelector(".card-download").addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const { filename, usedPicker } = await window.PageSummarizerPdf.downloadSummaryPdf(item);
        showDownloadNotice(filename, usedPicker);
      } catch (err) {
        if (err.message === "Save cancelled") return;
        alert(err.message || "Could not download PDF.");
      }
    });

    summaryList.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

saveSettingsBtn.addEventListener("click", () => saveSettings());

removeApiKeyBtn.addEventListener("click", async () => {
  if (!confirm("Remove your saved OpenAI API key from this extension?")) return;
  await saveSettings({ removeApiKey: true });
});

clearAllBtn.addEventListener("click", async () => {
  if (!confirm("Delete all saved summaries?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_SUMMARIES" });
  loadSummaries();
});

loadSettings();
loadSummaries();
