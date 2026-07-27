# Page Summarizer

A Microsoft Edge extension that summarizes webpage content with a floating button, saves summaries locally, and displays them in the popup.

**Version:** 1.0.0

## Features

- Floating summarize button on every webpage
- Dialog with blurred backdrop and fade-in animation
- Click outside or press Escape to close
- Test-mode summary (extracts and previews page text — OpenAI integration ready)
- Saves summaries to local storage
- Popup (380×520px) lists all saved summaries

## Load in Microsoft Edge

1. Open Edge and go to `edge://extensions`
2. Enable **Developer mode** (bottom-left toggle)
3. Click **Load unpacked**
4. Select this folder: `summarizer`
5. Visit any website — the purple floating button appears bottom-right

## Usage

1. Click the floating button on a page
2. Review the test summary in the dialog
3. Click **Save Summary** to store it
4. Click the extension icon in the toolbar to view saved summaries in the popup

## Project structure

```
summarizer/
├── manifest.json
├── package.json
├── background/service-worker.js
├── content/content.js, content.css
├── popup/index.html, popup.css, popup.js
└── icons/
```

## Next steps (OpenAI)

Replace `generateMockSummary()` in `content/content.js` with an API call to OpenAI when you're ready to integrate.
