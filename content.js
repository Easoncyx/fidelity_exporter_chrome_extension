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

    downloadButton.addEventListener('click', () => {
        downloadButton.textContent = 'Downloading...';
        downloadButton.disabled = true;
        performQuickDownload()
            .then(() => {
                downloadButton.textContent = 'Quick Download';
                downloadButton.disabled = false;
            })
            .catch(err => {
                console.error('Quick download failed:', err);
                downloadButton.textContent = 'Failed - Retry';
                downloadButton.disabled = false;
            });
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
