// Listen for automatic export trigger from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    if (message.action === 'autoExport') {
        console.log('Executing autoExport action');
        
        // Check if grid is loaded before extracting
        const grid = document.getElementById('posweb-grid');
        if (!grid || !grid.querySelector('[role="row"]')) {
            console.log('Grid not yet loaded, setting up wait interval for autoExport');
            // Wait for grid to load before extracting
            const waitForGrid = setInterval(() => {
                const grid = document.getElementById('posweb-grid');
                if (grid && grid.querySelector('[role="row"]')) {
                    clearInterval(waitForGrid);
                    console.log('Grid now loaded, proceeding with extraction');
                    const { headers, data } = extractData();
                    console.log('Extracted data:', { headerCount: headers.length, rowCount: data.length });
                    chrome.runtime.sendMessage({ action: 'export', headers, data }, response => {
                        console.log('Export response:', response);
                    });
                }
            }, 1000);
        } else {
            // Grid is already loaded, extract immediately
            const { headers, data } = extractData();
            console.log('Extracted data:', { headerCount: headers.length, rowCount: data.length });
            chrome.runtime.sendMessage({ action: 'export', headers, data }, response => {
                console.log('Export response:', response);
            });
        }
    }
    return true; // Keep the message channel open for async response
});


// Check if we're on the positions page or summary page
const isPositionsPage = window.location.href.includes('/portfolio/positions');
const isSummaryPage = window.location.href.includes('/portfolio/summary');

if (isPositionsPage) {
    // Wait for the positions grid to load, then inject buttons
    const checkData = setInterval(() => {
        const grid = document.getElementById('posweb-grid');
        if (grid && grid.querySelector('[role="row"]')) {
            clearInterval(checkData);
            injectButton(true); // true = show both buttons
        }
    }, 1000);
} else if (isSummaryPage) {
    // On summary page, inject Quick Download button immediately (no grid to wait for)
    // Wait a short moment for the page to stabilize
    setTimeout(() => {
        injectButton(false); // false = only show Quick Download button
    }, 1000);
}

// Inject export buttons into the page
// showExportButton: true to show both buttons, false to show only Quick Download
function injectButton(showExportButton = true) {
    // Create container for buttons
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '10px';
    container.style.right = '10px';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);

    // Original export button (scrapes current view) - only on positions page
    if (showExportButton) {
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export Data';
        exportButton.style.padding = '8px 16px';
        exportButton.style.cursor = 'pointer';
        container.appendChild(exportButton);

        exportButton.addEventListener('click', () => {
            exportButton.textContent = 'Exporting...';
            const { headers, data } = extractData();
            chrome.runtime.sendMessage({ action: 'export', headers, data }, () => {
                exportButton.textContent = 'Export Data';
            });
        });
    }

    // One-click download button (uses Fidelity's native download) - on both pages
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Quick Download';
    downloadButton.style.padding = '8px 16px';
    downloadButton.style.cursor = 'pointer';
    downloadButton.style.backgroundColor = '#4CAF50';
    downloadButton.style.color = 'white';
    downloadButton.style.border = 'none';
    downloadButton.style.borderRadius = '4px';
    container.appendChild(downloadButton);

    downloadButton.addEventListener('click', () => {
        downloadButton.textContent = 'Downloading...';
        downloadButton.disabled = true;
        performQuickDownload()
            .then(() => {
                downloadButton.textContent = 'Quick Download';
                downloadButton.disabled = false;
            })
            .catch(err => {
                console.error('Quick download failed:', err);
                downloadButton.textContent = 'Failed - Retry';
                downloadButton.disabled = false;
            });
    });
}

