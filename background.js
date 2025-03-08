// Convert data to CSV format
function convertToCSV(headers, data) {
    const csvRows = [
        headers.map(header => `"${header}"`).join(','), // Header row
        ...data.map(row => row.map(value => `"${(value || '').replace(/"/g, '""')}"`).join(','))
    ];
    return csvRows.join('\n');
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'export') {
        const csv = convertToCSV(message.headers, message.data);
        const date = new Date().toISOString().split('T')[0];
        const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        chrome.downloads.download({
            url: dataUrl,
            filename: `positions_${date}.csv`
        }, () => {
            sendResponse({ status: 'done' });
        });
        return true; // Keep the message channel open for async response
    }
});