# Fidelity Positions Exporter

This Chrome extension adds a "Quick Download" button to Fidelity's portfolio pages that automates the CSV export process.

## Features

- **Quick Download Button**: Adds a green "Quick Download" button that automates the download process: selects All Accounts → Positions tab → My View → triggers CSV download.

## Installation

1. **Download the Extension**:
   - Download or clone this repository to your local machine.

2. **Load into Chrome**:
   - Open Google Chrome and go to `chrome://extensions/`.
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked" and select the folder containing the extension files.
   - The extension will now be installed and active.

## Usage

1. Log in to Fidelity and navigate to either:
   - Portfolio Positions: `https://digital.fidelity.com/ftgw/digital/portfolio/positions`
   - Portfolio Summary: `https://digital.fidelity.com/ftgw/digital/portfolio/summary`

2. Click the green "Quick Download" button in the bottom right corner.

3. The extension will automatically:
   1. Select "All Accounts"
   2. Click the "Positions" tab
   3. Change the view dropdown to "My View"
   4. Open the overflow menu and click "Download"

4. The CSV file downloads to your browser's default download folder.

## Troubleshooting

- **Quick Download Fails**:
  - Ensure you're logged in to Fidelity
  - Check the browser console (`Cmd+Option+J`) for error messages
  - The page structure may have changed - check for missing element errors

- **Button Not Appearing**:
  - Refresh the page
  - Check that the extension is enabled in `chrome://extensions/`

## Notes

- The CSV file is named by Fidelity (typically includes date in the filename)
- Works on both the Positions page and Summary page
