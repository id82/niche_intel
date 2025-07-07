// NicheIntel Pro - Book Page Info Extension
// Displays royalty and sales information on individual Amazon book pages

console.log("NicheIntel Pro: Book page info script loaded");

// Check if this is a valid Amazon book page
function isValidBookPage() {
    try {
        const requestContextElement = document.querySelector('div[data-request-context]');
        if (!requestContextElement) {
            console.log("NicheIntel Pro: No data-request-context element found");
            return false;
        }
        
        const requestContext = JSON.parse(requestContextElement.dataset.requestContext);
        const storeName = requestContext.storeName;
        
        console.log("NicheIntel Pro: Store name detected:", storeName);
        
        // Check if it's a book or kindle page
        return storeName === 'books' || storeName === 'digital-text';
    } catch (error) {
        console.log("NicheIntel Pro: Error checking page type:", error);
        return false;
    }
}

// Extract ASIN from URL
function extractASIN() {
    const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
    return asinMatch ? asinMatch[1] : null;
}

// Extract book data from the current page
function extractBookData() {
    const data = {
        asin: extractASIN(),
        title: null,
        listPrice: null,
        price: null,
        bsr: null,
        pageCount: null,
        largeTrim: false,
        marketplace: window.location.hostname,
        reviewImages: 0,
        aplusModules: 0,
        ugcVideos: 0,
        editorialReviews: false
    };
    
    // Extract title
    const titleElement = document.querySelector('#productTitle');
    if (titleElement) {
        data.title = titleElement.textContent.trim();
    }
    
    // Extract prices using the same logic as scrapers.js extractAmazonBookFormats()
    const cleanPrice = (text) => {
        if (!text) return null;
        const match = text.match(/(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2}|\d+)/);
        if (!match) return null;

        let priceStr = match[0].replace(/[$,€£¥]/g, ''); // Remove currency symbols
        if (priceStr.includes(',') && priceStr.includes('.')) {
            if (priceStr.lastIndexOf(',') > priceStr.lastIndexOf('.')) {
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            } else {
                priceStr = priceStr.replace(/,/g, '');
            }
        } else {
            priceStr = priceStr.replace(',', '.');
        }
        
        const price = parseFloat(priceStr);
        return isNaN(price) ? null : price;
    };
    
    const prices = [];
    
    // Extract prices from tmm-grid-swatch elements (format selection area)
    document.querySelectorAll('[id^="tmm-grid-swatch-"]').forEach(swatch => {
        const isSelected = swatch.classList.contains('selected');
        if (isSelected) {
            // Extract price from selected format
            const slotPrice = swatch.querySelector('.slot-price span[aria-label]');
            if (slotPrice) {
                const price = cleanPrice(slotPrice.getAttribute('aria-label'));
                if (price !== null) {
                    prices.push(price);
                }
            }
            
            // Check for Kindle extra message with additional price
            const extraMessage = swatch.querySelector('.kindleExtraMessage');
            if (extraMessage) {
                const priceElement = extraMessage.querySelector('.a-color-price') || extraMessage.querySelector('span.a-color-price');
                let additionalPrice = priceElement ? cleanPrice(priceElement.textContent) : cleanPrice(extraMessage.textContent);
                if (additionalPrice !== null && !prices.includes(additionalPrice)) {
                    prices.push(additionalPrice);
                }
            }
        }
    });
    
    // Extract strikethrough list price from core price display
    const listPriceEl = document.querySelector('div[id*="corePriceDisplay"] span[class="a-price a-text-price"] span');
    if (listPriceEl) {
        const listPrice = cleanPrice(listPriceEl.textContent);
        if (listPrice && !prices.includes(listPrice)) {
            prices.push(listPrice);
        }
    }
    
    // Fallback to legacy price selectors if no prices found
    if (prices.length === 0) {
        const legacySelectors = [
            'span.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
            '.a-price.a-text-price .a-offscreen',
            '#listPrice .a-offscreen',
            '#priceblock_listprice',
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '.a-price .a-offscreen'
        ];
        
        for (const selector of legacySelectors) {
            const priceElement = document.querySelector(selector);
            if (priceElement) {
                const price = cleanPrice(priceElement.textContent);
                if (price !== null && !prices.includes(price)) {
                    prices.push(price);
                }
            }
        }
    }
    
    // Set prices using the same logic as scrapers.js
    if (prices.length > 0) {
        prices.sort((a, b) => a - b); // Sort ascending
        data.price = prices[0]; // Lowest price is the current price
        data.listPrice = prices[prices.length - 1]; // Highest price is the list price
        if (prices.length > 2) {
            console.log(`NicheIntel Pro: Found ${prices.length} prices, using lowest for current and highest for list:`, prices);
        }
    }
    
    // Extract BSR from product details
    const detailsElements = document.querySelectorAll('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr');
    for (const element of detailsElements) {
        const text = element.textContent;
        if (text.includes('Best Sellers Rank') || text.includes('Amazon Bestsellers Rank')) {
            const bsrMatch = text.match(/#([\d,]+)/);
            if (bsrMatch) {
                data.bsr = parseInt(bsrMatch[1].replace(/,/g, ''));
                break;
            }
        }
    }
    
    // Extract page count
    for (const element of detailsElements) {
        const text = element.textContent;
        if (text.includes('pages') || text.includes('Print length')) {
            const pageMatch = text.match(/(\d+)\s*pages?/i);
            if (pageMatch) {
                data.pageCount = parseInt(pageMatch[1]);
                break;
            }
        }
    }
    
    // Extract dimensions and check for large trim using the same logic as reference
    const findDetailValue = (label) => {
        const detailsElements = document.querySelectorAll('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr, #productDetails_feature_div li, #productDetails_detailBullets_sections1 tr');
        for (const element of detailsElements) {
            const text = element.textContent;
            if (text.includes(label)) {
                return text;
            }
        }
        return null;
    };
    
    const dimensionsText = findDetailValue("Dimensions");
    if (dimensionsText) {
        const numbers = dimensionsText.match(/(\d+\.?\d*)/g);
        if (numbers && numbers.length >= 2) {
            const sortedDims = numbers.map(parseFloat).sort((a, b) => b - a);
            const height = sortedDims[0];
            const width = sortedDims[1];
            const unitMatch = dimensionsText.match(/inches|cm/i);
            const unit = unitMatch ? unitMatch[0].toLowerCase() : 'inches';
            
            if (unit === 'inches') {
                if (width > 6.12 || height > 9) {
                    data.largeTrim = true;
                }
            } else if (unit === 'cm') {
                if (width > 15.54 || height > 22.86) {
                    data.largeTrim = true;
                }
            }
        }
    }
    
    // Extract review images count using same logic as scrapers.js getReviewImageCount()
    function getReviewImageCount() {
        const firstCard = document.querySelector('#cm_cr_carousel_images_section .a-carousel-card[aria-setsize]');
        return firstCard ? parseInt(firstCard.getAttribute('aria-setsize')) : document.querySelectorAll('#cm_cr_carousel_images_section .a-carousel-card').length;
    }
    data.reviewImages = getReviewImageCount();
    
    // Extract A+ content modules
    const aplusElements = document.querySelectorAll('[data-aplus-module], .aplus-module, #aplus_feature_div .aplus-module');
    data.aplusModules = aplusElements.length;
    
    // Extract UGC videos (simplified)
    const ugcVideoElements = document.querySelectorAll('[data-video-url], .video-block, [data-hook="vse-video-block"]');
    data.ugcVideos = ugcVideoElements.length;
    
    // Check for editorial reviews
    const editorialElements = document.querySelectorAll('#editorialReviews_feature_div, [data-feature-name="editorialReviews"], .cr-editorial-review');
    data.editorialReviews = editorialElements.length > 0;
    
    console.log("NicheIntel Pro: Extracted book data:", data);
    return data;
}

