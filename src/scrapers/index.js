/**
 * Scrapers Main Entry Point
 * Bundles all scraper modules and exposes functions globally for chrome.scripting.executeScript()
 */

import { runFullAmazonAnalysis } from './serp-extractor.js';
import { runFullProductPageExtraction } from './product-extractor.js';
import { parseProductPageFromHTML } from './offscreen-parser.js';
import {
    getMarketplaceInfo,
    estimateSales,
    exceedsKdpPageLimits,
    calculateTraditionalPublishingEstimate,
    calculateSimplifiedRoyalty,
    calculateRoyaltyAndSales
} from './royalty-calculator.js';

/**
 * Dispatcher function that runs the appropriate extractor based on page type.
 * Called from background script after injection.
 */
function runExtractor() {
    console.log("scrapers.js: Running extractor.");
    if (document.querySelector('div[data-component-type="s-search-result"]')) {
        console.log("scrapers.js: SERP page detected. Running SERP analysis.");
        return runFullAmazonAnalysis();
    } else {
        console.log("scrapers.js: Product page detected. Running product page extraction.");
        return runFullProductPageExtraction();
    }
}

// Expose functions to global scope for chrome.scripting.executeScript()
// These are accessed by background.js when injecting the script
if (typeof window !== 'undefined') {
    window.runExtractor = runExtractor;
    window.runFullAmazonAnalysis = runFullAmazonAnalysis;
    window.runFullProductPageExtraction = runFullProductPageExtraction;
    window.parseProductPageFromHTML = parseProductPageFromHTML;

    // Also expose royalty utilities for potential direct use
    window.getMarketplaceInfo = getMarketplaceInfo;
    window.estimateSales = estimateSales;
    window.exceedsKdpPageLimits = exceedsKdpPageLimits;
    window.calculateTraditionalPublishingEstimate = calculateTraditionalPublishingEstimate;
    window.calculateSimplifiedRoyalty = calculateSimplifiedRoyalty;
    window.calculateRoyaltyAndSales = calculateRoyaltyAndSales;
}

// Also expose at global scope for non-window contexts (offscreen document)
if (typeof globalThis !== 'undefined') {
    globalThis.runExtractor = runExtractor;
    globalThis.runFullAmazonAnalysis = runFullAmazonAnalysis;
    globalThis.runFullProductPageExtraction = runFullProductPageExtraction;
    globalThis.parseProductPageFromHTML = parseProductPageFromHTML;
}

// Export for module usage
export {
    runExtractor,
    runFullAmazonAnalysis,
    runFullProductPageExtraction,
    parseProductPageFromHTML,
    getMarketplaceInfo,
    estimateSales,
    exceedsKdpPageLimits,
    calculateTraditionalPublishingEstimate,
    calculateSimplifiedRoyalty,
    calculateRoyaltyAndSales
};
