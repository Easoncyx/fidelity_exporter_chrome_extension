// Backend API base URL - change this for remote access (e.g., Tailscale)
const API_BASE = 'http://localhost:8000/api/v1/snapshots';

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
