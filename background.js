// Backend API base URLs - change these for remote access (e.g., Tailscale)
const API_BASE = 'http://localhost:8000/api/v1/snapshots';
const ACTIVITY_API_BASE = 'http://localhost:8000/api/v1/activities';

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPLOAD_CSV') {
        handleUpload(message.csvText)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
    }
    if (message.type === 'FETCH_ROBINHOOD') {
        handleFetchRobinhood()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
    if (message.type === 'UPLOAD_ACTIVITY_CSV') {
        handleActivityUpload(message.csvText)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
    if (message.type === 'MOVE_ACTIVITY_DOWNLOAD') {
        handleMoveActivityDownload()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
    if (message.type === 'RENAME_POSITIONS_DOWNLOAD') {
        handleRenamePositionsDownload()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

// Upload CSV text to backend API as multipart form data
async function handleUpload(csvText) {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const filename = `Portfolio_Positions_${month}-${day}-${year}.csv`;

    const blob = new Blob([csvText], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, filename);

    const uploadUrl = `${API_BASE}/upload`;
    console.log(`[Fidelity Ext] Uploading ${filename} (${csvText.length} bytes) to ${uploadUrl}`);

    const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log('[Fidelity Ext] Upload response:', data);

    return {
        success: true,
        snapshot: {
            positions_count: data.positions_count,
            accounts_count: data.accounts_count,
            date: data.snapshot?.date
        }
    };
}

// Fetch Robinhood positions via backend API (requires MFA push approval, up to 150s)
async function handleFetchRobinhood() {
    const fetchUrl = `${API_BASE}/fetch-robinhood`;
    console.log(`[Fidelity Ext] Fetching Robinhood positions from ${fetchUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000);

    try {
        const response = await fetch(fetchUrl, {
            method: 'POST',
            signal: controller.signal
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API error ${response.status}: ${text}`);
        }

        const data = await response.json();
        console.log('[Fidelity Ext] Robinhood fetch response:', data);

        return {
            success: true,
            snapshot: {
                positions_count: data.positions_count,
                accounts_count: data.accounts_count,
                date: data.snapshot?.date
            }
        };
    } finally {
        clearTimeout(timeout);
    }
}

// Upload activity CSV text to backend API
async function handleActivityUpload(csvText) {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const filename = `Accounts_History_${month}-${day}-${year}.csv`;

    const blob = new Blob([csvText], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, filename);

    const uploadUrl = `${ACTIVITY_API_BASE}/upload-fidelity`;
    console.log(`[Fidelity Ext] Uploading activity ${filename} (${csvText.length} bytes) to ${uploadUrl}`);

    const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log('[Fidelity Ext] Activity upload response:', data);

    return {
        success: true,
        activity: {
            new_records: data.new_records,
            duplicates_skipped: data.duplicates_skipped,
            total_rows: data.total_rows
        }
    };
}

// Move downloaded activity CSV from portfolio_daily/ to fidelity_activity/{year}/
async function handleMoveActivityDownload() {
    const moveUrl = `${ACTIVITY_API_BASE}/move-download`;
    console.log(`[Fidelity Ext] Moving activity download via ${moveUrl}`);

    const response = await fetch(moveUrl, { method: 'POST' });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log('[Fidelity Ext] Move response:', data);

    return { success: true, moved: data.moved };
}

// Rename downloaded positions CSV to use today's local date
async function handleRenamePositionsDownload() {
    const renameUrl = `${API_BASE}/rename-download`;
    console.log(`[Fidelity Ext] Renaming positions download via ${renameUrl}`);

    const response = await fetch(renameUrl, { method: 'POST' });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log('[Fidelity Ext] Rename response:', data);

    return { success: true, renamed: data.renamed, from: data.from, to: data.to };
}
