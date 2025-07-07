// Tab monitoring for better resource management
let monitoredTabs = new Set();
let analysisInProgress = false;
let shouldStopAnalysis = false;

// Initialize background script
console.log("background.js: Service worker started/restarted");

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
    console.log("background.js: Extension startup detected");
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("background.js: Extension installed/updated");
});

// Resource blocking functionality - simplified approach from testing.md
const RESOURCE_BLOCKING_RULE_ID = 1;
const SCRIPT_BLOCKING_RULE_ID = 2;
const AMAZON_SCRIPT_BLOCKING_RULE_ID = 3;

async function enableResourceBlocking() {
    try {
        if (!chrome.declarativeNetRequest) {
            console.warn("background.js: declarativeNetRequest API not available.");
            return;
        }
        
        const RESOURCE_BLOCKING_RULE = {
            id: RESOURCE_BLOCKING_RULE_ID,
            priority: 1,
            action: { type: "block" },
            condition: {
                "initiatorDomains": [
                    "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr",
                    "amazon.it", "amazon.es", "amazon.nl", "amazon.com.au", 
                    "amazon.co.jp", "amazon.pl", "amazon.se", "amazon.ca"
                ],
                "resourceTypes": ["image", "font", "media", "stylesheet"]
            }
        };

        const SCRIPT_BLOCKING_RULE = {
            id: SCRIPT_BLOCKING_RULE_ID,
            priority: 1,
            action: { type: "block" },
            condition: {
                "requestDomains": [
                    "doubleclick.net", "google-analytics.com", "googletagmanager.com",
                    "scorecardresearch.com", "amazon-adsystem.com", "mads.amazon-adsystem.com",
                    "advertising.amazon.com", "aan.amazon.com"
                ],
                "resourceTypes": ["script", "sub_frame"]
            }
        };

        const AMAZON_SCRIPT_BLOCKING_RULE = {
            id: AMAZON_SCRIPT_BLOCKING_RULE_ID,
            priority: 1,
            action: { type: "block" },
            condition: {
                "urlFilter": "*recommendation*|*customer-reviews-critical*|*social-share*|*advertising*|*analytics*|*tracking*",
                "resourceTypes": ["script"]
            }
        };

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [RESOURCE_BLOCKING_RULE_ID, SCRIPT_BLOCKING_RULE_ID, AMAZON_SCRIPT_BLOCKING_RULE_ID], // Clear old rules first
            addRules: [RESOURCE_BLOCKING_RULE, SCRIPT_BLOCKING_RULE, AMAZON_SCRIPT_BLOCKING_RULE]
        });
        
        console.log("background.js: Resource and script blocking rules enabled successfully.");
    } catch (error) {
        console.error("background.js: Failed to enable resource blocking:", error);
    }
}

async function disableResourceBlocking() {
    try {
        if (!chrome.declarativeNetRequest) {
            console.warn("background.js: declarativeNetRequest API not available.");
            return;
        }
        
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [RESOURCE_BLOCKING_RULE_ID, SCRIPT_BLOCKING_RULE_ID, AMAZON_SCRIPT_BLOCKING_RULE_ID]
        });
        
        console.log("background.js: Resource blocking disabled successfully.");
    } catch (error) {
        console.error("background.js: Failed to disable resource blocking:", error);
    }
}

// Service worker health check function
function checkServiceWorkerHealth() {
    console.log("background.js: Service worker health check - Active and responding");
    return true;
}

// Initialize with health check
console.log("background.js: Performing initial health check");
checkServiceWorkerHealth();

// Handle extension icon clicks directly (no popup)
chrome.action.onClicked.addListener(async (tab) => {
    console.log("background.js: Extension icon clicked, starting analysis automatically");
    
    try {
        if (analysisInProgress) {
            console.warn("background.js: Analysis already in progress.");
            return;
        }
        
        console.log("background.js: Active tab found:", tab?.url);
        
        if (!tab || !tab.url || !tab.url.includes("amazon.")) {
            console.error("background.js: Not an Amazon page.");
            return;
        }
        
        // Check if this is a search page (/s) with a keyword (k=)
        const url = new URL(tab.url);
        console.log("background.js: Checking URL path:", url.pathname, "and search params:", url.searchParams.has('k'));
        
        if (!url.pathname.includes('/s') || !url.searchParams.has('k')) {
            console.error("background.js: Not an Amazon search page.");
            return;
        }
        
        // Extract and decode the keyword
        const keyword = decodeURIComponent(url.searchParams.get('k')).replace(/\+/g, ' ');
        console.log(`background.js: Detected search keyword: "${keyword}"`);
        
        // Store keyword for use in report
        console.log("background.js: Storing keyword in local storage");
        await chrome.storage.local.set({ searchKeyword: keyword });
        
        analysisInProgress = true;
        shouldStopAnalysis = false;
        
        // Enable resource blocking for faster tab loading
        await enableResourceBlocking();
        
        console.log("background.js: Starting analysis on tab", tab.id);
        await startAnalysis(tab);
        
    } catch (error) {
        console.error("background.js: An error occurred during the analysis process:", error);
        analysisInProgress = false;
        // Disable resource blocking on error
        await disableResourceBlocking();
    }
});

