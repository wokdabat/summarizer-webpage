(function () {
  if (window.__pageSummarizerLoaded) return;
  window.__pageSummarizerLoaded = true;

  const ROOT_ID = "page-summarizer-root";
  const FAB_POSITIONS = ["", "ps-pos-bl", "ps-pos-br-high", "ps-pos-bl-high", "ps-pos-tr", "ps-pos-tl"];
  const MIN_BLOCKER_AREA = 900;

  function extractPageContent() {
    const clone = document.body.cloneNode(true);
    clone
      .querySelectorAll(
        "script, style, noscript, iframe, svg, nav, footer, header, aside, [aria-hidden='true']"
      )
      .forEach((el) => el.remove());

    const title =
      document.querySelector("meta[property='og:title']")?.content ||
      document.title ||
      "Untitled Page";

    const text = clone.innerText
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    const excerpt = text.slice(0, 280) + (text.length > 280 ? "…" : "");

    return { title, text, excerpt, url: location.href, contentType: "page" };
  }

  async function extractContent() {
    if (window.PageSummarizerYouTube?.isWatchPage()) {
      return window.PageSummarizerYouTube.extractContent();
    }

    return extractPageContent();
  }


  async function requestSummary(page) {
    const response = await chrome.runtime.sendMessage({
      type: "SUMMARIZE_PAGE",
      payload: {
        title: page.title,
        url: page.url,
        text: page.text,
        contentType: page.contentType || "page",
      },
    });

    if (!response?.success) {
      throw new Error(response?.error || "Summary request failed");
    }

    return response.summary;
  }

  function isExtensionElement(el) {
    return el.closest(`#${ROOT_ID}`) !== null;
  }

  function isVisibleElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isMeaningfulBlocker(el) {
    if (!isVisibleElement(el)) return false;
    if (isExtensionElement(el)) return false;
    if (el === document.documentElement || el === document.body) return false;

    const tag = el.tagName;
    if (tag === "HTML" || tag === "SCRIPT" || tag === "STYLE" || tag === "LINK") {
      return false;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width * rect.height < MIN_BLOCKER_AREA) return false;

    const style = getComputedStyle(el);
    if (style.pointerEvents === "none") return false;

    return true;
  }

  function rectsOverlap(a, b) {
    return !(
      a.right <= b.left ||
      a.left >= b.right ||
      a.bottom <= b.top ||
      a.top >= b.bottom
    );
  }

  function getOverlapArea(a, b) {
    if (!rectsOverlap(a, b)) return 0;
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  }

  function applyFabPosition(fab, positionClass) {
    FAB_POSITIONS.forEach((cls) => {
      if (cls) fab.classList.remove(cls);
    });
    if (positionClass) fab.classList.add(positionClass);
  }

  function measureFabOverlap(fab, positionClass) {
    const prevVisibility = fab.style.visibility;
    fab.style.visibility = "hidden";
    applyFabPosition(fab, positionClass);

    const rect = fab.getBoundingClientRect();
    let overlapScore = 0;

    const samplePoints = [
      [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5],
      [rect.left + 8, rect.top + 8],
      [rect.right - 8, rect.top + 8],
      [rect.left + 8, rect.bottom - 8],
      [rect.right - 8, rect.bottom - 8],
    ];

    const seen = new Set();
    for (const [x, y] of samplePoints) {
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;

      const stack = document.elementsFromPoint(x, y);
      for (const el of stack) {
        if (seen.has(el) || !isMeaningfulBlocker(el)) continue;
        seen.add(el);
        overlapScore += getOverlapArea(rect, el.getBoundingClientRect());
      }
    }

    const fixedElements = document.querySelectorAll("body *");
    for (const el of fixedElements) {
      if (seen.has(el) || isExtensionElement(el) || !isVisibleElement(el)) continue;

      const style = getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") continue;

      const elRect = el.getBoundingClientRect();
      if (elRect.width * elRect.height < MIN_BLOCKER_AREA) continue;

      overlapScore += getOverlapArea(rect, elRect) * 1.5;
    }

    fab.style.visibility = prevVisibility || "";
    return overlapScore;
  }

  function repositionFab(fab) {
    let bestPosition = "";
    let lowestOverlap = Infinity;

    for (const positionClass of FAB_POSITIONS) {
      const overlap = measureFabOverlap(fab, positionClass);
      if (overlap === 0) {
        bestPosition = positionClass;
        break;
      }
      if (overlap < lowestOverlap) {
        lowestOverlap = overlap;
        bestPosition = positionClass;
      }
    }

    applyFabPosition(fab, bestPosition);
    fab.style.visibility = "";
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function createUI() {
    const root = document.createElement("div");
    root.id = ROOT_ID;

    root.innerHTML = `
      <button class="ps-fab" aria-label="Summarize this page" title="Summarize page">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </button>

      <div class="ps-overlay" aria-hidden="true">
        <div class="ps-dialog" role="dialog" aria-modal="true" aria-labelledby="ps-dialog-title">
          <div class="ps-dialog-header">
            <h2 id="ps-dialog-title">Page Summary</h2>
            <button class="ps-close" aria-label="Close">&times;</button>
          </div>
          <div class="ps-dialog-body">
            <p class="ps-page-title"></p>
            <div class="ps-status">Analyzing page content…</div>
            <div class="ps-summary hidden"></div>
          </div>
          <div class="ps-dialog-footer">
            <button class="ps-btn ps-btn-secondary ps-close-btn">Close</button>
            <button class="ps-btn ps-btn-primary ps-save-btn" disabled>Save Summary</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    return root;
  }

  function openDialogLoading(root, page) {
    const overlay = root.querySelector(".ps-overlay");
    const dialog = root.querySelector(".ps-dialog");
    const dialogTitle = root.querySelector("#ps-dialog-title");
    const pageTitle = root.querySelector(".ps-page-title");
    const status = root.querySelector(".ps-status");
    const summaryEl = root.querySelector(".ps-summary");
    const saveBtn = root.querySelector(".ps-save-btn");
    const isYouTube = page.contentType === "youtube";

    dialogTitle.textContent = isYouTube ? "Video Summary" : "Page Summary";
    pageTitle.textContent = page.title || (isYouTube ? "YouTube video" : "Current page");
    status.textContent = isYouTube
      ? "Fetching video transcript…"
      : "Analyzing page content…";
    status.classList.remove("hidden");
    summaryEl.classList.add("hidden");
    summaryEl.textContent = "";
    summaryEl.classList.remove("ps-error");
    saveBtn.disabled = true;
    delete saveBtn.dataset.page;

    overlay.classList.add("ps-visible");
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => dialog.classList.add("ps-visible"));
  }

  function openDialog(root, page, summaryText) {
    const overlay = root.querySelector(".ps-overlay");
    const dialog = root.querySelector(".ps-dialog");
    const dialogTitle = root.querySelector("#ps-dialog-title");
    const pageTitle = root.querySelector(".ps-page-title");
    const status = root.querySelector(".ps-status");
    const summaryEl = root.querySelector(".ps-summary");
    const saveBtn = root.querySelector(".ps-save-btn");

    dialogTitle.textContent = page.contentType === "youtube" ? "Video Summary" : "Page Summary";
    pageTitle.textContent = page.title;
    status.classList.add("hidden");
    summaryEl.textContent = summaryText;
    summaryEl.classList.remove("hidden", "ps-error");
    saveBtn.disabled = false;
    saveBtn.dataset.page = JSON.stringify({ ...page, summary: summaryText });

    overlay.classList.add("ps-visible");
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => dialog.classList.add("ps-visible"));
  }

  function showDialogError(root, page, message) {
    const overlay = root.querySelector(".ps-overlay");
    const dialog = root.querySelector(".ps-dialog");
    const pageTitle = root.querySelector(".ps-page-title");
    const status = root.querySelector(".ps-status");
    const summaryEl = root.querySelector(".ps-summary");
    const saveBtn = root.querySelector(".ps-save-btn");

    pageTitle.textContent = page.title;
    status.classList.add("hidden");
    summaryEl.textContent = message;
    summaryEl.classList.remove("hidden");
    summaryEl.classList.add("ps-error");
    saveBtn.disabled = true;
    delete saveBtn.dataset.page;

    overlay.classList.add("ps-visible");
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => dialog.classList.add("ps-visible"));
  }

  function closeDialog(root) {
    const overlay = root.querySelector(".ps-overlay");
    const dialog = root.querySelector(".ps-dialog");
    const status = root.querySelector(".ps-status");
    const summaryEl = root.querySelector(".ps-summary");
    const saveBtn = root.querySelector(".ps-save-btn");

    dialog.classList.remove("ps-visible");
    overlay.classList.remove("ps-visible");
    overlay.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      status.classList.remove("hidden");
      summaryEl.classList.add("hidden");
      summaryEl.textContent = "";
      saveBtn.disabled = true;
      delete saveBtn.dataset.page;
    }, 300);
  }

  function init() {
    const root = createUI();
    const fab = root.querySelector(".ps-fab");
    const overlay = root.querySelector(".ps-overlay");
    const dialog = root.querySelector(".ps-dialog");
    const saveBtn = root.querySelector(".ps-save-btn");

    const scheduleReposition = debounce(() => repositionFab(fab), 150);

    repositionFab(fab);
    window.addEventListener("scroll", scheduleReposition, { passive: true, capture: true });
    window.addEventListener("resize", scheduleReposition);

    const observer = new MutationObserver(scheduleReposition);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    fab.addEventListener("click", async () => {
      const isYouTube = window.PageSummarizerYouTube?.isWatchPage();
      openDialogLoading(root, {
        title: isYouTube ? "YouTube video" : document.title,
        contentType: isYouTube ? "youtube" : "page",
      });

      try {
        const page = await extractContent();
        const status = root.querySelector(".ps-status");
        const pageTitle = root.querySelector(".ps-page-title");
        const dialogTitle = root.querySelector("#ps-dialog-title");

        pageTitle.textContent = page.title;
        dialogTitle.textContent = page.contentType === "youtube" ? "Video Summary" : "Page Summary";
        status.textContent = "Generating summary with OpenAI…";

        const summary = await requestSummary(page);
        openDialog(root, page, summary);
      } catch (err) {
        showDialogError(
          root,
          { title: document.title, contentType: isYouTube ? "youtube" : "page" },
          err.message || "Could not generate a summary. Add your OpenAI API key in the extension popup."
        );
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeDialog(root);
    });

    root.querySelectorAll(".ps-close, .ps-close-btn").forEach((btn) => {
      btn.addEventListener("click", () => closeDialog(root));
    });

    dialog.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("ps-visible")) {
        closeDialog(root);
      }
    });

    saveBtn.addEventListener("click", async () => {
      const data = JSON.parse(saveBtn.dataset.page);
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
        const response = await chrome.runtime.sendMessage({
          type: "SAVE_SUMMARY",
          payload: {
            title: data.title,
            url: data.url,
            summary: data.summary,
            excerpt: data.excerpt,
          },
        });

        if (response?.success) {
          saveBtn.textContent = "Saved!";
          setTimeout(() => closeDialog(root), 600);
        } else {
          throw new Error(response?.error || "Save failed");
        }
      } catch {
        saveBtn.textContent = "Save failed";
        saveBtn.disabled = false;
      } finally {
        setTimeout(() => {
          saveBtn.textContent = "Save Summary";
        }, 1500);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
