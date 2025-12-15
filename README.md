# Fidelity Positions Exporter

This Chrome extension exports your Fidelity positions data to a CSV file. It automatically runs once per day when you first visit the Fidelity positions page after logging in, and also offers a manual export option.

## Features

- **Automatic Daily Export**: Exports your positions data to a CSV file once per day, triggered when you first visit the Fidelity positions page (`https://digital.fidelity.com/ftgw/digital/portfolio/positions`) after logging in.
- **Manual Export**: Adds an "Export Data" button to the positions page for on-demand exports (scrapes current view).
- **Quick Download**: Adds a "Quick Download" button that automates Fidelity's native download: selects All Accounts → Positions tab → My View → triggers CSV download.
- **Data Cleaning**: Excludes "Pending Activity" and "Account Total" rows, removes commas from quantities, and extracts stock symbols cleanly.

## Installation

1. **Download the Extension**:
   - Download or clone this repository to your local machine.

2. **Load into Chrome**:
   - Open Google Chrome and go to `chrome://extensions/`.
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked" and select the folder containing the extension files (e.g., `manifest.json`, `background.js`, `content.js`).
   - The extension will now be installed and active.

## Usage

### Automatic Export
- When you log in to Fidelity and visit the positions page (`https://digital.fidelity.com/ftgw/digital/portfolio/positions`), the extension checks if it has already exported data today.
- If it’s the first visit of the day, it automatically exports your positions data to a CSV file, which downloads to your default downloads folder.
- The export runs only once per day, even if you revisit the page or open multiple tabs.

### Manual Export
- On the Fidelity positions page, look for the "Export Data" button in the bottom right corner.
- Click the button to manually export your positions data to a CSV file at any time.
- The button text changes to "Exporting..." during the process and reverts to "Export Data" when complete.
- This scrapes the currently displayed view.

### Quick Download
- Click the green "Quick Download" button in the bottom right corner.
- This automates Fidelity's native download process by:
  1. Selecting "All Accounts"
  2. Clicking the "Positions" tab
  3. Changing the view dropdown to "My View"
  4. Opening the overflow menu and clicking "Download"
- Uses Fidelity's own CSV export, which may include different columns than the manual scrape.

## Permissions
The extension requires the following permissions:
- **`downloads`**: To save the CSV file to your computer.
- **`tabs`**: To detect when you visit the positions page for the automatic export.
- **`storage`**: To track the last export date and ensure the automatic export runs only once per day.

## Troubleshooting
- **Automatic Export Not Working**:
  - Ensure you’re on the correct URL (`https://digital.fidelity.com/ftgw/digital/portfolio/positions`).
  - Try manually exporting with the button to verify functionality.
- **Multiple Exports in One Day**:
  - This shouldn’t happen, but if it does, check Chrome’s storage via developer tools (`chrome.storage.local.get('lastRunDate')`).
- **CSV Not Downloading**:
  - Confirm the extension has all required permissions and that Chrome allows downloads.

## Notes
- The automatic export triggers only on the first visit to the positions page each day after logging in.
- The CSV file is named with the current date, e.g., `positions_2023-10-25.csv`.
- The extension runs in the background and won’t disrupt your interaction with the Fidelity website.
- If you have multiple Fidelity accounts visible on the positions page, all visible positions will be included in the export.

Enjoy effortless tracking of your Fidelity positions!