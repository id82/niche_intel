// Tab monitoring for better resource management
let monitoredTabs = new Set();
let analysisInProgress = false;
let shouldStopAnalysis = false;

// Listens for the "start-analysis" command from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "start-analysis") {
        (async () => {
            try {
                if (analysisInProgress) {
                    console.warn("background.js: Analysis already in progress.");
                    sendResponse({ success: false, message: "Analysis already in progress. Please wait for completion." });
                    return;
                }
                
                console.log("background.js: Received 'start-analysis' command.");
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!activeTab || !activeTab.url || !activeTab.url.includes("amazon.")) {
                    console.error("background.js: Not an Amazon page.");
                    sendResponse({ success: false, message: "Error: Not an Amazon page." });
                    return;
                }
                
                analysisInProgress = true;
                shouldStopAnalysis = false;
                console.log("background.js: Starting analysis on tab", activeTab.id);
                await startAnalysis(activeTab); 
                
                sendResponse({ success: true, message: "Analysis started. Report tab opening..." });

            } catch (error) {
                console.error("background.js: An error occurred during the analysis process:", error);
                analysisInProgress = false;
                sendResponse({ success: false, message: error.message });
            }
        })();
        return true; // Necessary for async sendResponse
    } else if (request.command === "stop-analysis") {
        console.log("background.js: Received 'stop-analysis' command.");
        shouldStopAnalysis = true;
        analysisInProgress = false;
        
        // Close all monitored tabs
        const tabsToClose = Array.from(monitoredTabs);
        tabsToClose.forEach(async (tabId) => {
            try {
                await chrome.tabs.remove(tabId);
                monitoredTabs.delete(tabId);
            } catch (error) {
                console.warn(`background.js: Failed to close tab ${tabId}:`, error);
            }
        });
        
        sendResponse({ success: true, message: "Analysis stopped. Background tabs closed." });
        return true;
    }
    return true; // Also good to have for other potential messages
});

// The activeTab is now passed as an argument to avoid querying it again.
async function startAnalysis(activeTab) {
    const domain = new URL(activeTab.url).hostname;
    console.log(`background.js: Operating on domain: ${domain}`);

    // 2. Inject the scrapers and run the SERP analysis function
    try {
        console.log("background.js: Injecting scrapers.js into tab", activeTab.id);
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['scrapers.js']
        });

        console.log("background.js: Executing runFullAmazonAnalysis in tab", activeTab.id);
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => runFullAmazonAnalysis(), // Correctly call the function in the tab's context
        });
        
        const serpData = injectionResults[0].result;
        if (!serpData || !serpData.productInfo) {
            throw new Error("Failed to extract SERP data.");
        }
        console.log("background.js: Successfully extracted SERP data.");

        // 3. Prepare data for processing
        const allAsins = Object.keys(serpData.productInfo);
        if (allAsins.length === 0) {
            console.warn("background.js: No ASINs found on the page.");
            return; // Exit gracefully if no products are found.
        }

        // --- TESTING CONSTRAINT: Only process the first 10 ASINs ---
        const asinsToProcess = allAsins.slice(0, 10);
        console.log(`background.js: Total ASINs found: ${allAsins.length}. Processing first ${asinsToProcess.length} concurrently in batches of 5.`);

        // 4. Store initial data and create the report tab
        console.log("background.js: Storing SERP data and ASIN queue in local storage.");
        await chrome.storage.local.set({ 
            serpData: serpData,
            asinsToProcess: asinsToProcess,
            currentDomain: domain
        });
        
        console.log("background.js: Creating report tab.");
        // Check if we're in an incognito window and handle accordingly
        const currentWindow = await chrome.windows.get(activeTab.windowId);
        const reportTab = await chrome.tabs.create({ 
            url: chrome.runtime.getURL('report.html'), 
            active: true,
            windowId: currentWindow.incognito ? activeTab.windowId : activeTab.windowId
        });
        
        // 5. Start processing the ASIN queue in the background
        console.log("background.js: Starting ASIN queue processing.");
        await processAsinQueue(asinsToProcess, reportTab.id, domain);

    } catch (e) {
        console.error("background.js: An error occurred during script injection or execution:", e);
        // Clean up any monitored tabs if analysis fails
        monitoredTabs.clear();
        analysisInProgress = false;
        throw e;
    }
}

