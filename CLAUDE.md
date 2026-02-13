# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that adds a "Quick Download" button to Fidelity portfolio pages. The button automates Fidelity's native CSV download, auto-uploads the CSV to the portfolio analyzer backend API, and then auto-fetches Robinhood positions (requires MFA push notification approval on phone).

## Installation

Load unpacked extension via `chrome://extensions/` with Developer mode enabled.

## Architecture

### Three-Stage Message Relay

MV3 isolates MAIN world (page JS access) from ISOLATED world (chrome API access). The extension uses a three-stage relay to capture the CSV blob and upload it:

```
[Fidelity Page JS] → URL.createObjectURL(blob)
       ↓ (override captures blob text)
[interceptor.js - MAIN world]
       ↓ (window.postMessage)
[content.js - ISOLATED world]
       ↓ (chrome.runtime.sendMessage)
[background.js - Service Worker]
       ↓ (fetch POST multipart/form-data)
[Backend API: localhost:8000/api/v1/snapshots/upload]
```

### Key Files
- `manifest.json`: Manifest V3 config, `host_permissions` for API upload
- `interceptor.js`: MAIN world script that hooks `URL.createObjectURL` to capture CSV blob content
- `content.js`: ISOLATED world script with Quick Download button, arms interceptor, relays CSV to background
- `background.js`: Service worker that POSTs CSV to backend API via `fetch`

### interceptor.js (MAIN world)
- Runs at `document_start` before Fidelity's page JS
- Overrides `URL.createObjectURL` to intercept blob creation
- Armed by `FIDELITY_EXT_START_CAPTURE` postMessage from content.js
- One-shot: disarms after first capture
- Validates CSV headers (`Account Name`, `Symbol`, `Description`) before relaying
- Calls original `createObjectURL` synchronously so download always proceeds
- Preserves `toString()` to avoid detection

### content.js (ISOLATED world)
- Injects Quick Download button (fixed bottom-right)
- Click handler flow: arm interceptor → trigger download → wait for CSV capture → upload to backend → fetch Robinhood
- Button state machine:
  ```
  Downloading... (green #4CAF50)
    → Uploading... (blue #2196F3)
      → Fetching Robinhood... (purple #9C27B0)
        → Done! (green, 4s reset)
        → Uploaded! (RH failed) (orange #FF9800, 4s reset) — Fidelity OK, Robinhood failed
      → Upload Failed (red, 4s reset)
    → Downloaded (no upload) (orange, 3s reset)
  → Failed - Retry (red, stays)
  ```
- `performQuickDownload()` is unchanged from original
- Robinhood fetch requires MFA push notification — user must approve on phone (up to 150s timeout)

### background.js (Service Worker)
- `API_BASE` constant at top — change for remote access (e.g., Tailscale URL)
- Handles `UPLOAD_CSV` messages: POSTs CSV to `/api/v1/snapshots/upload`
- Handles `FETCH_ROBINHOOD` messages: POSTs to `/api/v1/snapshots/fetch-robinhood` with 150s timeout
- Builds FormData with filename `Portfolio_Positions_Mon-DD-YYYY.csv`

### Target Pages
- `https://digital.fidelity.com/ftgw/digital/portfolio/positions`
- `https://digital.fidelity.com/ftgw/digital/portfolio/summary`

### Quick Download Automation (`performQuickDownload()`)
Automates Fidelity's native CSV download with this sequence:
1. Click `.acct-selector__all-accounts-wrapper` (All Accounts)
2. Click `a.new-tab__tab[href="ftgw/digital/portfolio/positions"]` (Positions tab)
3. Set `select[aria-label="view"]` to `MyView` and dispatch change event
4. Click `button:has([pvd-name="nav__overflow-vertical"])` (overflow menu)
5. Click `#kebabmenuitem-download` (Download option)

Uses `MutationObserver` to wait for dynamic menu elements.

### Output
- CSV file still downloads to browser's default download location (unchanged)
- CSV is also uploaded to backend API automatically
- Same-date snapshots are replaced automatically by the backend

### Error Handling
| Failure | User Sees | Download Still Works? | Fidelity Upload OK? |
|---|---|---|---|
| Fidelity UI element not found | "Failed - Retry" (red) | No | No |
| Blob not captured (15s timeout) | "Downloaded (no upload)" (orange) | Yes | No |
| Backend down / unreachable (upload) | "Upload Failed" (red) | Yes | No |
| Backend parse error (4xx/5xx) | "Upload Failed" (red) | Yes | No |
| RH credentials missing / login failed | "Uploaded! (RH failed)" (orange) | Yes | Yes |
| RH fetch timeout (150s) | "Uploaded! (RH failed)" (orange) | Yes | Yes |
| Backend unreachable during RH fetch | "Uploaded! (RH failed)" (orange) | Yes | Yes |

Fidelity upload is committed before RH fetch starts. RH failure never affects the Fidelity snapshot.

### Configuration
- `API_BASE` in `background.js`: Set to backend base URL (default: `http://localhost:8000/api/v1/snapshots`)
- `host_permissions` in `manifest.json`: Must match the API URL origin
- Robinhood fetch requires `ROBINHOOD_USERNAME` and `ROBINHOOD_PASSWORD` in backend `.env`
