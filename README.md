# Page and YouTube Summarizer

A Microsoft Edge extension (Manifest V3) that summarizes webpages and YouTube videos with a floating button, saves summaries locally, and lets you review or export them from the popup.

**Version:** 2.1.3

## Features

### Summarization

- **Webpage summaries** — Extracts readable text from the current page and sends it to OpenAI for a concise summary
- **YouTube video summaries** — Detects YouTube watch pages and summarizes from the video transcript
- **Transcript fallbacks for YouTube** — Tries multiple strategies (Innertube API, caption tracks, in-page fetch, DOM transcript panel) so summaries work on more videos
- **OpenAI-powered** — Uses the OpenAI Responses API with prompts tailored for pages vs. videos
- **Model selection** — Choose from `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1`, or `gpt-5.6` in the popup (default: `gpt-4o-mini`)
- **Bring your own API key** — Each user enters their own OpenAI key in the popup; it stays in local extension storage on their device

### Floating button & dialog

- **Floating summarize button** on every webpage (bottom-right by default)
- **Smart repositioning** — Moves the button when it would overlap important page content
- **Subtle default, bold on hover** — Transparent FAB with a purple gradient on hover
- **Summary dialog** — Blurred backdrop, fade-in animation, and context-aware titles (`Page Summary` / `Video Summary`)
- **Easy to dismiss** — Click outside the dialog or press Escape to close
- **Save from dialog** — Store the generated summary with one click

### Popup & saved summaries

- **Saved summary library** — Up to 50 summaries stored in local extension storage
- **Expandable cards** — Click a card to read the full summary; click again to collapse
- **Per-summary actions** — Delete individual summaries, open the original page, or save as PDF
- **Clear all** — Remove every saved summary at once (with confirmation)
- **Empty state** — Helpful message when you have no summaries yet
- **Settings panel** — API key and model selection with save confirmation and active-model badge in the footer

### PDF export

- **Save as PDF** — Export any saved summary to a formatted PDF (title, date, source URL, full text)
- **Save As dialog** — Uses the browser’s file picker so you choose where to save (avoids Edge’s download flyout)
- **In-popup confirmation** — Success card after saving, dismissed with Close

### Design & platform

- **Midnight Aurora dark theme** — Consistent dark UI across the popup and on-page dialog
- **Microsoft Edge MV3** — Built as an unpacked extension for Edge (`edge://extensions`)

## Versioning

Bump the version in all project files with:

```bash
npm run version:patch   # small fix         1.1.0 -> 1.1.1
npm run version:minor   # new feature       1.1.0 -> 1.2.0
npm run version:major   # breaking change   1.1.0 -> 2.0.0
npm run version:set -- 1.2.3               # set exact version
```

Updates `manifest.json`, `package.json`, `popup/index.html`, and `README.md`.
After bumping, reload the extension in `edge://extensions`.

## Load in Microsoft Edge

1. Open Edge and go to `edge://extensions`
2. Enable **Developer mode** (bottom-left toggle)
3. Click **Load unpacked**
4. Select this folder: `summarizer`
5. Visit any website or YouTube video — the floating button appears bottom-right

## Setup

1. Install the extension from the Edge Add-ons store, or load it unpacked from this repo (see below)
2. Open the extension popup
3. Paste your [OpenAI API key](https://platform.openai.com/api-keys) into **OpenAI API Key**
4. Choose a model and click **Save settings**

Your key is stored in `chrome.storage.local` on your device. It is used only to call OpenAI when you summarize a page or video. It is never sent anywhere else.

### Optional: local dev key file

For development, you can still use `config.local.json` in the project root (gitignored). If no key is saved in the popup, the extension falls back to this file:

```json
{
  "apiKey": "sk-your-key-here"
}
```

**Do not include `config.local.json` in builds or packages you upload to the Edge Add-ons store.**

## Usage

1. Open the popup, add your OpenAI API key if you have not already, choose your model, then click **Save settings**
2. Click the floating button on a webpage or YouTube video
3. Review the AI summary in the dialog
4. Click **Save Summary** to store it locally
5. Open the popup to browse saved summaries — expand, delete, open the source, or **Download PDF**
6. When saving a PDF, pick a folder in the Save As dialog; confirm with **Close** on the success card

## Project structure

```
summarizer/
├── config.local.json          # optional dev API key (not committed, not for store builds)
├── manifest.json
├── package.json
├── background/service-worker.js
├── content/
│   ├── content.js, content.css
│   ├── youtube.js             # YouTube transcript extraction
│   └── inject-fetch.js        # caption fetch helper for YouTube
├── popup/
│   ├── index.html, popup.css, popup.js
│   └── pdf.js                 # PDF generation & Save As
├── lib/jspdf.umd.min.js
├── scripts/build.mjs, version.mjs
└── icons/
```

## Scripts

```bash
npm run build           # copy extension to dist/page-summarizer
npm run package         # build and zip for distribution (omit config.local.json)
npm run version:patch   # bump patch version
npm run version:minor   # bump minor version
npm run version:major   # bump major version
```
