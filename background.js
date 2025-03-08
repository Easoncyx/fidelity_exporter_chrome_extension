chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'export') {
        const csv = convertToCSV(message.data); // Convert your data to a CSV string
        const date = new Date().toISOString().split('T')[0]; // e.g., "2023-10-25"
        const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        chrome.downloads.download({
            url: dataUrl,
            filename: `fidelity_positions_${date}.csv` // Dynamic filename with date
        }, () => {
            sendResponse({ status: 'done' });
        });
        return true; // Keep the message channel open for the async response
    }
});

function convertToCSV(data) {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','), // Header row
        ...data.map(row => headers.map(header => `"${(row[header] || '').replace(/"/g, '""')}"`).join(','))
    ];
    return csvRows.join('\n');
}