// Calculate monthly sales and royalty using the EXACT same logic as scrapers.js
function calculateMonthlyMetrics(bookData) {
    if (!bookData.bsr || !bookData.price || !bookData.pageCount) {
        return { monthlyRoyalty: null, royaltyPerUnit: null };
    }
    
    // Use the EXACT same BSR to sales estimation logic from scrapers.js
    const multipliers = {
        ebook: { USD: 1, GBP: 0.31, DE: 0.36, FR: 0.11, ES: 0.093, IT: 0.10, NL: 0.023, YEN: 0.22, IN: 0.021, CAD: 0.17, MEX: 0.044, AUD: 0.022, SE: 1, PL: 1 },
        paperback: { USD: 1, GBP: 0.16, DE: 0.19, FR: 0.055, ES: 0.048, IT: 0.053, NL: 0.012, YEN: 0.12, IN: 0.011, CAD: 0.089, MEX: 0.023, AUD: 0.011, SE: 1, PL: 1 },
        hardcover: {},
    };
    Object.assign(multipliers.hardcover, multipliers.paperback);
    
    const A = 3.35038, B = -0.29193, C = -0.070538;
    
    function coreUnits(bsr) {
        if (bsr <= 100000) {
            const t = Math.log10(bsr);
            return 10 ** (A + B * t + C * t * t);
        }
        return 100000 / (100000 + (bsr - 100000) * 8);
    }
    
    function getMultiplier(type, market) { 
        return multipliers[type]?.[market] ?? 1; 
    }
    
    function estimateSales(bsr, bookType, market) {
        if (!Number.isFinite(bsr) || bsr < 1) return 0;
        return Math.max(0, 1.37 * coreUnits(bsr) * getMultiplier(bookType, market));
    }
    
    // Determine book type and market using same logic as scrapers.js
    const bookType = window.location.href.includes('digital-text') ? 'ebook' : 'paperback';
    const marketplace = window.location.hostname;
    
    // Map marketplace to market code (same as scrapers.js)
    const tldMap = {
        'amazon.com': 'USD', 'amazon.ca': 'CAD', 'amazon.co.uk': 'GBP',
        'amazon.de': 'DE', 'amazon.fr': 'FR', 'amazon.it': 'IT',
        'amazon.es': 'ES', 'amazon.nl': 'NL', 'amazon.com.au': 'AUD',
        'amazon.co.jp': 'YEN', 'amazon.pl': 'PL', 'amazon.se': 'SE'
    };
    
    let marketCode = 'USD'; // Default
    for (const key in tldMap) {
        if (marketplace.includes(key)) {
            marketCode = tldMap[key];
            break;
        }
    }
    
    // Calculate daily sales
    const dailySales = estimateSales(bookData.bsr, bookType, marketCode);
    const monthlySales = Math.round(dailySales * 30);
    
    // Calculate royalty per unit using the EXACT same logic as book_calc.html
    let royaltyPerUnit = 0;
    if (bookType === 'ebook') {
        // Kindle royalty calculation
        if (bookData.price >= 2.99 && bookData.price <= 9.99) {
            royaltyPerUnit = bookData.price * 0.7; // 70% royalty
        } else {
            royaltyPerUnit = bookData.price * 0.35; // 35% royalty
        }
    } else {
        // Use the exact marketplace naming from book_calc.html
        const marketplace = `Amazon.${marketCode === 'USD' ? 'com' : 
                              marketCode === 'CAD' ? 'ca' : 
                              marketCode === 'GBP' ? 'co.uk' : 
                              marketCode === 'DE' ? 'de' : 
                              marketCode === 'FR' ? 'fr' : 
                              marketCode === 'IT' ? 'it' : 
                              marketCode === 'ES' ? 'es' : 
                              marketCode === 'NL' ? 'nl' : 
                              marketCode === 'AUD' ? 'com.au' : 
                              marketCode === 'YEN' ? 'co.jp' : 
                              marketCode === 'PL' ? 'pl' : 
                              marketCode === 'SE' ? 'se' : 'com'}`;
        
        const price = bookData.listPrice || bookData.price;
        const pageCount = bookData.pageCount;
        const trimSize = bookData.largeTrim ? 'large' : 'regular';
        const interiorType = 'Black Ink'; // Assumption for mini table
        const euStores = ["Amazon.de", "Amazon.fr", "Amazon.it", "Amazon.es", "Amazon.nl"];
        
        // Royalty thresholds using exact book_calc.html format
        const royaltyThresholds = { 
            "Amazon.com": 9.99, "Amazon.de": 9.99, "Amazon.fr": 9.99, "Amazon.it": 9.99, "Amazon.es": 9.99, "Amazon.nl": 9.99, 
            "Amazon.co.uk": 7.99, "Amazon.ca": 13.99, "Amazon.com.au": 13.99, "Amazon.co.jp": 1000, "Amazon.pl": 40, "Amazon.se": 99 
        };
        
        // Calculate printing cost using EXACT book_calc.html logic
        let printingCost = 0;
        let isSupported = true;
        
        if (bookType === 'paperback') {
            if (interiorType === 'Black Ink') {
                if (pageCount >= 24 && pageCount <= 108) {
                    const costs = { 'Amazon.com': 2.30, 'Amazon.ca': 2.99, 'Amazon.co.jp': 422, 'Amazon.co.uk': 1.93, 'Amazon.com.au': 4.74, 'EU': 2.05, 'Amazon.pl': 9.58, 'Amazon.se': 22.84 };
                    const largeCosts = { 'Amazon.com': 2.84, 'Amazon.ca': 3.53, 'Amazon.co.jp': 530, 'Amazon.co.uk': 2.15, 'Amazon.com.au': 5.28, 'EU': 2.48, 'Amazon.pl': 11.61, 'Amazon.se': 27.67 };
                    const marketKey = euStores.includes(marketplace) ? 'EU' : marketplace;
                    printingCost = trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                } else if (pageCount >= 110 && pageCount <= 828) {
                    const costs = { 'Amazon.com': [1.00, 0.012], 'Amazon.ca': [1.26, 0.016], 'Amazon.co.jp': [206, 2], 'Amazon.co.uk': [0.85, 0.010], 'Amazon.com.au': [2.42, 0.022], 'EU': [0.75, 0.012], 'Amazon.pl': [3.51, 0.056], 'Amazon.se': [8.37, 0.134] };
                    const largeCosts = { 'Amazon.com': [1.00, 0.017], 'Amazon.ca': [1.26, 0.021], 'Amazon.co.jp': [206, 3], 'Amazon.co.uk': [0.85, 0.012], 'Amazon.com.au': [2.42, 0.027], 'EU': [0.75, 0.016], 'Amazon.pl': [3.51, 0.075], 'Amazon.se': [8.37, 0.179] };
                    const marketKey = euStores.includes(marketplace) ? 'EU' : marketplace;
                    const [fixed, perPage] = trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                    printingCost = fixed + (pageCount * perPage);
                } else { 
                    isSupported = false; 
                }
            }
        } else if (bookType === 'hardcover') {
            if (interiorType === 'Black Ink') {
                if (pageCount >= 75 && pageCount <= 108) {
                    const costs = { 'Amazon.com': 6.80, 'Amazon.co.uk': 5.23, 'EU': 5.95, 'Amazon.pl': 27.85, 'Amazon.se': 66.38 };
                    const largeCosts = { 'Amazon.com': 7.49, 'Amazon.co.uk': 5.45, 'EU': 6.35, 'Amazon.pl': 29.87, 'Amazon.se': 71.21 };
                    const marketKey = euStores.includes(marketplace) ? 'EU' : marketplace;
                    if (costs[marketKey]) {
                        printingCost = trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                    } else { 
                        isSupported = false; 
                    }
                } else if (pageCount >= 110 && pageCount <= 550) {
                    const costs = { 'Amazon.com': [5.65, 0.012], 'Amazon.co.uk': [4.15, 0.010], 'EU': [4.65, 0.012], 'Amazon.pl': [20.34, 0.056], 'Amazon.se': [48.49, 0.134] };
                    const largeCosts = { 'Amazon.com': [5.65, 0.017], 'Amazon.co.uk': [4.15, 0.012], 'EU': [4.65, 0.016], 'Amazon.pl': [20.34, 0.075], 'Amazon.se': [48.49, 0.179] };
                    const marketKey = euStores.includes(marketplace) ? 'EU' : marketplace;
                    if (costs[marketKey]) {
                        const [fixed, perPage] = trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                        printingCost = fixed + (pageCount * perPage);
                    } else { 
                        isSupported = false; 
                    }
                } else { 
                    isSupported = false; 
                }
            }
        } else { 
            isSupported = false; 
        }
        
        if (isSupported && printingCost > 0) {
            printingCost = parseFloat(printingCost.toFixed(2));
            
            // Calculate royalty rate using exact book_calc.html logic
            let royaltyRate = 0.6;
            const threshold = royaltyThresholds[marketplace];
            if (threshold && price < threshold) {
                royaltyRate = 0.5;
            }
            
            // Handle VAT for EU markets using exact book_calc.html logic
            let VAT = 0, priceAfterVat = price;
            if (euStores.includes(marketplace)) {
                let vatRate = 0.07; // Default for DE, NL
                if (marketplace === "Amazon.fr") vatRate = 0.055;
                if (["Amazon.it", "Amazon.es"].includes(marketplace)) vatRate = 0.04;
                VAT = price * vatRate;
                priceAfterVat = price - VAT;
            }
            
            royaltyPerUnit = Math.max(0, priceAfterVat * royaltyRate - printingCost);
        }
    }
    
    const monthlyRoyalty = Math.round(royaltyPerUnit * monthlySales);
    
    return {
        royaltyPerUnit: royaltyPerUnit,
        monthlyRoyalty: monthlyRoyalty
    };
}

