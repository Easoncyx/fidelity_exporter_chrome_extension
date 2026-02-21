// MAIN world interceptor: hooks URL.createObjectURL to capture CSV blob content.
// Runs at document_start before Fidelity's page JS.
//
// Flow: content.js arms interceptor via postMessage -> Fidelity triggers download
// via createObjectURL(blob) -> interceptor reads blob text -> posts CSV back to content.js
//
// Supports two capture types:
//   'positions' — validates Account Name + Symbol + Description headers
//   'activity'  — validates Run Date + Account Number + Action headers
(function () {
    'use strict';

    const originalCreateObjectURL = URL.createObjectURL;
    let armed = false;
    let captureType = 'positions'; // default

    // Listen for arm signal from content.js (ISOLATED world)
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data?.type === 'FIDELITY_EXT_START_CAPTURE') {
            armed = true;
            captureType = event.data.captureType || 'positions';
            console.log(`[Fidelity Ext] Interceptor armed for ${captureType}, waiting for CSV blob...`);
        }
    });

    URL.createObjectURL = function (obj) {
        // Always call original immediately so download proceeds normally
        const url = originalCreateObjectURL.call(URL, obj);

        if (armed && obj instanceof Blob) {
            console.log('[Fidelity Ext] Blob detected, reading content...');

            const reader = new FileReader();
            const currentType = captureType; // capture for closure
            reader.onload = () => {
                if (!armed) return; // Already captured by a concurrent blob
                const text = reader.result;

                if (currentType === 'activity') {
                    // Validate activity CSV headers
                    if (text && text.includes('Run Date') && text.includes('Account Number') && text.includes('Action')) {
                        armed = false; // Disarm only on successful capture
                        console.log('[Fidelity Ext] Activity CSV captured, relaying to content script...');
                        window.postMessage({
                            type: 'FIDELITY_EXT_ACTIVITY_CSV_CAPTURED',
                            csvText: text
                        }, '*');
                    } else {
                        console.log('[Fidelity Ext] Blob is not a Fidelity activity CSV, staying armed...');
                    }
                } else {
                    // Validate positions CSV headers
                    if (text && text.includes('Account Name') && text.includes('Symbol') && text.includes('Description')) {
                        armed = false; // Disarm only on successful capture
                        console.log('[Fidelity Ext] CSV captured, relaying to content script...');
                        window.postMessage({
                            type: 'FIDELITY_EXT_CSV_CAPTURED',
                            csvText: text
                        }, '*');
                    } else {
                        console.log('[Fidelity Ext] Blob is not a Fidelity CSV, staying armed...');
                    }
                }
            };
            reader.onerror = () => {
                console.warn('[Fidelity Ext] Failed to read blob, staying armed...');
            };
            reader.readAsText(obj);
        }

        return url;
    };

    // Preserve toString to avoid detection
    URL.createObjectURL.toString = () => 'function createObjectURL() { [native code] }';
})();
