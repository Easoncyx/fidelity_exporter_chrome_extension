# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that adds a "Quick Download" button to Fidelity portfolio pages. The button automates Fidelity's native CSV download and auto-uploads the CSV to the portfolio analyzer backend API.

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
- Click handler flow: arm interceptor → trigger download → wait for CSV capture → relay to background
- Button state machine: `Downloading...` (green) → `Uploading...` (blue) → `Uploaded! N pos, M accts` (green) or error states
- `performQuickDownload()` is unchanged from original

### background.js (Service Worker)
- `API_URL` constant at top — change for remote access (e.g., Tailscale URL)
- Handles `UPLOAD_CSV` messages from content.js
- Builds FormData with filename `Portfolio_Positions_Mon-DD-YYYY.csv`
- POSTs to `/api/v1/snapshots/upload` (same endpoint as dashboard upload)

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
| Failure | User Sees | Download Still Works? |
|---|---|---|
| Fidelity UI element not found | "Failed - Retry" (red) | No |
| Blob not captured (15s timeout) | "Downloaded (no upload)" (orange) | Yes |
| Backend down / unreachable | "Upload Failed" (red) | Yes |
| Backend parse error (4xx/5xx) | "Upload Failed" (red) | Yes |

### Configuration
- `API_URL` in `background.js`: Set to backend URL (default: `http://localhost:8000/api/v1/snapshots/upload`)
- `host_permissions` in `manifest.json`: Must match the API URL origin