// Perform the one-click download sequence:
// 1. Click "All Accounts" (if not already selected)
// 2. Click "Positions" tab
// 3. Change dropdown to "My View"
// 4. Click the overflow menu button
// 5. Click the Download option
async function performQuickDownload() {
    // Helper to wait for an element to appear
    const waitForElement = (selector, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout waiting for ${selector}`));
            }, timeout);
        });
    };

    // Helper to wait a bit for UI to update
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Step 1: Click "All Accounts" if not already selected
    const allAccountsWrapper = document.querySelector('.acct-selector__all-accounts-wrapper');
    if (allAccountsWrapper && !allAccountsWrapper.classList.contains('selected-hint')) {
        console.log('Clicking All Accounts...');
        allAccountsWrapper.click();
        await delay(1000); // Wait for page to update
    } else {
        console.log('All Accounts already selected');
    }

    // Step 2: Click "Positions" tab
    const positionsTab = document.querySelector('a.new-tab__tab[href="ftgw/digital/portfolio/positions"]');
    if (positionsTab) {
        console.log('Clicking Positions tab...');
        positionsTab.click();
        await delay(1500); // Wait for positions page to load
    } else {
        console.log('Positions tab not found or already on positions page');
    }

    // Step 3: Change dropdown to "My View"
    const viewDropdown = document.querySelector('select[aria-label="view"]');
    if (viewDropdown) {
        if (viewDropdown.value !== 'MyView') {
            console.log('Changing view to My View...');
            viewDropdown.value = 'MyView';
            viewDropdown.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(1500); // Wait for grid to reload
        } else {
            console.log('My View already selected');
        }
    } else {
        throw new Error('View dropdown not found');
    }

    // Step 4: Click the overflow menu button (Available Actions)
    console.log('Opening menu...');
    const menuButton = document.querySelector('button:has([pvd-name="nav__overflow-vertical"])');
    if (menuButton) {
        menuButton.click();
        await delay(500); // Wait for menu to open
    } else {
        throw new Error('Menu button not found');
    }

    // Step 5: Click the Download option
    console.log('Clicking download...');
    const downloadOption = await waitForElement('#kebabmenuitem-download', 3000);
    downloadOption.click();

    console.log('Quick download initiated!');
}

// Extract data from the grid
function extractData() {
    // Get all rows from the pinned left container
    const leftRows = document.querySelectorAll('.ag-pinned-left-cols-container [role="row"]');
    
    // Get all rows from the center container and create a map by row-id
    const centerRows = Array.from(document.querySelectorAll('.ag-center-cols-container [role="row"]'));
    const centerRowsMap = {};
    centerRows.forEach(row => {
        const rowId = row.getAttribute('row-id');
        centerRowsMap[rowId] = row;
    });

    // Determine column order from the first center row
    let colOrder = [];
    if (centerRows.length > 0) {
        const firstCenterRow = centerRows[0];
        const cells = firstCenterRow.querySelectorAll('[role="gridcell"]');
        colOrder = Array.from(cells).map(cell => cell.getAttribute('col-id'));
    }

    // Define headers with "Symbol" as the first column
    const headers = ['Symbol', ...colOrder];

    // Collect data for each row
    const data = [];

    leftRows.forEach(leftRow => {
        // Skip "Pending Activity" and "Account Total" rows
        if (leftRow.classList.contains('posweb-row-pending_activity') || 
            leftRow.classList.contains('posweb-row-total') || 
            leftRow.classList.contains('posweb-row-grand_total')) {
            return; // Skip this row
        }
        
        // Proceed with extraction for account and position rows
        const rowId = leftRow.getAttribute('row-id');
        const symbol = extractSymbol(leftRow);
        const centerRow = centerRowsMap[rowId];

        if (centerRow) {
            const rowData = [symbol];
            colOrder.forEach(colId => {
                const cell = centerRow.querySelector(`[col-id="${colId}"]`);
                const value = cell ? extractCellValue(cell, colId) : '';
                rowData.push(value);
            });
            data.push(rowData);
        }
    });

    return { headers, data };
}

// Extract symbol or label based on row type
function extractSymbol(leftRow) {
    const cell = leftRow.querySelector('[col-id="sym"]');
    if (!cell) return '';

    // Handle account rows
    if (leftRow.classList.contains('posweb-row-account')) {
        const accountPrimary = cell.querySelector('.posweb-cell-account_primary');
        return accountPrimary ? accountPrimary.textContent.trim() : '';
    } 
    // Handle position, pending activity, and total rows
    else {
        const symbolContainer = cell.querySelector('.posweb-cell-symbol-name_container');
        if (symbolContainer) {
            const span = symbolContainer.querySelector('span');
            if (span) {
                return span.textContent.trim(); // Position rows (e.g., "Cash")
            } else {
                const p = symbolContainer.querySelector('.posweb-cell-symbol-name');
                return p ? p.textContent.trim() : ''; // Pending Activity, Total rows
            }
        }
    }
    return '';
}

// Extract cell value with special handling for certain columns
function extractCellValue(cell, colId) {
    if (colId === 'qty') {
        const quantitySpan = cell.querySelector('.posweb-cell-quantity_value');
        return quantitySpan ? quantitySpan.textContent.trim() : '';
    } else if (colId === 'curVal') {
        // For current value, prefer the direct text or link text, avoiding nested elements
        const valueElement = cell.querySelector('.ag-cell-value');
        const link = cell.querySelector('.posweb-cell-current_value');
        return link ? link.textContent.trim() : (valueElement ? valueElement.textContent.trim() : '');
    } else {
        const valueElement = cell.querySelector('.ag-cell-value');
        return valueElement ? valueElement.textContent.trim() : '';
    }
}