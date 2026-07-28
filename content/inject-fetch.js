window.addEventListener("message", async (event) => {
  if (event.source !== window || event.data?.type !== "PS_FETCH_CAPTION") return;

  const { requestId, url } = event.data;

  try {
    const response = await fetch(url, { credentials: "include" });
    const text = await response.text();
    window.postMessage(
      { type: "PS_FETCH_CAPTION_RESULT", requestId, text },
      "*"
    );
  } catch (error) {
    window.postMessage(
      {
        type: "PS_FETCH_CAPTION_RESULT",
        requestId,
        error: error.message || "Caption fetch failed",
      },
      "*"
    );
  }
});