// Create and style the info table
function createInfoTable(bookData, metrics) {
    // Create container
    const container = document.createElement('div');
    container.style.cssText = `
        background-color: white;
        margin: 5px 0;
        padding-bottom: 30px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    // Create header with branding
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
    `;
    
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon32.png');
    icon.alt = 'NicheIntel Pro';
    icon.style.cssText = `
        width: 24px;
        height: 24px;
        margin-right: 8px;
    `;
    
    const title = document.createElement('h3');
    title.style.cssText = `
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
    `;
    title.innerHTML = `<span style="color: #1e293b; text-decoration: none;">NicheIntel Pro by </span><a href="https://adigy.ai" target="_blank" style="color: #f59e0b; text-decoration: none;">Adigy.AI</a><span style="color: #1e293b; text-decoration: none;"> - Ads Automation for Publishers</span>`;
    
    header.appendChild(icon);
    header.appendChild(title);
    container.appendChild(header);
    
    // Create info table
    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    `;
    
    // Create table data with reordered columns: Pages 3rd, Large Trim 9th
    const labels = ['ASIN', 'Price', 'Pages', 'Review Images', 'A+ Modules', 'UGC Videos', 'Editorial Reviews', 'BSR', 'Large Trim', 'Royalty/Unit', 'Monthly Royalty'];
    const values = [
        bookData.asin || 'N/A',
        bookData.listPrice ? `$${bookData.listPrice.toFixed(2)}` : 'N/A',
        bookData.pageCount ? bookData.pageCount.toLocaleString() : 'N/A',
        bookData.reviewImages || '0',
        bookData.aplusModules || '0',
        bookData.ugcVideos || '0',
        bookData.editorialReviews ? 'Yes' : 'No',
        bookData.bsr ? bookData.bsr.toLocaleString() : 'N/A',
        bookData.largeTrim ? 'Yes' : 'No',
        metrics.royaltyPerUnit ? `$${metrics.royaltyPerUnit.toFixed(2)}` : 'N/A',
        metrics.monthlyRoyalty ? `$${metrics.monthlyRoyalty.toLocaleString()}` : 'N/A'
    ];
    
    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background-color: #1e293b;';
    
    labels.forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        th.style.cssText = `
            padding: 10px 8px;
            color: white;
            font-weight: 600;
            text-align: center;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-right: 1px solid rgba(255,255,255,0.2);
        `;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Create data row
    const dataRow = document.createElement('tr');
    dataRow.style.cssText = 'background-color: white;';
    
    values.forEach((value, index) => {
        const td = document.createElement('td');
        td.textContent = value;
        td.style.cssText = `
            padding: 12px 8px;
            color: #374151;
            text-align: center;
            font-weight: 500;
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
        `;
        dataRow.appendChild(td);
    });
    table.appendChild(dataRow);
    
    container.appendChild(table);
    return container;
}

// Insert the info table into the page
function insertInfoTable() {
    // Find a good insertion point
    const insertionPoints = [
        '#dp-container',
        '#centerCol',
        '#dpx-center-col-wrapper',
        '#dp',
        '#main-content',
        '#ppd',
        'body'  // Fallback to body
    ];
    
    let targetElement = null;
    for (const selector of insertionPoints) {
        targetElement = document.querySelector(selector);
        if (targetElement) {
            console.log(`NicheIntel Pro: Found insertion point: ${selector}`);
            break;
        }
    }
    
    if (!targetElement) {
        console.log("NicheIntel Pro: Could not find suitable insertion point, skipping table insertion");
        return;
    }
    
    // Extract data and create table
    const bookData = extractBookData();
    const metrics = calculateMonthlyMetrics(bookData);
    const infoTable = createInfoTable(bookData, metrics);
    
    // Insert at the beginning of the target element
    targetElement.insertBefore(infoTable, targetElement.firstChild);
    
    console.log("NicheIntel Pro: Info table inserted successfully");
}

// Main initialization function
function initBookPageInfo() {
    // Don't run on search pages - those are handled by the main analysis
    if (window.location.pathname.includes('/s')) {
        console.log("NicheIntel Pro: On search page, skipping book page info");
        return;
    }
    
    if (!isValidBookPage()) {
        console.log("NicheIntel Pro: Not a valid book page, skipping");
        return;
    }
    
    console.log("NicheIntel Pro: Valid book page detected, initializing");
    
    // Wait for the page to fully load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insertInfoTable);
    } else {
        insertInfoTable();
    }
}

// Start the extension
initBookPageInfo();