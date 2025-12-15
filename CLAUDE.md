# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome extension (Manifest V3) that adds a "Quick Download" button to Fidelity portfolio pages. The button automates Fidelity's native CSV download process.

## Installation

Load unpacked extension via `chrome://extensions/` with Developer mode enabled.

## Architecture

### Key Files
- `manifest.json`: Manifest V3 config, no special permissions required
- `background.js`: Empty service worker (required by manifest but unused)
- `content.js`: Quick Download button injection and UI automation

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
- Uses Fidelity's native CSV download (filename determined by Fidelity)
- Downloads to browser's default download location
