// Wait for the grid to load
const checkData = setInterval(() => {
    const grid = document.getElementById('posweb-grid');
    if (grid && grid.querySelector('[role="row"]')) {
        clearInterval(checkData);
        injectButton();
    }
}, 1000);

// Inject an export button into the page
function injectButton() {
    const button = document.createElement('button');
    button.textContent = 'Export Data';
    button.style.position = 'fixed';
    button.style.bottom = '10px';
    button.style.right = '10px';
    button.style.zIndex = '1000';
    document.body.appendChild(button);

    button.addEventListener('click', () => {
        button.textContent = 'Exporting...';
        const { headers, data } = extractData();
        chrome.runtime.sendMessage({ action: 'export', headers, data }, () => {
            button.textContent = 'Export Data';
        });
    });
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
        console.log('rowId:', rowId);
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