// Listens for the "start-analysis" command from the popup (legacy support)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("background.js: Message received:", request.command);
    
    // Health check command for testing service worker responsiveness
    if (request.command === "health-check") {
        console.log("background.js: Health check requested");
        sendResponse({ 
            success: true, 
            message: "Service worker active and responding",
            timestamp: Date.now()
        });
        return true;
    }
    
    if (request.command === "start-analysis") {
        console.log("background.js: Processing start-analysis command");
        
        // Handle async operations properly
        (async () => {
            try {
                if (analysisInProgress) {
                    console.warn("background.js: Analysis already in progress.");
                    sendResponse({ success: false, message: "Analysis already in progress. Please wait for completion." });
                    return;
                }
                
                console.log("background.js: Received 'start-analysis' command.");
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                console.log("background.js: Active tab found:", activeTab?.url);
                
                if (!activeTab || !activeTab.url || !activeTab.url.includes("amazon.")) {
                    console.error("background.js: Not an Amazon page.");
                    sendResponse({ success: false, message: "Error: Not an Amazon page." });
                    return;
                }
                
                // Check if this is a search page (/s) with a keyword (k=)
                const url = new URL(activeTab.url);
                console.log("background.js: Checking URL path:", url.pathname, "and search params:", url.searchParams.has('k'));
                
                if (!url.pathname.includes('/s') || !url.searchParams.has('k')) {
                    console.error("background.js: Not an Amazon search page.");
                    sendResponse({ 
                        success: false, 
                        message: "Please navigate to an Amazon search page first.\n\nSearch for products using Amazon's search box, then run the analysis from the search results page.\n\nExample: Search for 'inspiring stories for kids' and then click the extension." 
                    });
                    return;
                }
                
                // Extract and decode the keyword
                const keyword = decodeURIComponent(url.searchParams.get('k')).replace(/\+/g, ' ');
                console.log(`background.js: Detected search keyword: "${keyword}"`);
                
                // Store keyword for use in report
                console.log("background.js: Storing keyword in local storage");
                await chrome.storage.local.set({ searchKeyword: keyword });
                
                analysisInProgress = true;
                shouldStopAnalysis = false;
                
                // Enable resource blocking for faster tab loading
                await enableResourceBlocking();
                
                console.log("background.js: Starting analysis on tab", activeTab.id);
                await startAnalysis(activeTab); 
                
                sendResponse({ success: true, message: "Analysis started. Report tab opening..." });

            } catch (error) {
                console.error("background.js: An error occurred during the analysis process:", error);
                analysisInProgress = false;
                // Disable resource blocking on error
                await disableResourceBlocking();
                sendResponse({ success: false, message: error.message || "Unknown error occurred" });
            }
        })();
        return true; // Necessary for async sendResponse
    } else if (request.command === "stop-analysis") {
        console.log("background.js: Received 'stop-analysis' command.");
        shouldStopAnalysis = true;
        analysisInProgress = false;
        
        // Clean up resource blocking on stop
        (async () => {
            await disableResourceBlocking();
            
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
        })();
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
        console.log("background.js: About to inject scrapers.js into tab", activeTab.id);
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['scrapers.js']
        });
        console.log("background.js: Scrapers.js injected successfully");

        console.log("background.js: About to execute runFullAmazonAnalysis in tab", activeTab.id);
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => runFullAmazonAnalysis(), // Correctly call the function in the tab's context
        });
        console.log("background.js: runFullAmazonAnalysis executed, processing results");
        
        const serpData = injectionResults[0].result;
        console.log("background.js: SERP data extracted:", serpData ? "Success" : "Failed", "- Product count:", serpData?.productInfo ? Object.keys(serpData.productInfo).length : 0);
        
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

        // Sort ASINs by their earliest position on the page
        const sortedAsins = allAsins.sort((a, b) => {
            const posA = serpData.positions[a] ? Math.min(...serpData.positions[a].map(p => p.position)) : 999;
            const posB = serpData.positions[b] ? Math.min(...serpData.positions[b].map(p => p.position)) : 999;
            return posA - posB;
        });

        // Process all available ASINs
        const asinsToProcess = sortedAsins;
        console.log(`background.js: Total ASINs found: ${allAsins.length}. Processing all ${asinsToProcess.length} concurrently in batches of 5.`);

        // 4. Store initial data and create the report tab
        console.log("background.js: About to store SERP data and ASIN queue in local storage.");
        const { searchKeyword } = await chrome.storage.local.get(['searchKeyword']);
        console.log("background.js: Retrieved search keyword from storage:", searchKeyword);
        
        await chrome.storage.local.set({ 
            serpData: serpData,
            asinsToProcess: asinsToProcess,
            currentDomain: domain,
            searchKeyword: searchKeyword
        });
        console.log("background.js: Data stored in local storage successfully");
        
        console.log("background.js: About to create report tab.");
        // Check if we're in an incognito window and handle accordingly
        const currentWindow = await chrome.windows.get(activeTab.windowId);
        console.log("background.js: Current window info:", currentWindow.incognito ? "incognito" : "normal");
        
        const reportTab = await chrome.tabs.create({ 
            url: chrome.runtime.getURL('report.html'), 
            active: true,
            windowId: currentWindow.incognito ? activeTab.windowId : activeTab.windowId
        });
        console.log("background.js: Report tab created successfully with ID:", reportTab.id);
        
        // 5. Start processing the ASIN queue in the background
        console.log("background.js: About to start ASIN queue processing.");
        await processAsinQueue(asinsToProcess, reportTab.id, domain);

    } catch (e) {
        console.error("background.js: An error occurred during script injection or execution:", e);
        // Clean up any monitored tabs if analysis fails
        monitoredTabs.clear();
        analysisInProgress = false;
        
        // Resource blocking cleanup disabled (since blocking was disabled)
        console.log("background.js: Resource blocking cleanup skipped on error (blocking was disabled)");
        
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

// ========================================================================
// START: New Offscreen-based Scraping Architecture
// ========================================================================

let offscreenDocumentPath = 'offscreen.html';

// Offscreen Document Management
async function hasOffscreenDocument() {
    if ('getContexts' in chrome.runtime) {
        const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
        return contexts.length > 0;
    }
    return false;
}

async function createOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        console.log("background.js: Offscreen document already exists.");
        return;
    }
    console.log("background.js: Creating offscreen document.");
    await chrome.offscreen.createDocument({
        url: offscreenDocumentPath,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'To parse HTML from fetched Amazon product pages.',
    });
}

