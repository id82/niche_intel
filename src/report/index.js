/**
 * Report Module - Main Entry Point
 * Initializes the report page and coordinates all modules
 */

// State management
import {
    setAllData, getAllData, addToAllData, updateDataItem,
    hasAsin, addAsin,
    getProcessedCount, incrementProcessedCount, setProcessedCount,
    getTotalToProcess, setTotalToProcess,
    getSearchKeyword, setSearchKeyword,
    getCurrentDomain, setCurrentDomain,
    isScrollSyncInitialized
} from './state.js';

// Utilities
import { getCurrencySymbol } from './utils.js';

// Table rendering
import { renderInitialTable, setupResizeHandler } from './table-render.js';

// Row updates
import { updateTableRow } from './row-update.js';

// Calculations
import { calculateAndDisplayTotals, calculateAndDisplayHighRoyaltyTotals } from './calculations.js';

// Selection
import { updateSelectAllState, updateTotalsCalculations } from './selection.js';

// Image hover
import { createImageHoverModal } from './image-hover.js';

// Export functionality
import { setupExportHandlers } from './export.js';

// ASIN focus
import { setupAsinFocus } from './asin-focus.js';

// Filters
import { setupFilterFunctionality } from './filters.js';

// Scroll sync
import { setupScrollSynchronization } from './scroll-sync.js';

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log("report.js: DOM fully loaded and parsed.");
    const tableContainer = document.getElementById('table-container');
    const progressText = document.getElementById('progress-text');

    // Create positioned hover modal for images
    createImageHoverModal();

    console.log("report.js: Loading initial data from local storage.");
    const { serpData, asinsToProcess, currentDomain: loadedDomain, searchKeyword: loadedKeyword } =
        await chrome.storage.local.get(['serpData', 'asinsToProcess', 'currentDomain', 'searchKeyword']);

    if (!serpData || !asinsToProcess) {
        console.error("report.js: Could not load initial data from storage.");
        tableContainer.innerHTML = '<p>Error: Could not load initial data from storage. Please try again.</p>';
        progressText.textContent = 'Error: Could not load data. Please restart the analysis.';
        return;
    }

    console.log("report.js: Initial data loaded successfully.", { serpData, asinsToProcess });

    // Store domain and search keyword globally
    setCurrentDomain(loadedDomain || '');
    setSearchKeyword(loadedKeyword || '');

    if (getSearchKeyword()) {
        const headerTitle = document.querySelector('.header h1');
        if (headerTitle) {
            headerTitle.innerHTML = `NicheIntel Pro by <a href="https://adigy.ai" target="_blank" class="adigy-link">Adigy.AI</a> - Ads Automation for Publishers - "${getSearchKeyword()}"`;
        }
        document.title = `NicheIntel Pro - ${getSearchKeyword()}`;
    }

    // Initialize global variables
    setProcessedCount(0);
    setTotalToProcess(asinsToProcess.length);
    setAllData([]);

    progressText.textContent = `Progress: ${getProcessedCount()} / ${getTotalToProcess()} products analyzed.`;

    renderInitialTable(serpData, asinsToProcess, tableContainer, getCurrentDomain());

    // Listen for messages from the background script
    console.log("report.js: Adding message listener for updates from background script.");
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("report.js: Received message from background script:", request);

        if (request.command === "update-row") {
            console.log(`report.js: Updating row for ASIN ${request.asin}. Raw data:`, request.data);

            const rowData = { ...request.data, asin: request.asin };
            const initialProductInfo = serpData.productInfo[request.asin] || {};
            const combinedData = { ...initialProductInfo, ...rowData };

            // Update author info if the individual page has better data
            if (rowData.author_info && rowData.author_info.name) {
                combinedData.authors = [rowData.author_info.name];
            }

            updateTableRow(request.asin, combinedData);

            // Only add to allData if this ASIN hasn't been processed yet
            if (!hasAsin(request.asin)) {
                addToAllData(combinedData);
                addAsin(request.asin);
            } else {
                updateDataItem(request.asin, combinedData);
            }

            // Update the author display in the table if we have better data
            if (combinedData.authors && combinedData.authors.length > 0) {
                const authorDiv = document.querySelector(`tr[data-asin="${request.asin}"] .author`);
                if (authorDiv) {
                    authorDiv.textContent = combinedData.authors.join(', ');
                }
            }

            // Update checkbox functionality for new rows
            const checkbox = document.querySelector(`input[data-asin="${request.asin}"]`);
            if (checkbox && !checkbox.hasAttribute('data-listener-added')) {
                checkbox.addEventListener('change', function () {
                    updateSelectAllState();
                    updateTotalsCalculations();
                });
                checkbox.setAttribute('data-listener-added', 'true');
            }

            incrementProcessedCount();
            progressText.textContent = `Progress: ${getProcessedCount()} / ${getTotalToProcess()} products analyzed.`;

            // Update progress bar
            const progressBar = document.getElementById('progress-bar');
            if (progressBar) {
                const percentage = Math.round((getProcessedCount() / getTotalToProcess()) * 100);
                progressBar.style.width = percentage + '%';
                progressBar.textContent = percentage + '%';
            }

            // Reinitialize scroll sync if active
            const filterToggle = document.getElementById('filterToggle');
            if (filterToggle && filterToggle.checked && isScrollSyncInitialized()) {
                setTimeout(() => {
                    setupScrollSynchronization();
                }, 50);
            }
        } else if (request.command === "analysis-complete") {
            console.log("report.js: Received analysis complete message.");
            const message = request.stopped ?
                `Analysis Stopped! ${getProcessedCount()} of ${getTotalToProcess()} products were processed.` :
                `Analysis Complete! All ${getTotalToProcess()} products have been processed.`;
            progressText.textContent = message;

            // Collapse progress container after 3 seconds
            setTimeout(() => {
                const progressContainer = document.getElementById('progress-container');
                progressContainer.style.transition = 'all 0.5s ease-out';
                progressContainer.style.maxHeight = '0px';
                progressContainer.style.padding = '0';
                progressContainer.style.margin = '0';
                progressContainer.style.overflow = 'hidden';
            }, 3000);

            console.log("report.js: Analysis complete, calculating totals for", getAllData().length, "products");
            calculateAndDisplayTotals(getAllData());
            console.log("report.js: Regular totals calculated, now calculating high royalty totals");
            calculateAndDisplayHighRoyaltyTotals(getAllData());
            console.log("report.js: All totals calculation complete");

            // Show export button
            document.getElementById('exportData').style.display = 'inline-block';

            // Clean up storage
            chrome.storage.local.remove(['serpData', 'asinsToProcess', 'currentDomain', 'searchKeyword'])
                .then(() => console.log("report.js: Cleaned up storage after analysis completion"))
                .catch(err => console.warn("report.js: Failed to clean up storage:", err));
        }
    });
});

// Second DOMContentLoaded for UI setup
document.addEventListener('DOMContentLoaded', () => {
    setupExportHandlers();
    setupAsinFocus();
    setupFilterFunctionality();
    setupResizeHandler();
});
