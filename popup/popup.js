const summaryList = document.getElementById("summary-list");
const emptyState = document.getElementById("empty-state");
const summaryCount = document.getElementById("summary-count");
const clearAllBtn = document.getElementById("clear-all");

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
      <a class="card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open page</a>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-delete") || e.target.closest(".card-link")) return;
      card.classList.toggle("expanded");
    });

    card.querySelector(".card-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ type: "DELETE_SUMMARY", id: item.id });
      loadSummaries();
    });

    summaryList.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

clearAllBtn.addEventListener("click", async () => {
  if (!confirm("Delete all saved summaries?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_SUMMARIES" });
  loadSummaries();
});

loadSummaries();
