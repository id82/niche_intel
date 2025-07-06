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
        price: null,
        bsr: null,
        pageCount: null,
        largeTrim: false,
        marketplace: window.location.hostname
    };
    
    // Extract title
    const titleElement = document.querySelector('#productTitle');
    if (titleElement) {
        data.title = titleElement.textContent.trim();
    }
    
    // Extract price from various possible locations
    const priceSelectors = [
        '.a-price.a-text-price.a-size-medium.apexPriceToPay span.a-offscreen',
        '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
        '.a-price .a-offscreen',
        '#priceblock_dealprice',
        '#priceblock_ourprice'
    ];
    
    for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
            const priceText = priceElement.textContent.trim();
            const priceMatch = priceText.match(/[\d.]+/);
            if (priceMatch) {
                data.price = parseFloat(priceMatch[0]);
                break;
            }
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
    
    // Check for large trim (simplified - assume based on page dimensions or other indicators)
    // This is a simplified check - in a real implementation you'd extract actual dimensions
    data.largeTrim = data.pageCount && data.pageCount > 300; // Simple heuristic
    
    console.log("NicheIntel Pro: Extracted book data:", data);
    return data;
}

// Calculate monthly sales and royalty using the EXACT same logic as scrapers.js
function calculateMonthlyMetrics(bookData) {
    if (!bookData.bsr || !bookData.price || !bookData.pageCount) {
        return { monthlySales: null, monthlyRoyalty: null, dailySales: null, royaltyPerUnit: null };
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
    
    // Calculate royalty per unit (simplified version of the main logic)
    let royaltyPerUnit = 0;
    if (bookType === 'kindle') {
        // Simplified Kindle royalty calculation
        if (bookData.price >= 2.99 && bookData.price <= 9.99) {
            royaltyPerUnit = bookData.price * 0.7; // 70% royalty
        } else {
            royaltyPerUnit = bookData.price * 0.35; // 35% royalty
        }
    } else {
        // Simplified paperback royalty calculation
        const printingCost = 0.85 + (bookData.pageCount * 0.012); // Simplified printing cost
        const royaltyRate = bookData.price < 10 ? 0.5 : 0.6; // Simplified royalty rate
        royaltyPerUnit = Math.max(0, (bookData.price * royaltyRate) - printingCost);
    }
    
    const monthlyRoyalty = Math.round(royaltyPerUnit * monthlySales);
    
    return {
        dailySales: dailySales,
        monthlySales: monthlySales,
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
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin: 20px 0;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
    title.innerHTML = `<a href="https://adigy.ai" target="_blank" style="color: #f59e0b; text-decoration: none;">NicheIntel Pro by Adigy.AI</a> - Ads Automation for Publishers`;
    
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
    
    // Create transposed table data (remove title, transpose to horizontal layout)
    const labels = ['ASIN', 'Price', 'BSR', 'Pages', 'Daily Sales', 'Monthly Sales', 'Royalty/Unit', 'Monthly Royalty'];
    const values = [
        bookData.asin || 'N/A',
        bookData.price ? `$${bookData.price.toFixed(2)}` : 'N/A',
        bookData.bsr ? bookData.bsr.toLocaleString() : 'N/A',
        bookData.pageCount ? bookData.pageCount.toLocaleString() : 'N/A',
        metrics.dailySales ? metrics.dailySales.toFixed(1) : 'N/A',
        metrics.monthlySales ? metrics.monthlySales.toLocaleString() : 'N/A',
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
        '#dp'
    ];
    
    let targetElement = null;
    for (const selector of insertionPoints) {
        targetElement = document.querySelector(selector);
        if (targetElement) break;
    }
    
    if (!targetElement) {
        console.log("NicheIntel Pro: Could not find suitable insertion point");
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