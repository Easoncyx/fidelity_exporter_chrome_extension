# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that exports Fidelity investment position data to CSV. Supports automatic daily export on first page visit, manual export via injected button, and one-click "Quick Download" that automates Fidelity's native download flow.

## Installation

Load unpacked extension via `chrome://extensions/` with Developer mode enabled.

## Architecture

### Component Communication Flow
1. **Page load detected** → `background.js` listens via `chrome.tabs.onUpdated`
2. **Daily check** → Background script checks `chrome.storage.local['lastRunDate']`
3. **Trigger export** → Sends `{ action: 'autoExport' }` message to content script
4. **DOM scraping** → `content.js` extracts data from ag-grid components
5. **CSV generation** → Content script sends `{ action: 'export', headers, data }` back to background
6. **Download** → Background script creates data URL and triggers `chrome.downloads.download`

### Key Files
- `manifest.json`: Manifest V3 config, permissions: `downloads`, `tabs`, `storage`
- `background.js`: Service worker handling tab events, CSV conversion, download initiation
- `content.js`: DOM extraction from Fidelity's ag-grid, button injection, message handling

### DOM Scraping Details (`content.js`)
- Target page: `https://digital.fidelity.com/ftgw/digital/portfolio/positions`
- Grid ID: `#posweb-grid`
- Left pinned columns: `.ag-pinned-left-cols-container` (Symbol column)
- Center columns: `.ag-center-cols-container` (all other data)
- Rows matched by `row-id` attribute between left and center containers
- Skipped row classes: `posweb-row-pending_activity`, `posweb-row-total`, `posweb-row-grand_total`
- Account rows identified by: `posweb-row-account` class

### Quick Download Automation (`performQuickDownload()`)
Automates Fidelity's native CSV download with this sequence:
1. Click `.acct-selector__all-accounts-wrapper` (All Accounts)
2. Click `a.new-tab__tab[href="ftgw/digital/portfolio/positions"]` (Positions tab)
3. Set `select[aria-label="view"]` to `MyView` and dispatch change event
4. Click `button:has([pvd-name="nav__overflow-vertical"])` (overflow menu)
5. Click `#kebabmenuitem-download` (Download option)

Uses `MutationObserver` to wait for dynamic menu elements.

### Storage
- `lastRunDate`: ISO date string (`YYYY-MM-DD`) tracking last auto-export

### Output
- Filename: `positions_YYYY-MM-DD.csv`
- Downloads to browser's default download location
