# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that adds a "Quick Download" button to Fidelity portfolio pages. The button automates Fidelity's native CSV download, auto-uploads the CSV to the portfolio analyzer backend API, auto-fetches Robinhood positions (requires MFA push notification approval on phone), then downloads and uploads Fidelity account activity CSV.

## Installation

Load unpacked extension via `chrome://extensions/` with Developer mode enabled.

## Architecture

### Three-Stage Message Relay

MV3 isolates MAIN world (page JS access) from ISOLATED world (chrome API access). The extension uses a three-stage relay to capture CSV blobs and upload them:

```
[Fidelity Page JS] → URL.createObjectURL(blob)
       ↓ (override captures blob text)
[interceptor.js - MAIN world]
       ↓ (window.postMessage)
[content.js - ISOLATED world]
       ↓ (chrome.runtime.sendMessage)
[background.js - Service Worker]
       ↓ (fetch POST multipart/form-data)
[Backend API: localhost:8000/api/v1/snapshots/upload or /api/v1/activities/upload-fidelity]
```

### Key Files
- `manifest.json`: Manifest V3 config, `host_permissions` for API upload
- `interceptor.js`: MAIN world script that hooks `URL.createObjectURL` to capture CSV blob content (positions or activity)
- `content.js`: ISOLATED world script with Quick Download button, arms interceptor, relays CSV to background
- `background.js`: Service worker that POSTs CSV to backend API via `fetch`

### interceptor.js (MAIN world)
- Runs at `document_start` before Fidelity's page JS
- Overrides `URL.createObjectURL` to intercept blob creation
- Armed by `FIDELITY_EXT_START_CAPTURE` postMessage from content.js with `captureType` field
- Supports two capture types:
  - `'positions'`: Validates `Account Name` + `Symbol` + `Description` headers, sends `FIDELITY_EXT_CSV_CAPTURED`
  - `'activity'`: Validates `Run Date` + `Account Number` + `Action` headers, sends `FIDELITY_EXT_ACTIVITY_CSV_CAPTURED`
- One-shot: disarms after first capture
- Calls original `createObjectURL` synchronously so download always proceeds
- Preserves `toString()` to avoid detection

### content.js (ISOLATED world)
- Injects a button group (fixed bottom-right) with 4 buttons:
  - **Quick Download** (green, full-width) — all-in-one: positions → Robinhood → activity
  - **Positions** (blue) — download + upload positions CSV only
  - **Activity** (orange) — download + upload activity CSV only
  - **Robinhood** (purple) — fetch Robinhood positions only
- All buttons are disabled while any operation is running (interceptor is one-shot, prevents conflicts)
- Three reusable operation functions: `doPositions(btn)`, `doRobinhood(btn)`, `doActivity(btn)`
  - Each returns `{ success, error? }` so callers decide how to display results
- Quick Download state machine:
  ```
  Quick Download (green) → click
    → Downloading... → Uploading... → Fetching Robinhood... → Downloading Activity... → Uploading Activity...
      → All Done! (green, 4s reset)
    Partial failures at each stage show orange/red status then reset
  ```
- Individual buttons show Done!/Failed and reset to original color after 4s
- `performQuickDownload()` automates positions CSV download
- `performActivityDownload()` automates activity CSV download
- Robinhood fetch requires MFA push notification — user must approve on phone (up to 150s timeout)

### background.js (Service Worker)
- `API_BASE` constant: Snapshots API base URL (default: `http://localhost:8000/api/v1/snapshots`)
- `ACTIVITY_API_BASE` constant: Activities API base URL (default: `http://localhost:8000/api/v1/activities`)
- Handles `UPLOAD_CSV` messages: POSTs CSV to `/api/v1/snapshots/upload`
- Handles `FETCH_ROBINHOOD` messages: POSTs to `/api/v1/snapshots/fetch-robinhood` with 150s timeout
- Handles `UPLOAD_ACTIVITY_CSV` messages: POSTs CSV to `/api/v1/activities/upload-fidelity`
- Handles `MOVE_ACTIVITY_DOWNLOAD` messages: POSTs to `/api/v1/activities/move-download` to clean up downloaded file from portfolio_daily/ (archival is now done during upload)
- Handles `RENAME_POSITIONS_DOWNLOAD` messages: POSTs to `/api/v1/snapshots/rename-download` to fix timezone mismatch in filename
- Positions filename: `Portfolio_Positions_Mon-DD-YYYY.csv`
- Activity filename: `Accounts_History_Mon-DD-YYYY.csv`