// Helper function to check if extraction data appears to be failed/incomplete
function isExtractionFailed(data) {
    if (!data || data.error) return true;
    
    // Check if most key fields are null/undefined (indicating extraction failure)
    const keyFields = [
        data.title,
        data.product_details?.bsr,
        data.customer_reviews?.average_rating,
        data.formats?.length
    ];
    
    const nullFields = keyFields.filter(field => field === null || field === undefined).length;
    const failureThreshold = keyFields.length * 0.75; // 75% of fields are null
    
    return nullFields >= failureThreshold;
}

// Process a single ASIN with retry logic
async function processSingleAsin(asin, domain, maxRetries = 2) {
    let attempt = 0;
    let deepDiveData = null;
    
    while (attempt <= maxRetries) {
        let backgroundTabId = null;
        attempt++;
        
        try {
            console.log(`background.js: Processing ASIN: ${asin} (attempt ${attempt}/${maxRetries + 1})`);
            
            // Add delay for retries (exponential backoff)
            if (attempt > 1) {
                const delay = Math.pow(2, attempt - 2) * 1000; // 1s, 2s, 4s...
                console.log(`background.js: Waiting ${delay}ms before retry for ASIN: ${asin}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Create a new, inactive tab for the product page in the same window
            const productUrl = `https://${domain}/dp/${asin}`;
            console.log(`background.js: Creating background tab for ${productUrl}`);
            
            // Find the correct window - prioritize incognito if we're in incognito context
            const windows = await chrome.windows.getAll({ populate: false, windowTypes: ['normal'] });
            const reportWindow = await chrome.windows.get(
                (await chrome.tabs.query({ active: true, currentWindow: true }))[0].windowId
            );
            
            const backgroundTab = await chrome.tabs.create({ 
                url: productUrl, 
                active: false,
                windowId: reportWindow.id
            });
            backgroundTabId = backgroundTab.id;
            monitoredTabs.add(backgroundTabId);

            // Wait for the tab to be fully loaded before injecting script, with a timeout
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    reject(new Error(`Tab ${backgroundTabId} timed out while loading.`));
                }, 15000); // 15 seconds timeout

                const listener = (tabId, changeInfo, tab) => {
                    if (tabId === backgroundTabId && changeInfo.status === 'complete' && tab.url.startsWith('http')) {
                        console.log(`background.js: Tab ${backgroundTabId} loaded successfully.`);
                        clearTimeout(timeout);
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
            
            // Inject scrapers and run the deep-dive extraction
            console.log(`background.js: Injecting scrapers.js into background tab ${backgroundTabId}`);
            await chrome.scripting.executeScript({
                target: { tabId: backgroundTabId },
                files: ['scrapers.js']
            });
            console.log(`background.js: Executing runFullProductPageExtraction in background tab ${backgroundTabId}`);
            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: backgroundTabId },
                func: () => runFullProductPageExtraction(),
            });
            
            deepDiveData = injectionResults[0].result;
            console.log(`background.js: Successfully extracted deep-dive data for ASIN ${asin}.`);
            
            // Check if extraction appears to have failed
            if (isExtractionFailed(deepDiveData)) {
                console.warn(`background.js: Extraction appears incomplete for ASIN ${asin} (attempt ${attempt})`);
                if (attempt <= maxRetries) {
                    // Clean up current tab and continue retry loop
                    if (backgroundTabId) {
                        monitoredTabs.delete(backgroundTabId);
                        await chrome.tabs.remove(backgroundTabId);
                        backgroundTabId = null;
                    }
                    continue; // Try again
                } else {
                    console.error(`background.js: Max retries reached for ASIN ${asin}, using incomplete data`);
                }
            }
            
            // Success - exit retry loop
            break;

        } catch (e) {
            console.error(`background.js: Failed to process ASIN ${asin} (attempt ${attempt}):`, e);
            deepDiveData = { error: `Failed to scrape page for ASIN ${asin}: ${e.message}` };
            
            if (attempt > maxRetries) {
                console.error(`background.js: Max retries reached for ASIN ${asin}`);
                break; // Exit retry loop
            }
        
        } finally {
            // Clean up by closing the background tab
            if (backgroundTabId) {
                console.log(`background.js: Closing background tab ${backgroundTabId} after scraping (attempt ${attempt}).`);
                monitoredTabs.delete(backgroundTabId);
                try {
                    await chrome.tabs.remove(backgroundTabId);
                } catch (tabError) {
                    console.warn(`background.js: Failed to close tab ${backgroundTabId}: ${tabError.message}`);
                }
                backgroundTabId = null;
            }
        }
    }
    
    return deepDiveData;
}

