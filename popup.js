document.addEventListener('DOMContentLoaded', () => {
    console.log("popup.js: DOM fully loaded and parsed");
    const startButton = document.getElementById('startAnalysis');
    const stopButton = document.getElementById('stopAnalysis');
    const statusDiv = document.getElementById('status');

    startButton.addEventListener('click', () => {
        console.log("popup.js: 'Start Analysis' button clicked.");
        // Disable the start button and enable stop button
        startButton.disabled = true;
        stopButton.disabled = false;
        statusDiv.textContent = 'Processing...';

        // Send a message to the background script to start the analysis
        console.log("popup.js: Sending 'start-analysis' command to background script.");
        chrome.runtime.sendMessage({ command: "start-analysis" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("popup.js: Error sending message:", chrome.runtime.lastError);
                statusDiv.textContent = 'Error. Try reloading the page.';
                startButton.disabled = false; // Re-enable on error
                stopButton.disabled = true;
            } else if (response && response.success) {
                console.log("popup.js: Received success response from background script:", response.message);
                statusDiv.textContent = response.message;
                 // We can close the popup, as the report will open in a new tab
                setTimeout(() => window.close(), 1500); // Give user time to read message
            } else {
                console.warn("popup.js: Received failure response from background script:", response.message);
                statusDiv.textContent = response.message || 'An unknown error occurred.';
                startButton.disabled = false; // Re-enable on failure
                stopButton.disabled = true;
            }
        });
    });

    stopButton.addEventListener('click', () => {
        console.log("popup.js: 'Stop Analysis' button clicked.");
        statusDiv.textContent = 'Stopping analysis...';
        
        chrome.runtime.sendMessage({ command: "stop-analysis" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("popup.js: Error sending stop message:", chrome.runtime.lastError);
                statusDiv.textContent = 'Error stopping analysis.';
            } else if (response && response.success) {
                console.log("popup.js: Analysis stopped successfully:", response.message);
                statusDiv.textContent = response.message;
                startButton.disabled = false;
                stopButton.disabled = true;
            }
        });
    });
});