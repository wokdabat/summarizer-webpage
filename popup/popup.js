const summaryList = document.getElementById("summary-list");
const emptyState = document.getElementById("empty-state");
const summaryCount = document.getElementById("summary-count");
const clearAllBtn = document.getElementById("clear-all");
const modelSelect = document.getElementById("model-select");
const saveSettingsBtn = document.getElementById("save-settings");
const settingsStatus = document.getElementById("settings-status");
const modelBadge = document.getElementById("model-badge");

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (!response?.success) return;

    const { settings } = response;
    modelSelect.value = settings.model || "gpt-4o-mini";
    modelBadge.textContent = modelSelect.value;
  } catch {
    // Ignore load errors in popup.
  }
}

async function saveSettings() {
  settingsStatus.textContent = "Saving…";
  settingsStatus.className = "settings-status";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      payload: {
        model: modelSelect.value,
      },
    });

    if (!response?.success) {
      throw new Error(response?.error || "Could not save settings");
    }

    modelBadge.textContent = modelSelect.value;
    settingsStatus.textContent = "Saved";
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

    card.querySelector(".card-download").addEventListener("click", (e) => {
      e.stopPropagation();
      try {
        window.PageSummarizerPdf.downloadSummaryPdf(item);
      } catch (err) {
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

saveSettingsBtn.addEventListener("click", saveSettings);

clearAllBtn.addEventListener("click", async () => {
  if (!confirm("Delete all saved summaries?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_SUMMARIES" });
  loadSummaries();
});

loadSettings();
loadSummaries();
