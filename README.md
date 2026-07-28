# Page Summarizer

A Microsoft Edge extension that summarizes webpage content with a floating button, saves summaries locally, and displays them in the popup.

**Version:** 2.0.0

## Features

- Floating summarize button on every webpage
- Dialog with blurred backdrop and fade-in animation
- Click outside or press Escape to close
- OpenAI-powered summaries (configure API key and model in popup)
- Saves summaries to local storage
- Popup lists all saved summaries

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
5. Visit any website — the purple floating button appears bottom-right

## Usage

1. Open the popup and save your OpenAI API key and model
2. Click the floating button on a page
3. Review the AI summary in the dialog
4. Click **Save Summary** to store it
5. Open the popup again to view saved summaries

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

## Scripts

```bash
npm run build           # copy extension to dist/page-summarizer
npm run version:patch   # bump patch version
npm run version:minor   # bump minor version
npm run version:major   # bump major version
```