async function closeOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        console.log("background.js: Closing offscreen document.");
        await chrome.offscreen.closeDocument();
    }
}

// Fetches HTML and sends it to the offscreen document for parsing
async function fetchAndParse(url, asin) {
    console.log(`background.js: Fetching ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error for ${asin}: ${response.status}`);
    }
    const html = await response.text();

    console.log(`background.js: Sending HTML for ${asin} to be parsed.`);
    // Send HTML string to offscreen document for parsing
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            command: 'parse-product-page-html',
            html: html,
            url: url
        }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            if (response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.error || `Unknown error parsing ${asin}`));
            }
        });
    });
}

// Finalization logic, called when the queue is empty
async function finalizeAnalysis(reportTabId) {
    console.log("background.js: All ASINs processed. Finalizing...");
    
    analysisInProgress = false;
    await disableResourceBlocking();
    await closeOffscreenDocument();

    if (reportTabId) {
        chrome.tabs.sendMessage(reportTabId, {
            command: "analysis-complete",
            stopped: shouldStopAnalysis
        }).catch(err => console.warn(`Could not send completion message: ${err.message}`));
    }
    
    console.log("background.js: Cleaning up local storage.");
    chrome.storage.local.remove(['serpData', 'asinsToProcess', 'currentDomain', 'searchKeyword']);
}

// Main Queue Processing Logic
async function processAsinQueue(asins, reportTabId, domain) {
    console.log("background.js: Starting to process ASIN queue with Offscreen Document:", asins);
    
    await createOffscreenDocument();

    const BATCH_SIZE = 5; // How many fetch requests to have in-flight at once
    let activeRequests = 0;
    let asinsToProcess = [...asins];

    const processNext = async () => {
        if (shouldStopAnalysis) {
            console.log("background.js: Analysis stopped by user.");
            return;
        }

        if (asinsToProcess.length === 0 && activeRequests === 0) {
            // All done, finalize the analysis
            await finalizeAnalysis(reportTabId);
            return;
        }
        
        while (asinsToProcess.length > 0 && activeRequests < BATCH_SIZE) {
            activeRequests++;
            const asin = asinsToProcess.shift();
            const productUrl = `https://${domain}/dp/${asin}`;

            fetchAndParse(productUrl, asin)
                .then(data => {
                    // Send data to the report tab
                    if (reportTabId) {
                        chrome.tabs.sendMessage(reportTabId, {
                            command: "update-row",
                            asin: asin,
                            data: data
                        }).catch(err => console.error(`Failed to send update for ${asin}:`, err));
                    }
                })
                .catch(error => {
                     // Send error to the report tab
                    if (reportTabId) {
                        chrome.tabs.sendMessage(reportTabId, {
                            command: "update-row",
                            asin: asin,
                            data: { error: error.message }
                        }).catch(err => console.error(`Failed to send error for ${asin}:`, err));
                    }
                })
                .finally(() => {
                    activeRequests--;
                    processNext(); // Kick off the next item in the queue
                });
        }
    };
    
    await processNext(); // Start the first batch
}

// ========================================================================
// END: New Offscreen-based Scraping Architecture
// ========================================================================

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