document.addEventListener('DOMContentLoaded', () => {
    console.log("popup.js: DOM fully loaded and parsed - starting analysis automatically");
    const statusDiv = document.getElementById('status');

    // Helper function to update status with styling
    function updateStatus(message, type = 'default') {
        statusDiv.className = ''; // Clear existing classes
        statusDiv.innerHTML = message;
        
        if (type === 'processing') {
            statusDiv.classList.add('status-processing');
        } else if (type === 'success') {
            statusDiv.classList.add('status-success');
        } else if (type === 'error') {
            statusDiv.classList.add('status-error');
        }
    }

    // Helper function to add loading spinner
    function addLoadingSpinner(message) {
        const spinner = '<span class="loading-spinner"></span>';
        updateStatus(spinner + message, 'processing');
    }

    // Start analysis automatically when popup opens
    addLoadingSpinner('Starting analysis...');

    // Send a message to the background script to start the analysis
    console.log("popup.js: About to send 'start-analysis' command to background script.");
    
    // Add timeout for debugging
    const messageTimeout = setTimeout(() => {
        console.error("popup.js: Message timeout - no response from background script");
        updateStatus('❌ Communication timeout with background script', 'error');
    }, 10000);
    
    chrome.runtime.sendMessage({ command: "start-analysis" }, (response) => {
        clearTimeout(messageTimeout);
        console.log("popup.js: Received response from background script:", response);
        if (chrome.runtime.lastError) {
            console.error("popup.js: Error sending message:", chrome.runtime.lastError);
            updateStatus('❌ Error. Try reloading the page.', 'error');
        } else if (response && response.success) {
            console.log("popup.js: Received success response from background script:", response.message);
            updateStatus('✅ ' + response.message, 'success');
            // Close the popup after analysis starts, as the report will open in a new tab
            setTimeout(() => window.close(), 1000);
        } else {
            console.warn("popup.js: Received failure response from background script:", response.message);
            const errorMessage = response.message || 'An unknown error occurred.';
            // Check if it's a search page error to show as warning instead of error
            if (errorMessage.includes('search page')) {
                updateStatus('⚠️ ' + errorMessage, 'error');
            } else {
                updateStatus('❌ ' + errorMessage, 'error');
            }
        }
    });
});