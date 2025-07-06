document.addEventListener('DOMContentLoaded', () => {
    console.log("popup.js: DOM fully loaded and parsed");
    const startButton = document.getElementById('startAnalysis');
    const stopButton = document.getElementById('stopAnalysis');
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

    startButton.addEventListener('click', () => {
        console.log("popup.js: 'Start Analysis' button clicked.");
        // Disable the start button and enable stop button
        startButton.disabled = true;
        stopButton.disabled = false;
        addLoadingSpinner('Starting analysis...');

        // Send a message to the background script to start the analysis
        console.log("popup.js: About to send 'start-analysis' command to background script.");
        
        // Add timeout for debugging
        const messageTimeout = setTimeout(() => {
            console.error("popup.js: Message timeout - no response from background script");
            updateStatus('❌ Communication timeout with background script', 'error');
            startButton.disabled = false;
            stopButton.disabled = true;
        }, 10000);
        
        chrome.runtime.sendMessage({ command: "start-analysis" }, (response) => {
            clearTimeout(messageTimeout);
            console.log("popup.js: Received response from background script:", response);
            if (chrome.runtime.lastError) {
                console.error("popup.js: Error sending message:", chrome.runtime.lastError);
                updateStatus('❌ Error. Try reloading the page.', 'error');
                startButton.disabled = false; // Re-enable on error
                stopButton.disabled = true;
            } else if (response && response.success) {
                console.log("popup.js: Received success response from background script:", response.message);
                updateStatus('✅ ' + response.message, 'success');
                 // We can close the popup, as the report will open in a new tab
                setTimeout(() => window.close(), 1500); // Give user time to read message
            } else {
                console.warn("popup.js: Received failure response from background script:", response.message);
                const errorMessage = response.message || 'An unknown error occurred.';
                // Check if it's a search page error to show as warning instead of error
                if (errorMessage.includes('search page')) {
                    updateStatus('⚠️ ' + errorMessage, 'error');
                } else {
                    updateStatus('❌ ' + errorMessage, 'error');
                }
                startButton.disabled = false; // Re-enable on failure
                stopButton.disabled = true;
            }
        });
    });

    stopButton.addEventListener('click', () => {
        console.log("popup.js: 'Stop Analysis' button clicked.");
        addLoadingSpinner('Stopping analysis...');
        
        chrome.runtime.sendMessage({ command: "stop-analysis" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("popup.js: Error sending stop message:", chrome.runtime.lastError);
                updateStatus('❌ Error stopping analysis.', 'error');
            } else if (response && response.success) {
                console.log("popup.js: Analysis stopped successfully:", response.message);
                updateStatus('⏹️ ' + response.message, 'success');
                startButton.disabled = false;
                stopButton.disabled = true;
            }
        });
    });
});