async function processAsinQueue(asins, reportTabId, domain) {
    console.log("background.js: Starting to process ASIN queue:", asins);

    const BATCH_SIZE = 5; // Process 5 ASINs concurrently
    const batches = [];
    
    // Split ASINs into batches
    for (let i = 0; i < asins.length; i += BATCH_SIZE) {
        batches.push(asins.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`background.js: Processing ${asins.length} ASINs in ${batches.length} batches of up to ${BATCH_SIZE}`);

    // Process each batch concurrently
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Check if analysis should be stopped
        if (shouldStopAnalysis) {
            console.log("background.js: Analysis stopped by user. Terminating batch processing.");
            break;
        }
        
        const batch = batches[batchIndex];
        console.log(`background.js: Processing batch ${batchIndex + 1}/${batches.length} with ASINs:`, batch);
        
        // Process all ASINs in this batch concurrently with staggered delays
        const batchPromises = batch.map(async (asin, index) => {
            try {
                // Add staggered delay to avoid overwhelming servers (0ms, 200ms, 400ms, 600ms, 800ms)
                if (index > 0) {
                    const delay = index * 200; // 200ms between each tab in batch
                    console.log(`background.js: Staggered delay of ${delay}ms for ASIN ${asin}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                const deepDiveData = await processSingleAsin(asin, domain);
                
                // Send update to report tab immediately when ready
                if (reportTabId) {
                    console.log(`background.js: Sending 'update-row' message for ASIN ${asin} to report tab ${reportTabId}.`);
                    chrome.tabs.sendMessage(reportTabId, {
                        command: "update-row",
                        asin: asin,
                        data: deepDiveData
                    }).catch(err => console.warn(`background.js: Could not send message to report tab: ${err.message}`));
                }
                
                return { asin, success: true, data: deepDiveData };
            } catch (error) {
                console.error(`background.js: Batch processing failed for ASIN ${asin}:`, error);
                
                // Send error data to report tab
                if (reportTabId) {
                    chrome.tabs.sendMessage(reportTabId, {
                        command: "update-row",
                        asin: asin,
                        data: { error: `Batch processing failed: ${error.message}` }
                    }).catch(err => console.warn(`background.js: Could not send error message to report tab: ${err.message}`));
                }
                
                return { asin, success: false, error: error.message };
            }
        });
        
        // Wait for all ASINs in this batch to complete
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Log batch completion
        const successful = batchResults.filter(result => result.status === 'fulfilled' && result.value.success).length;
        const failed = batch.length - successful;
        console.log(`background.js: Batch ${batchIndex + 1} completed. Success: ${successful}, Failed: ${failed}`);
        
        // Small delay between batches to be respectful to servers
        if (batchIndex < batches.length - 1) {
            console.log("background.js: Waiting 1 second before next batch...");
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // 6. Send completion message after the loop finishes
    analysisInProgress = false;
    const completionMessage = shouldStopAnalysis ? "Analysis stopped by user." : "All ASINs processed.";
    console.log(`background.js: ${completionMessage}`);
    
    if (reportTabId) {
        console.log(`background.js: Sending 'analysis-complete' message to report tab ${reportTabId}.`);
        chrome.tabs.sendMessage(reportTabId, { 
            command: "analysis-complete",
            stopped: shouldStopAnalysis 
        }).catch(err => console.warn(`background.js: Could not send completion message to report tab: ${err.message}`));
    }
    console.log("background.js: Cleaning up local storage.");
    chrome.storage.local.remove(['serpData', 'asinsToProcess', 'currentDomain']); // Clean up storage
}

// Handle manual tab closures by users
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (monitoredTabs.has(tabId)) {
        console.log(`background.js: Monitored tab ${tabId} was manually closed by user.`);
        monitoredTabs.delete(tabId);
        
        // If all monitored tabs are closed, ensure cleanup
        if (monitoredTabs.size === 0) {
            console.log("background.js: All monitored tabs are now closed.");
            // Note: We don't auto-complete the analysis here as some tabs may still be processing
        }
    }
});