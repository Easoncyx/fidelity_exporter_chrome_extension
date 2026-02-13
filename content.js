// Check if we're on the positions page, summary page, or activity page
const isPositionsPage = window.location.href.includes('/portfolio/positions');
const isSummaryPage = window.location.href.includes('/portfolio/summary');
const isActivityPage = window.location.href.includes('/portfolio/activity');

// Inject buttons on all supported pages
if (isPositionsPage || isSummaryPage || isActivityPage) {
    setTimeout(() => {
        injectButtons();
    }, 1000);
}

// --- Shared helpers ---

function setButtonState(button, text, bgColor) {
    button.textContent = text;
    button.style.backgroundColor = bgColor;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) { resolve(element); return; }
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { observer.disconnect(); resolve(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout waiting for ${selector}`)); }, timeout);
    });
}

function waitForCsvCapture(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.source !== window) return;
            if (event.data?.type === 'FIDELITY_EXT_CSV_CAPTURED') { cleanup(); resolve(event.data.csvText); }
            else if (event.data?.type === 'FIDELITY_EXT_CSV_CAPTURE_FAILED') { cleanup(); reject(new Error(`Capture failed: ${event.data.reason}`)); }
        };
        const timer = setTimeout(() => { cleanup(); reject(new Error('CSV capture timeout')); }, timeoutMs);
        function cleanup() { window.removeEventListener('message', handler); clearTimeout(timer); }
        window.addEventListener('message', handler);
    });
}

function waitForActivityCsvCapture(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.source !== window) return;
            if (event.data?.type === 'FIDELITY_EXT_ACTIVITY_CSV_CAPTURED') { cleanup(); resolve(event.data.csvText); }
            else if (event.data?.type === 'FIDELITY_EXT_CSV_CAPTURE_FAILED') { cleanup(); reject(new Error(`Capture failed: ${event.data.reason}`)); }
        };
        const timer = setTimeout(() => { cleanup(); reject(new Error('Activity CSV capture timeout')); }, timeoutMs);
        function cleanup() { window.removeEventListener('message', handler); clearTimeout(timer); }
        window.addEventListener('message', handler);
    });
}

function checkExtensionContext() {
    if (!chrome.runtime?.id) {
        throw new Error('Extension context invalidated — reload the page');
    }
}

// --- Reusable operations ---
// Each returns { success, error? } so callers can decide how to react.

// Download positions CSV, capture blob, upload to backend
async function doPositions(button) {
    // Download
    setButtonState(button, 'Downloading...', '#4CAF50');
    window.postMessage({ type: 'FIDELITY_EXT_START_CAPTURE', captureType: 'positions' }, '*');
    const capturePromise = waitForCsvCapture(15000);

    try {
        await performQuickDownload();
    } catch (err) {
        console.error('[Fidelity Ext] Quick download failed:', err);
        return { success: false, error: 'download_failed' };
    }

    // Capture
    let csvText;
    try {
        csvText = await capturePromise;
        console.log('[Fidelity Ext] CSV captured, length:', csvText.length);
    } catch (err) {
        console.warn('[Fidelity Ext] CSV capture failed:', err.message);
        return { success: false, error: 'capture_failed' };
    }

    // Upload
    setButtonState(button, 'Uploading...', '#2196F3');
    checkExtensionContext();

    const response = await chrome.runtime.sendMessage({ type: 'UPLOAD_CSV', csvText });
    if (!response?.success) {
        console.error('[Fidelity Ext] Upload failed:', response?.error);
        return { success: false, error: 'upload_failed' };
    }
    console.log('[Fidelity Ext] Upload successful:', response.snapshot);
    return { success: true };
}

// Fetch Robinhood positions via backend
async function doRobinhood(button) {
    setButtonState(button, 'Fetching Robinhood...', '#9C27B0');
    checkExtensionContext();

    try {
        const response = await chrome.runtime.sendMessage({ type: 'FETCH_ROBINHOOD' });
        if (response?.success) {
            console.log('[Fidelity Ext] Robinhood fetch successful:', response.snapshot);
            return { success: true };
        }
        console.warn('[Fidelity Ext] Robinhood fetch failed:', response?.error);
        return { success: false, error: 'fetch_failed' };
    } catch (err) {
        console.warn('[Fidelity Ext] Robinhood fetch error:', err);
        return { success: false, error: 'fetch_error' };
    }
}

// Download activity CSV, capture blob, upload to backend
async function doActivity(button) {
    // Download
    setButtonState(button, 'Downloading Activity...', '#FF6F00');
    window.postMessage({ type: 'FIDELITY_EXT_START_CAPTURE', captureType: 'activity' }, '*');
    const capturePromise = waitForActivityCsvCapture(15000);

    try {
        await performActivityDownload();
    } catch (err) {
        console.warn('[Fidelity Ext] Activity download failed:', err.message);
        return { success: false, error: 'download_failed' };
    }

    let csvText;
    try {
        csvText = await capturePromise;
        console.log('[Fidelity Ext] Activity CSV captured, length:', csvText.length);
    } catch (err) {
        console.warn('[Fidelity Ext] Activity capture failed:', err.message);
        return { success: false, error: 'capture_failed' };
    }

    // Upload
    setButtonState(button, 'Uploading Activity...', '#00897B');
    checkExtensionContext();

    const response = await chrome.runtime.sendMessage({ type: 'UPLOAD_ACTIVITY_CSV', csvText });
    if (!response?.success) {
        console.warn('[Fidelity Ext] Activity upload failed:', response?.error);
        return { success: false, error: 'upload_failed' };
    }
    console.log('[Fidelity Ext] Activity upload successful:', response.activity);

    // Move downloaded file from portfolio_daily/ to fidelity_activity/{year}/
    setButtonState(button, 'Moving file...', '#00897B');
    try {
        const moveResponse = await chrome.runtime.sendMessage({ type: 'MOVE_ACTIVITY_DOWNLOAD' });
        if (moveResponse?.success) {
            console.log('[Fidelity Ext] Activity file moved:', moveResponse.moved);
        } else {
            console.warn('[Fidelity Ext] Activity file move failed:', moveResponse?.error);
        }
    } catch (err) {
        // Non-fatal: upload already succeeded, file just stays in download location
        console.warn('[Fidelity Ext] Activity file move error:', err);
    }

    return { success: true };
}

// --- Button creation ---

// All buttons, so we can disable/enable them as a group
let allButtons = [];

function setAllButtonsDisabled(disabled) {
    allButtons.forEach(b => { b.disabled = disabled; });
}

function createButton(text, bgColor, fontSize) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.padding = '6px 12px';
    btn.style.cursor = 'pointer';
    btn.style.backgroundColor = bgColor;
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.fontSize = fontSize || '13px';
    btn.style.width = '100%';
    return btn;
}

function resetButton(btn, text, bgColor, delayMs = 4000) {
    setTimeout(() => {
        setButtonState(btn, text, bgColor);
        setAllButtonsDisabled(false);
    }, delayMs);
}

function injectButtons() {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '10px';
    container.style.right = '10px';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.alignItems = 'stretch';
    container.style.width = '140px';
    document.body.appendChild(container);

    // Quick Download — all-in-one
    const quickBtn = createButton('Quick Download', '#4CAF50', '13px');
    quickBtn.style.fontWeight = 'bold';

    // Individual buttons
    const posBtn = createButton('Positions', '#2196F3', '12px');
    const actBtn = createButton('Activity', '#FF6F00', '12px');
    const rhBtn = createButton('Robinhood', '#9C27B0', '12px');

    // Row for individual buttons
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '4px';

    // Make individual buttons share the row equally
    [posBtn, actBtn, rhBtn].forEach(btn => {
        btn.style.width = 'auto';
        btn.style.flex = '1';
        btn.style.padding = '4px 2px';
        btn.style.fontSize = '11px';
    });

    row.appendChild(posBtn);
    row.appendChild(actBtn);
    row.appendChild(rhBtn);
    container.appendChild(quickBtn);
    container.appendChild(row);

    allButtons = [quickBtn, posBtn, actBtn, rhBtn];

    // --- Quick Download: all-in-one ---
    quickBtn.addEventListener('click', async () => {
        setAllButtonsDisabled(true);

        try {
            // Stage 1-2: Positions
            const posResult = await doPositions(quickBtn);
            if (!posResult.success) {
                if (posResult.error === 'download_failed') {
                    setButtonState(quickBtn, 'Failed - Retry', '#f44336');
                } else if (posResult.error === 'capture_failed') {
                    setButtonState(quickBtn, 'Downloaded (no upload)', '#FF9800');
                } else {
                    setButtonState(quickBtn, 'Upload Failed', '#f44336');
                }
                resetButton(quickBtn, 'Quick Download', '#4CAF50');
                return;
            }

            // Stage 3: Robinhood
            const rhResult = await doRobinhood(quickBtn);
            if (!rhResult.success) {
                setButtonState(quickBtn, 'Uploaded! (RH failed)', '#FF9800');
                resetButton(quickBtn, 'Quick Download', '#4CAF50');
                return;
            }

            // Stage 4-5: Activity
            const actResult = await doActivity(quickBtn);
            if (!actResult.success) {
                setButtonState(quickBtn, 'Done! (Activity skipped)', '#FF9800');
                resetButton(quickBtn, 'Quick Download', '#4CAF50');
                return;
            }

            setButtonState(quickBtn, 'All Done!', '#4CAF50');
            resetButton(quickBtn, 'Quick Download', '#4CAF50');
        } catch (err) {
            console.error('[Fidelity Ext] Quick Download error:', err);
            setButtonState(quickBtn, 'Error', '#f44336');
            resetButton(quickBtn, 'Quick Download', '#4CAF50');
        }
    });

    // --- Positions only ---
    posBtn.addEventListener('click', async () => {
        setAllButtonsDisabled(true);

        try {
            const result = await doPositions(posBtn);
            if (result.success) {
                setButtonState(posBtn, 'Done!', '#4CAF50');
            } else if (result.error === 'download_failed') {
                setButtonState(posBtn, 'Failed', '#f44336');
            } else if (result.error === 'capture_failed') {
                setButtonState(posBtn, 'No capture', '#FF9800');
            } else {
                setButtonState(posBtn, 'Failed', '#f44336');
            }
        } catch (err) {
            console.error('[Fidelity Ext] Positions error:', err);
            setButtonState(posBtn, 'Error', '#f44336');
        }
        resetButton(posBtn, 'Positions', '#2196F3');
    });

    // --- Activity only ---
    actBtn.addEventListener('click', async () => {
        setAllButtonsDisabled(true);

        try {
            const result = await doActivity(actBtn);
            if (result.success) {
                setButtonState(actBtn, 'Done!', '#4CAF50');
            } else {
                setButtonState(actBtn, 'Failed', '#f44336');
            }
        } catch (err) {
            console.error('[Fidelity Ext] Activity error:', err);
            setButtonState(actBtn, 'Error', '#f44336');
        }
        resetButton(actBtn, 'Activity', '#FF6F00');
    });

    // --- Robinhood only ---
    rhBtn.addEventListener('click', async () => {
        setAllButtonsDisabled(true);

        try {
            const result = await doRobinhood(rhBtn);
            if (result.success) {
                setButtonState(rhBtn, 'Done!', '#4CAF50');
            } else {
                setButtonState(rhBtn, 'Failed', '#FF9800');
            }
        } catch (err) {
            console.error('[Fidelity Ext] Robinhood error:', err);
            setButtonState(rhBtn, 'Error', '#f44336');
        }
        resetButton(rhBtn, 'Robinhood', '#9C27B0');
    });
}

// --- DOM automation sequences ---

// Positions CSV: All Accounts → Positions tab → My View → overflow menu → Download
async function performQuickDownload() {
    const allAccountsWrapper = document.querySelector('.acct-selector__all-accounts-wrapper');
    if (allAccountsWrapper && !allAccountsWrapper.classList.contains('selected-hint')) {
        console.log('Clicking All Accounts...');
        allAccountsWrapper.click();
        await delay(1000);
    } else {
        console.log('All Accounts already selected');
    }

    const positionsTab = document.querySelector('a.new-tab__tab[href="ftgw/digital/portfolio/positions"]');
    if (positionsTab) {
        console.log('Clicking Positions tab...');
        positionsTab.click();
        await delay(1500);
    } else {
        console.log('Positions tab not found or already on positions page');
    }

    const viewDropdown = document.querySelector('select[aria-label="view"]');
    if (viewDropdown) {
        if (viewDropdown.value !== 'MyView') {
            console.log('Changing view to My View...');
            viewDropdown.value = 'MyView';
            viewDropdown.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(1500);
        } else {
            console.log('My View already selected');
        }
    } else {
        throw new Error('View dropdown not found');
    }

    console.log('Opening menu...');
    const menuButton = document.querySelector('button:has([pvd-name="nav__overflow-vertical"])');
    if (menuButton) {
        menuButton.click();
        await delay(500);
    } else {
        throw new Error('Menu button not found');
    }

    console.log('Clicking download...');
    const downloadOption = await waitForElement('#kebabmenuitem-download', 3000);
    downloadOption.click();

    console.log('Quick download initiated!');
}

// Activity CSV: Activity tab → All Accounts → Past 10 days → Apply → Download
async function performActivityDownload() {
    const activityTab = document.querySelector('a.new-tab__tab[href="ftgw/digital/portfolio/activity"]');
    if (activityTab) {
        console.log('[Fidelity Ext] Clicking Activity & Orders tab...');
        activityTab.click();
        await delay(2000);
    } else {
        throw new Error('Activity & Orders tab not found');
    }

    const allAccountsWrapper = document.querySelector('.acct-selector__all-accounts-wrapper');
    if (allAccountsWrapper && !allAccountsWrapper.classList.contains('selected-hint')) {
        console.log('[Fidelity Ext] Clicking All Accounts...');
        allAccountsWrapper.click();
        await delay(1000);
    }

    const timePeriodTrigger = document.querySelector('span.timeperiod-select-result');
    if (timePeriodTrigger) {
        console.log('[Fidelity Ext] Opening time period selector...');
        timePeriodTrigger.click();
        await delay(500);
    } else {
        throw new Error('Time period selector not found');
    }

    const radioLabels = document.querySelectorAll('label');
    let past10DaysFound = false;
    for (const label of radioLabels) {
        if (label.textContent.trim().includes('Past 10 days')) {
            console.log('[Fidelity Ext] Selecting Past 10 days...');
            label.click();
            past10DaysFound = true;
            break;
        }
    }
    if (!past10DaysFound) {
        throw new Error('"Past 10 days" option not found');
    }

    await delay(300);

    const buttons = document.querySelectorAll('button');
    let applyFound = false;
    for (const btn of buttons) {
        if (btn.textContent.trim() === 'Apply') {
            console.log('[Fidelity Ext] Clicking Apply...');
            btn.click();
            applyFound = true;
            break;
        }
    }
    if (!applyFound) {
        throw new Error('Apply button not found');
    }

    await delay(2000);

    console.log('[Fidelity Ext] Clicking activity Download icon...');
    const downloadBtn = await waitForElement('button[aria-label="Download"]', 5000);
    downloadBtn.click();
    await delay(500);

    // Click "Download as CSV" in the dropdown popup
    console.log('[Fidelity Ext] Clicking Download as CSV...');
    const dropdownBtn = await waitForElement('#downloadContent button', 3000);
    dropdownBtn.click();

    console.log('[Fidelity Ext] Activity download initiated!');
}
