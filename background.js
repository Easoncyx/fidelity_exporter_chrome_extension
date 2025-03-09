// Listen for tab updates to detect Fidelity positions page load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('https://digital.fidelity.com/ftgw/digital/portfolio/positions')) {
        console.log('Fidelity positions page detected, checking last run date');
        chrome.storage.local.get(['lastRunDate'], (result) => {
            const today = new Date().toISOString().split('T')[0];
            console.log('Last run date:', result.lastRunDate, 'Today:', today);
            if (result.lastRunDate !== today) {
                console.log('Triggering autoExport for tab:', tabId);
                // Trigger export via content script
                chrome.tabs.sendMessage(tabId, { action: 'autoExport' }, response => {
                    console.log('Sent autoExport message, response:', response);
                });
                // Update last run date
                chrome.storage.local.set({ lastRunDate: today });
            } else {
                console.log('Already exported today, skipping auto-export');
            }
        });
    }
});

// Convert data to CSV format
function convertToCSV(headers, data) {
    const csvRows = [
        headers.map(header => `"${header}"`).join(','), // Header row
        ...data.map(row => row.map(value => `"${(value || '').replace(/"/g, '""')}"`).join(','))
    ];
    return csvRows.join('\n');
}

// Handle export requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    if (message.action === 'export') {
        console.log('Processing export request with data rows:', message.data?.length);
        const csv = convertToCSV(message.headers, message.data);
        const date = new Date().toISOString().split('T')[0];
        const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        chrome.downloads.download({
            url: dataUrl,
            filename: `positions_${date}.csv`
        }, (downloadId) => {
            console.log('Download initiated with ID:', downloadId);
            sendResponse({ status: 'done', downloadId });
        });
        return true; // Keep message channel open for async response
    }
});