// Wait for the grid to load
const checkData = setInterval(() => {
    const grid = document.getElementById('posweb-grid');
    if (grid && grid.querySelector('[role="row"]')) {
        clearInterval(checkData);
        injectButton();
    }
}, 1000);

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
        const data = extractData();
        chrome.runtime.sendMessage({ action: 'export', data: data }, () => {
            button.textContent = 'Export Data';
        });
    });
}

function extractData() {
    const grid = document.getElementById('posweb-grid');
    if (!grid) return [];

    // Step 1: Get column headers and their order
    const headerCells = grid.querySelectorAll('.ag-header-cell');
    const columnOrder = [];
    const headers = [];
    headerCells.forEach(header => {
        const colId = header.getAttribute('col-id');
        if (colId) {
            columnOrder.push(colId);
            const text = header.querySelector('.ag-header-cell-text').textContent.trim();
            headers.push(text);
        }
    });

    // Step 2: Collect all row elements
    const rowElements = grid.querySelectorAll('[role="row"]');
    const rowData = {};

    // Step 3: Group cells by row-id
    rowElements.forEach(row => {
        const rowId = row.getAttribute('row-id');
        if (!rowData[rowId]) {
            rowData[rowId] = {};
        }
        const cells = row.querySelectorAll('[role="gridcell"]');
        cells.forEach(cell => {
            const colId = cell.getAttribute('col-id');
            const valueElement = cell.querySelector('.ag-cell-value');
            const text = valueElement ? valueElement.textContent.trim() : '';
            rowData[rowId][colId] = text;
        });
    });

    // Step 4: Convert to an array of objects with header names as keys
    const data = [];
    for (const rowId in rowData) {
        const row = rowData[rowId];
        const rowObj = {};
        columnOrder.forEach((colId, index) => {
            const headerText = headers[index];
            rowObj[headerText] = row[colId] || '';
        });
        data.push(rowObj);
    }
    console.log('Extracted data:', data);
    return data;
}