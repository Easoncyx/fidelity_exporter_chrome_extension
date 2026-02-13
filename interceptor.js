// MAIN world interceptor: hooks URL.createObjectURL to capture CSV blob content.
// Runs at document_start before Fidelity's page JS.
//
// Flow: content.js arms interceptor via postMessage -> Fidelity triggers download
// via createObjectURL(blob) -> interceptor reads blob text -> posts CSV back to content.js
(function () {
    'use strict';

    const originalCreateObjectURL = URL.createObjectURL;
    let armed = false;

    // Listen for arm signal from content.js (ISOLATED world)
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data?.type === 'FIDELITY_EXT_START_CAPTURE') {
            armed = true;
            console.log('[Fidelity Ext] Interceptor armed, waiting for CSV blob...');
        }
    });

    URL.createObjectURL = function (obj) {
        // Always call original immediately so download proceeds normally
        const url = originalCreateObjectURL.call(URL, obj);

        if (armed && obj instanceof Blob) {
            armed = false; // One-shot: disarm after first capture
            console.log('[Fidelity Ext] Blob detected, reading content...');

            const reader = new FileReader();
            reader.onload = () => {
                const text = reader.result;
                // Validate it looks like a Fidelity CSV
                if (text && text.includes('Account Name') && text.includes('Symbol') && text.includes('Description')) {
                    console.log('[Fidelity Ext] CSV captured, relaying to content script...');
                    window.postMessage({
                        type: 'FIDELITY_EXT_CSV_CAPTURED',
                        csvText: text
                    }, '*');
                } else {
                    console.log('[Fidelity Ext] Blob is not a Fidelity CSV, ignoring');
                    window.postMessage({
                        type: 'FIDELITY_EXT_CSV_CAPTURE_FAILED',
                        reason: 'not_csv'
                    }, '*');
                }
            };
            reader.onerror = () => {
                console.error('[Fidelity Ext] Failed to read blob');
                window.postMessage({
                    type: 'FIDELITY_EXT_CSV_CAPTURE_FAILED',
                    reason: 'read_error'
                }, '*');
            };
            reader.readAsText(obj);
        }

        return url;
    };

    // Preserve toString to avoid detection
    URL.createObjectURL.toString = () => 'function createObjectURL() { [native code] }';
})();
