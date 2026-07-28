(function () {
  const REQUEST_PREFIX = "ps-caption-fetch-";

  function isWatchPage() {
    const host = location.hostname.replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;

    return (
      location.pathname === "/watch" ||
      location.pathname.startsWith("/shorts/") ||
      location.pathname.startsWith("/live/")
    );
  }

  function getVideoId() {
    if (location.pathname.startsWith("/shorts/")) {
      return location.pathname.split("/")[2]?.split("?")[0] || null;
    }

    if (location.pathname.startsWith("/live/")) {
      return location.pathname.split("/")[2]?.split("?")[0] || null;
    }

    return new URLSearchParams(location.search).get("v");
  }

  function getInnertubeContext(clientName, clientVersion) {
    return {
      client: {
        hl: "en",
        gl: "US",
        clientName,
        clientVersion,
      },
    };
  }

  function getPlayerResponse() {
    if (window.ytInitialPlayerResponse?.videoDetails) {
      return window.ytInitialPlayerResponse;
    }

    for (const script of document.scripts) {
      const text = script.textContent;
      if (!text.includes("ytInitialPlayerResponse")) continue;

      const marker = "ytInitialPlayerResponse";
      let index = text.indexOf(marker);
      while (index !== -1) {
        const equalsIndex = text.indexOf("=", index);
        if (equalsIndex === -1) break;

        const jsonStart = text.indexOf("{", equalsIndex);
        if (jsonStart === -1) break;

        const parsed = parseBalancedJson(text, jsonStart);
        if (parsed?.videoDetails) return parsed;

        index = text.indexOf(marker, index + marker.length);
      }
    }

    return null;
  }

  async function innertubeRequest(endpoint, body, useApiKey = false) {
    const cfg = window.ytcfg?.data_ || {};
    const apiKey = cfg.INNERTUBE_API_KEY || "AIzaSyAO_FJ2SlqU8Q4STEHLgcil58_Ysy_88i4";
    const url = useApiKey
      ? `/youtubei/v1/${endpoint}?key=${apiKey}`
      : `/youtubei/v1/${endpoint}?prettyPrint=false`;

    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;
    return response.json();
  }

  async function fetchIosPlayerResponse(videoId) {
    return innertubeRequest("player", {
      context: getInnertubeContext("IOS", "20.10.38"),
      videoId,
    });
  }

  async function fetchWebPlayerResponse(videoId) {
    const cfg = window.ytcfg?.data_ || {};
    return innertubeRequest(
      "player",
      {
        context: getInnertubeContext(
          cfg.INNERTUBE_CLIENT_NAME || "WEB",
          cfg.INNERTUBE_CLIENT_VERSION || "2.20260101.00.00"
        ),
        videoId,
      },
      true
    );
  }

  async function resolvePlayerResponse(videoId) {
    const iosPlayer = await fetchIosPlayerResponse(videoId);
    if (getCaptionTracks(iosPlayer).length) return iosPlayer;

    const webPlayer = await fetchWebPlayerResponse(videoId);
    if (getCaptionTracks(webPlayer).length) return webPlayer;

    return getPlayerResponse() || iosPlayer || webPlayer;
  }

  function findTranscriptParams() {
    const data = window.ytInitialData;
    if (!data) return null;

    const json = JSON.stringify(data);
    const match = json.match(/"getTranscriptEndpoint"\s*:\s*\{\s*"params"\s*:\s*"([^"]+)"/);
    return match?.[1] || null;
  }

  function extractTranscriptFromInnertubeResponse(data) {
    const lines = [];

    function walk(node) {
      if (!node || typeof node !== "object") return;

      if (node.transcriptSegmentRenderer?.snippet?.runs) {
        lines.push(
          node.transcriptSegmentRenderer.snippet.runs
            .map((run) => run.text || "")
            .join("")
        );
      }

      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }

      Object.values(node).forEach(walk);
    }

    walk(data);
    return lines.join(" ").replace(/\s+/g, " ").trim();
  }

  async function fetchTranscriptViaInnertube(videoId) {
    const params = findTranscriptParams();
    if (!params) return "";

    const cfg = window.ytcfg?.data_ || {};
    const data = await innertubeRequest(
      "get_transcript",
      {
        context: getInnertubeContext(
          cfg.INNERTUBE_CLIENT_NAME || "WEB",
          cfg.INNERTUBE_CLIENT_VERSION || "2.20260101.00.00"
        ),
        params,
        externalVideoId: videoId,
      },
      true
    );

    return extractTranscriptFromInnertubeResponse(data);
  }

  function parseBalancedJson(text, startIndex) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        if (escape) {
          escape = false;
        } else if (char === "\\") {
          escape = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") depth++;
      if (char === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(startIndex, i + 1));
          } catch {
            return null;
          }
        }
      }
    }

    return null;
  }

  function getCaptionTracks(playerResponse) {
    return (
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
    );
  }

  function sortCaptionTracks(tracks) {
    return [...tracks].sort((a, b) => {
      const score = (track) => {
        let value = 0;
        if (track.languageCode === "en") value += 4;
        else if (track.languageCode?.startsWith("en")) value += 3;
        if (track.kind !== "asr") value += 2;
        return value;
      };

      return score(b) - score(a);
    });
  }

  function buildCaptionUrl(baseUrl, fmt) {
    const withoutFmt = baseUrl
      .replace(/([?&])fmt=[^&]*(&)?/g, (_, prefix, suffix) => (suffix ? prefix : ""))
      .replace(/[?&]$/, "");

    const separator = withoutFmt.includes("?") ? "&" : "?";
    return `${withoutFmt}${separator}fmt=${fmt}`;
  }

  function parseJson3Transcript(raw) {
    const data = JSON.parse(raw);
    return (data.events || [])
      .flatMap((event) => event.segs || [])
      .map((segment) => segment.utf8 || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseXmlTranscript(raw) {
    const doc = new DOMParser().parseFromString(raw, "text/xml");
    if (doc.querySelector("parsererror")) return "";

    return [...doc.querySelectorAll("text")]
      .map((node) => node.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseCaptionResponse(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("{")) {
      try {
        return parseJson3Transcript(trimmed);
      } catch {
        return "";
      }
    }

    if (trimmed.includes("<text")) {
      return parseXmlTranscript(trimmed);
    }

    return "";
  }

  function ensurePageFetchBridge() {
    if (window.__psCaptionBridgeReady) {
      return Promise.resolve();
    }

    if (window.__psCaptionBridgeLoading) {
      return window.__psCaptionBridgeLoading;
    }

    window.__psCaptionBridgeLoading = new Promise((resolve, reject) => {
      if (document.getElementById("ps-caption-bridge")) {
        window.__psCaptionBridgeReady = true;
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = "ps-caption-bridge";
      script.src = chrome.runtime.getURL("content/inject-fetch.js");
      script.onload = () => {
        window.__psCaptionBridgeReady = true;
        resolve();
      };
      script.onerror = () => reject(new Error("Could not load caption bridge"));
      (document.head || document.documentElement).appendChild(script);
    });

    return window.__psCaptionBridgeLoading;
  }

  async function fetchCaptionInPageContext(url) {
    await ensurePageFetchBridge();

    return new Promise((resolve, reject) => {
      const requestId = `${REQUEST_PREFIX}${crypto.randomUUID()}`;

      function handler(event) {
        if (event.source !== window) return;
        if (event.data?.type !== "PS_FETCH_CAPTION_RESULT") return;
        if (event.data.requestId !== requestId) return;

        window.removeEventListener("message", handler);
        clearTimeout(timeoutId);

        if (event.data.error) {
          reject(new Error(event.data.error));
          return;
        }

        resolve(event.data.text || "");
      }

      const timeoutId = setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("Caption fetch timed out"));
      }, 15000);

      window.addEventListener("message", handler);
      window.postMessage({ type: "PS_FETCH_CAPTION", requestId, url }, "*");
    });
  }

  async function fetchCaptionViaBackground(url) {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_YOUTUBE_CAPTION",
      url,
    });

    if (!response?.success) {
      throw new Error(response?.error || "Background caption fetch failed");
    }

    return response.text || "";
  }

  async function fetchCaptionFromUrl(url) {
    const attempts = [
      () => fetchCaptionInPageContext(url),
      () => fetchCaptionViaBackground(url),
      async () => {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error("Caption fetch failed");
        return response.text();
      },
    ];

    for (const attempt of attempts) {
      try {
        const raw = await attempt();
        const transcript = parseCaptionResponse(raw);
        if (transcript) return transcript;
      } catch {
        // Try the next fetch strategy.
      }
    }

    return "";
  }

  async function fetchCaptionFromTrack(track) {
    const formats = ["json3", "srv1", "srv3", ""];

    for (const fmt of formats) {
      const url = fmt ? buildCaptionUrl(track.baseUrl, fmt) : track.baseUrl.replace(/([?&])fmt=[^&]*/g, "");
      const transcript = await fetchCaptionFromUrl(url);
      if (transcript) return transcript.slice(0, 12000);
    }

    return "";
  }

  async function fetchTranscriptFromTracks(tracks) {
    for (const track of sortCaptionTracks(tracks)) {
      const transcript = await fetchCaptionFromTrack(track);
      if (transcript) return transcript;
    }

    return "";
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function readDomTranscript() {
    const selectors = [
      "ytd-transcript-segment-renderer .segment-text",
      "ytd-transcript-segment-renderer yt-formatted-string",
      "#segments-container yt-formatted-string",
    ];

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      if (!nodes.length) continue;

      const transcript = [...nodes]
        .map((node) => node.textContent?.trim() || "")
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (transcript) return transcript.slice(0, 12000);
    }

    return "";
  }

  async function openTranscriptPanel() {
    if (readDomTranscript()) return;

    const selectors = [
      'button[aria-label="Show transcript"]',
      'button[aria-label="Open transcript"]',
      "ytd-video-description-transcript-section-renderer button",
      "#description ytd-video-description-transcript-section-renderer button",
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (!button) continue;
      button.click();
      await wait(1200);
      if (readDomTranscript()) return;
    }
  }

  async function fetchTranscript(videoId, tracks) {
    const strategies = [
      () => fetchTranscriptViaInnertube(videoId),
      () => fetchTranscriptFromTracks(tracks),
      async () => {
        await openTranscriptPanel();
        return readDomTranscript();
      },
    ];

    for (const strategy of strategies) {
      try {
        const transcript = await strategy();
        if (transcript) return transcript;
      } catch {
        // Try the next strategy.
      }
    }

    throw new Error(
      "Could not read the video transcript. Open the transcript panel on YouTube (⋯ → Show transcript), then try again."
    );
  }

  function getTitle(playerResponse) {
    return (
      playerResponse?.videoDetails?.title ||
      document.querySelector("h1 yt-formatted-string")?.textContent?.trim() ||
      document.querySelector('meta[name="title"]')?.content ||
      document.title.replace(" - YouTube", "").trim() ||
      "YouTube Video"
    );
  }

  function getChannel(playerResponse) {
    return (
      playerResponse?.videoDetails?.author ||
      document.querySelector("#channel-name a")?.textContent?.trim() ||
      document.querySelector("ytd-channel-name a")?.textContent?.trim() ||
      "Unknown channel"
    );
  }

  function getDescription(playerResponse) {
    return (
      playerResponse?.videoDetails?.shortDescription ||
      document.querySelector("#description-inline-expander yt-formatted-string")?.textContent?.trim() ||
      document.querySelector("#description yt-formatted-string")?.textContent?.trim() ||
      ""
    ).slice(0, 2000);
  }

  async function extractContent() {
    const videoId = getVideoId();
    if (!videoId) {
      throw new Error("Open a YouTube video page to summarize it.");
    }

    const playerResponse = await resolvePlayerResponse(videoId);
    if (!playerResponse) {
      throw new Error("Could not read YouTube video data. Refresh the page and try again.");
    }

    const title = getTitle(playerResponse);
    const channel = getChannel(playerResponse);
    const description = getDescription(playerResponse);
    const tracks = getCaptionTracks(playerResponse);

    if (!tracks.length && !findTranscriptParams()) {
      throw new Error(
        "This video has no captions or transcript available. Try a video with subtitles enabled."
      );
    }

    const transcript = await fetchTranscript(videoId, tracks);
    const text = [
      `Channel: ${channel}`,
      description ? `Description: ${description}` : "",
      `Transcript:\n${transcript}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const excerpt = transcript.slice(0, 280) + (transcript.length > 280 ? "…" : "");

    return {
      title,
      text,
      excerpt,
      url: location.href,
      contentType: "youtube",
      channel,
      videoId,
    };
  }

  window.PageSummarizerYouTube = {
    isWatchPage,
    extractContent,
  };
})();
