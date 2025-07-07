// offscreen.js

// Listen for messages from the background script (service worker)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'parse-product-page-html') {
        try {
            // Delegate the actual parsing to the new function in scrapers.js
            const extractedData = parseProductPageFromHTML(request.html, request.url);

            sendResponse({ success: true, data: extractedData });

        } catch (error) {
            console.error(`Offscreen: Error parsing HTML for URL ${request.url}:`, error);
            sendResponse({ success: false, error: error.message });
        }
        // Return true to indicate that the response will be sent asynchronously.
        // While our current function is synchronous, this is good practice.
        return true;
    }
});