// Check if we're on the positions page or summary page
const isPositionsPage = window.location.href.includes('/portfolio/positions');
const isSummaryPage = window.location.href.includes('/portfolio/summary');

// Inject Quick Download button on both pages
if (isPositionsPage || isSummaryPage) {
    // Wait a moment for the page to stabilize
    setTimeout(() => {
        injectButton();
    }, 1000);
}

// Set button style and text
function setButtonState(button, text, bgColor) {
    button.textContent = text;
    button.style.backgroundColor = bgColor;
}

// Wait for CSV capture from interceptor.js (MAIN world) via postMessage
function waitForCsvCapture(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.source !== window) return;
            if (event.data?.type === 'FIDELITY_EXT_CSV_CAPTURED') {
                cleanup();
                resolve(event.data.csvText);
            } else if (event.data?.type === 'FIDELITY_EXT_CSV_CAPTURE_FAILED') {
                cleanup();
                reject(new Error(`Capture failed: ${event.data.reason}`));
            }
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('CSV capture timeout'));
        }, timeoutMs);
        function cleanup() {
            window.removeEventListener('message', handler);
            clearTimeout(timer);
        }
        window.addEventListener('message', handler);
    });
}

// Inject Quick Download button into the page
function injectButton() {
    // Create container for button
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '10px';
    container.style.right = '10px';
    container.style.zIndex = '1000';
    document.body.appendChild(container);

    // Quick Download button (uses Fidelity's native download)
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Quick Download';
    downloadButton.style.padding = '8px 16px';
    downloadButton.style.cursor = 'pointer';
    downloadButton.style.backgroundColor = '#4CAF50';
    downloadButton.style.color = 'white';
    downloadButton.style.border = 'none';
    downloadButton.style.borderRadius = '4px';
    container.appendChild(downloadButton);

    downloadButton.addEventListener('click', async () => {
        downloadButton.disabled = true;

        // Stage 1: Downloading (green)
        setButtonState(downloadButton, 'Downloading...', '#4CAF50');

        // Arm the interceptor before starting download
        window.postMessage({ type: 'FIDELITY_EXT_START_CAPTURE' }, '*');

        // Start capture listener before triggering download
        const capturePromise = waitForCsvCapture(15000);

        try {
            // Trigger the download (unchanged)
            await performQuickDownload();
        } catch (err) {
            console.error('[Fidelity Ext] Quick download failed:', err);
            setButtonState(downloadButton, 'Failed - Retry', '#f44336');
            downloadButton.disabled = false;
            return;
        }

        // Stage 2: Wait for CSV capture, then upload
        let csvText;
        try {
            csvText = await capturePromise;
            console.log('[Fidelity Ext] CSV captured, length:', csvText.length);
        } catch (err) {
            console.warn('[Fidelity Ext] CSV capture failed:', err.message);
            setButtonState(downloadButton, 'Downloaded (no upload)', '#FF9800');
            setTimeout(() => {
                setButtonState(downloadButton, 'Quick Download', '#4CAF50');
                downloadButton.disabled = false;
            }, 3000);
            return;
        }

        // Stage 3: Uploading (blue)
        setButtonState(downloadButton, 'Uploading...', '#2196F3');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPLOAD_CSV',
                csvText: csvText
            });

            if (response?.success) {
                const snap = response.snapshot;
                setButtonState(
                    downloadButton,
                    `Uploaded! ${snap.positions_count} pos, ${snap.accounts_count} accts`,
                    '#4CAF50'
                );
                console.log('[Fidelity Ext] Upload successful:', snap);
            } else {
                console.error('[Fidelity Ext] Upload failed:', response?.error);
                setButtonState(downloadButton, 'Upload Failed', '#f44336');
            }
        } catch (err) {
            console.error('[Fidelity Ext] Upload error:', err);
            setButtonState(downloadButton, 'Upload Failed', '#f44336');
        }

        setTimeout(() => {
            setButtonState(downloadButton, 'Quick Download', '#4CAF50');
            downloadButton.disabled = false;
        }, 4000);
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