### Message Types
| Message | Direction | Purpose |
|---|---|---|
| `FIDELITY_EXT_START_CAPTURE` + `captureType` | content→interceptor | Arm interceptor with CSV type ('positions' or 'activity') |
| `FIDELITY_EXT_CSV_CAPTURED` | interceptor→content | Positions CSV blob captured |
| `FIDELITY_EXT_ACTIVITY_CSV_CAPTURED` | interceptor→content | Activity CSV blob captured |
| `FIDELITY_EXT_CSV_CAPTURE_FAILED` | interceptor→content | Blob validation or read failed |
| `UPLOAD_CSV` | content→background | Upload positions CSV to backend |
| `FETCH_ROBINHOOD` | content→background | Trigger Robinhood fetch via backend |
| `UPLOAD_ACTIVITY_CSV` | content→background | Upload activity CSV to backend |
| `MOVE_ACTIVITY_DOWNLOAD` | content→background | Clean up downloaded CSV from portfolio_daily/ |
| `RENAME_POSITIONS_DOWNLOAD` | content→background | Rename positions CSV to use local date |

### Target Pages
- `https://digital.fidelity.com/ftgw/digital/portfolio/positions`
- `https://digital.fidelity.com/ftgw/digital/portfolio/summary`
- `https://digital.fidelity.com/ftgw/digital/portfolio/activity`

### Quick Download Automation (`performQuickDownload()`)
Automates Fidelity's native positions CSV download with this sequence:
1. Click `.acct-selector__all-accounts-wrapper` (All Accounts)
2. Click `a.new-tab__tab[href="ftgw/digital/portfolio/positions"]` (Positions tab)
3. Wait for `select[aria-label="view"]` to appear (up to 15s via MutationObserver), then set to `MyView` and dispatch change event
4. Click `button:has([pvd-name="nav__overflow-vertical"])` (overflow menu)
5. Click `#kebabmenuitem-download` (Download option)

Uses `MutationObserver` (`waitForElement`) to wait for dynamically loaded elements (view dropdown, menu items).

### Activity Download Automation (`performActivityDownload()`)
Automates Fidelity's activity CSV download with this sequence:
1. Click `a.new-tab__tab[href="ftgw/digital/portfolio/activity"]` (Activity & Orders tab)
2. Wait for page load (~2s)
3. Click `.acct-selector__all-accounts-wrapper` (All Accounts if not selected)
4. Click `span.timeperiod-select-result` (time period trigger)
5. Find and click "Past 10 days" radio option by label text content
6. Click "Apply" button by text content
7. Wait for data reload (~2s)
8. Click `button[aria-label="Download"]` (Download icon)
9. Click `#downloadContent button` ("Download as CSV" in dropdown popup)

### Output
- Positions CSV file still downloads to browser's default download location (unchanged)
- Positions CSV is also uploaded to backend API automatically
- Activity CSV downloads to browser's default download location
- Activity CSV is uploaded to backend API with deduplication (safe to re-run)
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
| Activity tab/selectors not found | "Done! (Activity skipped)" (orange) | Yes | Yes |
| Activity CSV capture timeout | "Done! (Activity skipped)" (orange) | Yes | Yes |
| Activity upload failed | "Done! (Act upload failed)" (orange) | Yes | Yes |

Fidelity upload is committed before RH fetch starts. RH failure never affects the Fidelity snapshot. Activity stages are non-fatal — positions and Robinhood are already done.

### Configuration
- `API_BASE` in `background.js`: Set to snapshots API base URL (default: `http://localhost:8000/api/v1/snapshots`)
- `ACTIVITY_API_BASE` in `background.js`: Set to activities API base URL (default: `http://localhost:8000/api/v1/activities`)
- `host_permissions` in `manifest.json`: Must match the API URL origin
- Robinhood fetch requires `ROBINHOOD_USERNAME` and `ROBINHOOD_PASSWORD` in backend `.env`
