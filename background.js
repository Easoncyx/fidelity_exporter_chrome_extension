// Backend API URL - change this for remote access (e.g., Tailscale)
const API_URL = 'http://localhost:8000/api/v1/snapshots/upload';

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPLOAD_CSV') {
        handleUpload(message.csvText)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
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

    console.log(`[Fidelity Ext] Uploading ${filename} (${csvText.length} bytes) to ${API_URL}`);

    const response = await fetch(API_URL, {
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
