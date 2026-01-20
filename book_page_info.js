// NicheIntel Pro - Book Page Info Extension
// Displays royalty and sales information on individual Amazon book pages

console.log("NicheIntel Pro: Book page info script loaded");

// ============================================================================
// LOCATION AUTO-SET FEATURE (amazon.com only)
// Automatically sets delivery location to New York 10010 if not already set
// ============================================================================

const LOCATION_CONFIG = {
    targetZipCode: '10010',
    targetLocationText: '10010', // Text to check for in location display
    selectors: {
        locationTrigger: 'a#nav-global-location-popover-link',
        zipCodeInput: '#GLUXZipUpdateInput',
        zipCodeInputAlt: 'input[data-action="GLUXPostalInputAction"]',
        applyButton: 'input[aria-labelledby="GLUXZipUpdate-announce"]',
        confirmButton: '#GLUXConfirmClose',
        confirmButtonAlt: 'input[aria-labelledby="GLUXConfirmClose-announce"]',
        closeButtonFallback: 'button[data-action="a-popover-close"].a-button-close'
    }
};

/**
 * Check if current page is amazon.com (US marketplace only)
 */
function isAmazonUS() {
    const hostname = window.location.hostname;
    // Match www.amazon.com or amazon.com but NOT amazon.com.au, amazon.co.uk, etc.
    return hostname === 'www.amazon.com' || hostname === 'amazon.com';
}

/**
 * Get the current location text from the location popover trigger
 */
function getCurrentLocationText() {
    const trigger = document.querySelector(LOCATION_CONFIG.selectors.locationTrigger);
    if (!trigger) {
        console.log("NicheIntel Pro Location: Location trigger not found");
        return null;
    }
    return trigger.textContent.trim().replace(/\s+/g, ' ');
}

/**
 * Check if the current location is already set to target zip code
 */
function isLocationAlreadySet() {
    const locationText = getCurrentLocationText();
    if (!locationText) return false;

    const isSet = locationText.includes(LOCATION_CONFIG.targetLocationText);
    console.log(`NicheIntel Pro Location: Current location "${locationText}", target zip found: ${isSet}`);
    return isSet;
}

/**
 * Wait for an element to appear in the DOM
 */
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

/**
 * Wait for a specified number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Automatically set the delivery location to target zip code
 */
async function autoSetLocation() {
    // Only run on amazon.com
    if (!isAmazonUS()) {
        console.log("NicheIntel Pro Location: Not amazon.com, skipping location auto-set");
        return;
    }

    // Check if location is already set
    if (isLocationAlreadySet()) {
        console.log("NicheIntel Pro Location: Location already set to target, skipping");
        return;
    }

    console.log("NicheIntel Pro Location: Starting automatic location update...");

    try {
        // Step 1: Click the location trigger to open the modal
        const trigger = document.querySelector(LOCATION_CONFIG.selectors.locationTrigger);
        if (!trigger) {
            console.log("NicheIntel Pro Location: Location trigger not found, aborting");
            return;
        }

        trigger.click();
        console.log("NicheIntel Pro Location: Clicked location trigger");

        // Step 2: Wait for and fill in the zip code input
        await sleep(500); // Wait for modal animation

        let zipInput = await waitForElement(LOCATION_CONFIG.selectors.zipCodeInput, 3000)
            .catch(() => null);

        if (!zipInput) {
            zipInput = await waitForElement(LOCATION_CONFIG.selectors.zipCodeInputAlt, 2000)
                .catch(() => null);
        }

        if (!zipInput) {
            console.log("NicheIntel Pro Location: Zip code input not found, aborting");
            return;
        }

        // Clear and set the zip code
        zipInput.value = '';
        zipInput.value = LOCATION_CONFIG.targetZipCode;
        zipInput.dispatchEvent(new Event('input', { bubbles: true }));
        zipInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log("NicheIntel Pro Location: Entered zip code", LOCATION_CONFIG.targetZipCode);

        // Step 3: Click the Apply button
        await sleep(300);

        const applyButton = document.querySelector(LOCATION_CONFIG.selectors.applyButton);
        if (!applyButton) {
            console.log("NicheIntel Pro Location: Apply button not found, aborting");
            return;
        }

        applyButton.click();
        console.log("NicheIntel Pro Location: Clicked Apply button");

        // Step 4: Wait for and click the Confirm/Continue button (or close button as fallback)
        await sleep(1000); // Wait for confirmation modal

        let confirmButton = await waitForElement(LOCATION_CONFIG.selectors.confirmButton, 3000)
            .catch(() => null);

        if (!confirmButton) {
            confirmButton = await waitForElement(LOCATION_CONFIG.selectors.confirmButtonAlt, 2000)
                .catch(() => null);
        }

        // Fallback to close button if confirm button not found
        if (!confirmButton) {
            confirmButton = document.querySelector(LOCATION_CONFIG.selectors.closeButtonFallback);
            if (confirmButton) {
                console.log("NicheIntel Pro Location: Using close button fallback");
            }
        }

        if (confirmButton) {
            confirmButton.click();
            console.log("NicheIntel Pro Location: Clicked Confirm/Close button");
            console.log("NicheIntel Pro Location: Location successfully updated to", LOCATION_CONFIG.targetZipCode);
        } else {
            console.log("NicheIntel Pro Location: No confirm or close button found, location may still be updated");
        }

    } catch (error) {
        console.error("NicheIntel Pro Location: Error during auto-set:", error);
    }
}

// Run location auto-set on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to ensure page elements are ready
        setTimeout(autoSetLocation, 1000);
    });
} else {
    // Page already loaded, run with delay
    setTimeout(autoSetLocation, 1000);
}

// ============================================================================
// END LOCATION AUTO-SET FEATURE
// ============================================================================

// Check if this is a valid Amazon book page
function isValidBookPage() {
    // Primary check: data-request-context element
    try {
        const requestContextElement = document.querySelector('div[data-request-context]');
        if (requestContextElement) {
            const requestContext = JSON.parse(requestContextElement.dataset.requestContext);
            const storeName = requestContext.storeName;
            
            console.log("NicheIntel Pro: Store name detected:", storeName);
            
            // Check if it's a book or kindle page
            if (storeName === 'books' || storeName === 'digital-text') {
                return true;
            }
        }
    } catch (error) {
        console.log("NicheIntel Pro: Error checking data-request-context:", error);
    }
    
    // Secondary check: if nav-subnav with data-category="books" exists, it's a valid book page
    const navSubnav = document.querySelector('div[id="nav-subnav"][data-category="books"]');
    if (navSubnav) {
        console.log("NicheIntel Pro: Found nav-subnav with data-category='books', treating as valid book page");
        return true;
    }
    
    console.log("NicheIntel Pro: No valid book page indicators found");
    return false;
}

// Extract ASIN from URL
function extractASIN() {
    // Match both /dp/ and /gp/product/ patterns
    const asinMatch = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
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
    
    // Enhanced price extraction using multi-tier strategy from price.txt
    const cleanPrice = (text) => {
        if (!text) return null;
        // Remove whitespace
        text = text.trim();
        // Match various price formats including international (1.234,56 or 1,234.56)
        const match = text.match(/(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2}|\d+)/);
        if (!match) return null;

        let priceStr = match[0].replace(/[$,€£¥₹₩¥]/g, ''); // Remove currency symbols
        // Handle different decimal separators based on format
        if (priceStr.includes(',') && priceStr.includes('.')) {
            if (priceStr.lastIndexOf(',') > priceStr.lastIndexOf('.')) {
                // European format: 1.234,56
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            } else {
                // US format: 1,234.56
                priceStr = priceStr.replace(/,/g, '');
            }
        } else if (priceStr.includes(',')) {
            // Could be European decimal (12,34) or US thousands (1,234)
            const parts = priceStr.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                // European decimal format
                priceStr = priceStr.replace(',', '.');
            } else {
                // US thousands format
                priceStr = priceStr.replace(/,/g, '');
            }
        }
        
        const price = parseFloat(priceStr);
        return isNaN(price) ? null : price;
    };
    
    const prices = [];
    
    // Multi-tier extraction strategy based on price.txt
    
    // Tier 1: Primary Target - The Main Buy Box Price (adapted for individual pages)
    const buyBoxContainer = document.querySelector('#Northstar-Buybox, #corePriceDisplay_desktop_feature_div');
    if (buyBoxContainer) {
        // Method A: Reconstruct from price components
        const wholePart = buyBoxContainer.querySelector('.a-price-whole');
        const fractionPart = buyBoxContainer.querySelector('.a-price-fraction');
        if (wholePart && fractionPart) {
            const reconstructedPrice = wholePart.textContent.trim() + fractionPart.textContent.trim();
            const price = cleanPrice(reconstructedPrice);
            if (price !== null) {
                prices.push(price);
            }
        }
        
        // Method B: Screen reader text
        const offscreenPrice = buyBoxContainer.querySelector('.aok-offscreen, .a-offscreen');
        if (offscreenPrice) {
            const price = cleanPrice(offscreenPrice.textContent);
            if (price !== null && !prices.includes(price)) {
                prices.push(price);
            }
        }
    }
    
    // Tier 2: Secondary Target - The Selected Format Price
    const selectedSwatch = document.querySelector('.swatchElement.selected .slot-price .a-color-price, [id^="tmm-grid-swatch-"].selected .slot-price');
    if (selectedSwatch) {
        const price = cleanPrice(selectedSwatch.textContent);
        if (price !== null && !prices.includes(price)) {
            prices.push(price);
        }
    }
    
    // Enhanced format selection area extraction
    document.querySelectorAll('[id^="tmm-grid-swatch-"]').forEach(swatch => {
        const isSelected = swatch.classList.contains('selected');
        if (isSelected) {
            // Extract price from selected format using aria-label
            const slotPrice = swatch.querySelector('.slot-price span[aria-label]');
            if (slotPrice) {
                const price = cleanPrice(slotPrice.getAttribute('aria-label'));
                if (price !== null && !prices.includes(price)) {
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
    
    // Tier 3: General Fallback - broader search within buy box area
    if (prices.length === 0) {
        const buyBoxArea = document.querySelector('#Northstar-Buybox') || document.body;
        const generalPriceElements = buyBoxArea.querySelectorAll('.a-color-price');
        // Take the first element found as per price.txt strategy
        if (generalPriceElements.length > 0) {
            const price = cleanPrice(generalPriceElements[0].textContent);
            if (price !== null && !prices.includes(price)) {
                prices.push(price);
            }
        }
    }
    
    // Final fallback to legacy price selectors if still no prices found
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
            // Try both formats: "#123" and "123 in Books"
            const bsrMatch = text.match(/#([\d,]+)/) || text.match(/Best Sellers Rank:\s*(\d+(?:,\d+)*)/);
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
    
    // Extract review metrics
    data.reviewMetrics = getAdvancedReviewMetrics();
    
    console.log("NicheIntel Pro: Extracted book data:", data);
    return data;
}

// Review analysis functions from review_analysis.txt
function getAdvancedReviewMetrics() {
    const reviewData = {
        totalRatingCount: 0,
        currentAverageRating: 0,
        ratingBreakdown: {},
        calculatedMetrics: {},
        errors: []
    };

    try {
        // --- 1. EXTRACT BASE DATA WITH VALIDATION ---
        const totalCount = extractTotalReviewCount();
        const averageRating = extractAverageRating();

        if (!validateBasicData(totalCount, averageRating)) {
            reviewData.errors.push("Invalid or missing basic review data");
            return reviewData;
        }

        reviewData.totalRatingCount = totalCount;
        reviewData.currentAverageRating = averageRating;

        // --- 2. EXTRACT AND CALCULATE RATING BREAKDOWN ---
        const ratingBreakdown = extractRatingBreakdown();

        if (!ratingBreakdown.isValid) {
            reviewData.errors.push("Could not extract rating breakdown");
            return reviewData;
        }

        reviewData.ratingBreakdown = ratingBreakdown.percentages;

        // --- 3. CALCULATE EXACT COUNTS WITH IMPROVED DISTRIBUTION ---
        const exactCounts = calculateExactCounts(totalCount, ratingBreakdown.percentages);
        const totalScore = calculateTotalScore(exactCounts);

        // --- 4. CALCULATE METRICS ---
        reviewData.calculatedMetrics = calculateMetrics(exactCounts, totalCount, totalScore, averageRating);

        return reviewData;

    } catch (error) {
        reviewData.errors.push(`Calculation error: ${error.message}`);
        return reviewData;
    }
}

function extractTotalReviewCount() {
    const element = document.querySelector('span[data-hook="total-review-count"]');
    if (!element) {
        return 0;
    }

    const text = element.textContent || "";
    const match = text.match(/[\d,]+/);
    if (!match) {
        return 0;
    }

    const numberString = match[0].replace(/,/g, '');
    const count = parseInt(numberString, 10);
    return isNaN(count) ? 0 : count;
}

function extractAverageRating() {
    const element = document.querySelector('span[data-hook="rating-out-of-text"]');
    if (!element) {
        return 0;
    }

    const text = element.textContent || "0";
    const rating = parseFloat(text);
    return isNaN(rating) ? 0 : rating;
}

function validateBasicData(totalCount, averageRating) {
    return totalCount > 0 && averageRating >= 1 && averageRating <= 5;
}

function extractRatingBreakdown() {
    const result = {
        isValid: false,
        percentages: {}
    };

    const histogramContainer = document.getElementById('cm_cr_dp_d_rating_histogram');
    if (!histogramContainer) return result;

    const histogramTable = histogramContainer.querySelector('#histogramTable');
    if (!histogramTable) return result;

    const percentageContainer = histogramTable.querySelector('div.a-section.a-spacing-none.a-text-right.aok-nowrap');
    if (!percentageContainer) return result;

    const percentageSpans = percentageContainer.querySelectorAll('span');
    if (percentageSpans.length !== 5) {
        return result;
    }

    let totalPercentage = 0;

    percentageSpans.forEach((span, index) => {
        const starLevel = 5 - index; // 5-star first, then 4, etc.
        const percentageString = span.textContent.trim();

        if (percentageString) {
            const percentage = parseFloat(percentageString.replace('%', ''));
            if (!isNaN(percentage) && percentage >= 0) {
                result.percentages[starLevel] = percentage / 100;
                totalPercentage += percentage;
            }
        }
    });

    const percentageDiff = Math.abs(totalPercentage - 100);
    result.isValid = percentageDiff < 1; // Allow 1% tolerance for rounding

    return result;
}

function calculateExactCounts(totalCount, percentages) {
    const counts = {};
    const rawCounts = {};
    let remainingCount = totalCount;

    // Calculate raw counts and initial rounded counts
    for (let star = 1; star <= 5; star++) {
        const percentage = percentages[star] || 0;
        const rawCount = totalCount * percentage;
        const roundedCount = Math.round(rawCount);

        rawCounts[star] = rawCount;
        counts[star] = roundedCount;
        remainingCount -= roundedCount;
    }

    // Distribute remaining count using largest remainder method
    if (remainingCount !== 0) {
        const remainders = [];
        for (let star = 1; star <= 5; star++) {
            const remainder = rawCounts[star] - Math.floor(rawCounts[star]);
            remainders.push({ star, remainder, count: counts[star] });
        }

        remainders.sort((a, b) => b.remainder - a.remainder);

        let i = 0;
        const maxIterations = Math.abs(remainingCount) * 2;
        let iterations = 0;

        while (remainingCount !== 0 && iterations < maxIterations) {
            const currentStar = remainders[i].star;
            if (remainingCount > 0) {
                counts[currentStar]++;
                remainingCount--;
            } else {
                if (counts[currentStar] > 0) {
                    counts[currentStar]--;
                    remainingCount++;
                }
            }
            i = (i + 1) % remainders.length;
            iterations++;
        }
    }

    // Ensure non-negative counts
    for (let star = 1; star <= 5; star++) {
        counts[star] = Math.max(0, counts[star] || 0);
    }

    return counts;
}

function calculateTotalScore(counts) {
    let totalScore = 0;
    for (let star = 1; star <= 5; star++) {
        totalScore += (counts[star] || 0) * star;
    }
    return totalScore;
}

function calculateRequired5StarReviews(currentScore, currentCount, targetAverage) {
    if (targetAverage <= 1 || targetAverage > 5 || currentCount === 0) {
        return null;
    }

    const currentAverage = currentScore / currentCount;
    if (currentAverage >= targetAverage) {
        return 0;
    }

    // Formula: x = (target * current_count - current_score) / (5 - target)
    const numerator = (targetAverage * currentCount) - currentScore;
    const denominator = 5 - targetAverage;

    if (denominator <= 0) {
        return null; // Impossible target
    }

    const required = numerator / denominator;
    return Math.max(0, Math.ceil(required));
}

function calculateMetrics(counts, totalCount, totalScore, currentAverage) {
    const metrics = {};

    // Calculate target average without 1-star reviews
    const count1Star = counts[1] || 0;
    const remainingCount = totalCount - count1Star;
    const remainingScore = totalScore - count1Star;

    if (remainingCount > 0) {
        const averageWithout1Star = remainingScore / remainingCount;
        metrics.targetAverageWithout1Star = Math.round(averageWithout1Star * 10) / 10;
        metrics.required5StarReviewOffset = calculateRequired5StarReviews(
            totalScore,
            totalCount,
            metrics.targetAverageWithout1Star
        );
    } else {
        metrics.targetAverageWithout1Star = 0;
        metrics.required5StarReviewOffset = null;
    }

    // Calculate reviews needed for specific targets
    const targets = [4.3, 4.8];
    targets.forEach(target => {
        const key = `reviewsNeededFor${target.toString().replace('.', '_')}`;
        if (currentAverage < target) {
            metrics[key] = calculateRequired5StarReviews(totalScore, totalCount, target);
        } else {
            metrics[key] = 0;
        }
    });

    // Add verification metrics
    const calculatedAverage = totalScore / totalCount;
    const averageDiff = Math.abs(calculatedAverage - currentAverage);
    const countSum = Object.values(counts).reduce((sum, count) => sum + count, 0);

    metrics.verificationData = {
        calculatedAverage: Math.round(calculatedAverage * 100) / 100,
        averageMatch: averageDiff < 0.05,
        totalCountVerification: countSum === totalCount,
        averageDifference: averageDiff,
        countDifference: countSum - totalCount
    };

    return metrics;
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
    
    // Determine book type (ebook, paperback, or hardcover)
    let bookType = 'paperback'; // Default for physical media
    if (window.location.href.includes('digital-text')) {
        bookType = 'ebook';
    } else {
        // It's a physical book. Check if it's a hardcover.
        // Primary method: Check the selected format swatch.
        const selectedSwatch = document.querySelector('#tmmSwatches .a-button-selected .a-button-text, [id^="tmm-grid-swatch-"].selected');
        if (selectedSwatch) {
            const formatText = selectedSwatch.textContent.toLowerCase();
            if (formatText.includes('hardcover') || formatText.includes('hardback')) {
                bookType = 'hardcover';
            }
        } else {
            // Fallback method if no swatches are found (e.g., single-format page): check product details.
            const detailsElements = document.querySelectorAll('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr');
            for (const element of detailsElements) {
                const text = element.textContent.toLowerCase();
                // Look for "Format" and "Hardcover" to avoid false positives (e.g., a book *about* hardcover binding).
                if (text.includes('format') && (text.includes('hardcover') || text.includes('hardback'))) {
                    bookType = 'hardcover';
                    break; // Found it, no need to look further
                }
            }
        }
    }
    console.log("NicheIntel Pro: Determined book type as:", bookType); // For debugging
    
    const marketplaceHostname = window.location.hostname;
    
    // Map marketplace to market code (same as scrapers.js)
    const tldMap = {
        'amazon.com': 'USD', 'amazon.ca': 'CAD', 'amazon.co.uk': 'GBP',
        'amazon.de': 'DE', 'amazon.fr': 'FR', 'amazon.it': 'IT',
        'amazon.es': 'ES', 'amazon.nl': 'NL', 'amazon.com.au': 'AUD',
        'amazon.co.jp': 'YEN', 'amazon.pl': 'PL', 'amazon.se': 'SE'
    };
    
    let marketCode = 'USD'; // Default
    for (const key in tldMap) {
        if (marketplaceHostname.includes(key)) {
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
        // --- START: ADAPTED LOGIC FROM book_calc.txt ---
        
        // 1. Define inputs in the format required by the calculator logic
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
        const page_count = bookData.pageCount;
        const trim_size = bookData.largeTrim ? 'large' : 'regular';
        const interior_type = 'Black Ink'; // Assumption, as we cannot determine this from the page
        const eu_stores = ["Amazon.de", "Amazon.fr", "Amazon.it", "Amazon.es", "Amazon.nl"];

        // 2. Printing Cost Calculation (Exact logic from book_calc.txt for Black Ink)
        let printing_cost = 0;
        let is_supported = true;

        if (bookType === 'paperback') {
            if (interior_type === 'Black Ink') {
                if (page_count >= 24 && page_count < 110) {
                    const costs = { 'Amazon.com': 2.30, 'Amazon.ca': 2.99, 'Amazon.co.jp': 422, 'Amazon.co.uk': 1.93, 'Amazon.com.au': 4.74, 'EU': 2.05, 'Amazon.pl': 9.58, 'Amazon.se': 22.84 };
                    const largeCosts = { 'Amazon.com': 2.84, 'Amazon.ca': 3.53, 'Amazon.co.jp': 530, 'Amazon.co.uk': 2.15, 'Amazon.com.au': 5.28, 'EU': 2.48, 'Amazon.pl': 11.61, 'Amazon.se': 27.67 };
                    const marketKey = eu_stores.includes(marketplace) ? 'EU' : marketplace;
                    printing_cost = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                } else if (page_count >= 110 && page_count <= 828) {
                    const costs = { 'Amazon.com': [1.00, 0.012], 'Amazon.ca': [1.26, 0.016], 'Amazon.co.jp': [206, 2], 'Amazon.co.uk': [0.85, 0.010], 'Amazon.com.au': [2.42, 0.022], 'EU': [0.75, 0.012], 'Amazon.pl': [3.51, 0.056], 'Amazon.se': [8.37, 0.134] };
                    const largeCosts = { 'Amazon.com': [1.00, 0.017], 'Amazon.ca': [1.26, 0.021], 'Amazon.co.jp': [206, 3], 'Amazon.co.uk': [0.85, 0.012], 'Amazon.com.au': [2.42, 0.027], 'EU': [0.75, 0.016], 'Amazon.pl': [3.51, 0.075], 'Amazon.se': [8.37, 0.179] };
                    const marketKey = eu_stores.includes(marketplace) ? 'EU' : marketplace;
                    const [fixed, perPage] = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                    printing_cost = fixed + (page_count * perPage);
                } else { is_supported = false; }
            } else { is_supported = false; } // Other interior types not supported by extractor
        } else if (bookType === 'hardcover') {
            if (interior_type === 'Black Ink') {
                if (page_count >= 75 && page_count <= 108) {
                    const costs = { 'Amazon.com': 6.80, 'Amazon.co.uk': 5.23, 'EU': 5.95, 'Amazon.pl': 27.85, 'Amazon.se': 66.38 };
                    const largeCosts = { 'Amazon.com': 7.49, 'Amazon.co.uk': 5.45, 'EU': 6.35, 'Amazon.pl': 29.87, 'Amazon.se': 71.21 };
                    const marketKey = eu_stores.includes(marketplace) ? 'EU' : marketplace;
                    if (costs[marketKey]) {
                        printing_cost = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                    } else { is_supported = false; }
                } else if (page_count >= 110 && page_count <= 550) {
                    const costs = { 'Amazon.com': [5.65, 0.012], 'Amazon.co.uk': [4.15, 0.010], 'EU': [4.65, 0.012], 'Amazon.pl': [20.34, 0.056], 'Amazon.se': [48.49, 0.134] };
                    const largeCosts = { 'Amazon.com': [5.65, 0.017], 'Amazon.co.uk': [4.15, 0.012], 'EU': [4.65, 0.016], 'Amazon.pl': [20.34, 0.075], 'Amazon.se': [48.49, 0.179] };
                    const marketKey = eu_stores.includes(marketplace) ? 'EU' : marketplace;
                    if (costs[marketKey]) {
                        const [fixed, perPage] = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                        printing_cost = fixed + (page_count * perPage);
                    } else { is_supported = false; }
                } else { is_supported = false; }
            } else { is_supported = false; } // Other interior types not supported by extractor
        } else { is_supported = false; }

        // 3. Royalty & Other Calculations (Exact logic from book_calc.txt)
        if (is_supported && printing_cost > 0) {
            printing_cost = parseFloat(printing_cost.toFixed(2));
            
            // Royalty Rate Calculation
            const royaltyThresholds = { "Amazon.com": 9.99, "Amazon.de": 9.99, "Amazon.fr": 9.99, "Amazon.it": 9.99, "Amazon.es": 9.99, "Amazon.nl": 9.99, "Amazon.co.uk": 7.99, "Amazon.ca": 13.99, "Amazon.com.au": 13.99, "Amazon.co.jp": 1000, "Amazon.pl": 40, "Amazon.se": 99 };
            let royalty_rate = 0.6;
            const threshold = royaltyThresholds[marketplace];
            if (threshold && price < threshold) {
                royalty_rate = 0.5;
            }

            // VAT Calculation
            let VAT = 0, price_after_vat = price;
            if (eu_stores.includes(marketplace)) {
                let vat_rate = 0.07; // Default for DE, NL
                if (marketplace === "Amazon.fr") vat_rate = 0.055;
                if (["Amazon.it", "Amazon.es"].includes(marketplace)) vat_rate = 0.04;
                VAT = price * vat_rate;
                price_after_vat = price - VAT;
            }
            
            // Final Royalty Calculation
            royaltyPerUnit = Math.max(0, price_after_vat * royalty_rate - printing_cost);
        }
        // --- END: ADAPTED LOGIC ---
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
    
    // Determine dynamic header and calculate 5-star reviews needed
    const reviewMetrics = bookData.reviewMetrics;
    let dynamicColumnHeader = '5★ Needed (4.3)';
    let reviewsNeeded = 'N/A';
    
    if (reviewMetrics && reviewMetrics.currentAverageRating > 0 && !reviewMetrics.errors.length) {
        const currentRating = reviewMetrics.currentAverageRating;
        
        if (currentRating >= 4.8) {
            dynamicColumnHeader = '5★ Needed (4.8)';
            reviewsNeeded = '0';
        } else if (currentRating >= 4.3) {
            dynamicColumnHeader = '5★ Needed (4.8)';
            reviewsNeeded = reviewMetrics.calculatedMetrics.reviewsNeededFor4_8 || 'N/A';
        } else {
            dynamicColumnHeader = '5★ Needed (4.3)';
            reviewsNeeded = reviewMetrics.calculatedMetrics.reviewsNeededFor4_3 || 'N/A';
        }
    }
    
    // Create table data with the new 4th column
    const labels = ['ASIN', 'Price', 'Pages', dynamicColumnHeader, 'Review Images', 'A+ Modules', 'UGC Videos', 'Editorial Reviews', 'BSR', 'Large Trim', 'BE ACOS', 'Royalty/Book', 'Est. Monthly Royalty'];
    
    // Calculate BE ACOS (Break Even ACOS) = Royalty/Book ÷ Price
    const price = bookData.listPrice || bookData.price;
    const beAcos = (metrics.royaltyPerUnit && price) ? (metrics.royaltyPerUnit / price) * 100 : 0;
    
    const values = [
        bookData.asin || 'N/A',
        bookData.listPrice ? `$${bookData.listPrice.toFixed(2)}` : 'N/A',
        bookData.pageCount ? bookData.pageCount.toLocaleString() : 'N/A',
        reviewsNeeded,
        bookData.reviewImages || '0',
        bookData.aplusModules || '0',
        bookData.ugcVideos || '0',
        bookData.editorialReviews ? 'Yes' : 'No',
        bookData.bsr ? bookData.bsr.toLocaleString() : 'N/A',
        bookData.largeTrim ? 'Yes' : 'No',
        beAcos ? `${beAcos.toFixed(0)}%` : '0%',
        metrics.royaltyPerUnit ? `$${metrics.royaltyPerUnit.toFixed(2)}` : '$0.00',
        metrics.monthlyRoyalty ? `$${metrics.monthlyRoyalty.toLocaleString()}` : '$0'
    ];
    
    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background-color: #1e293b;';
    
    labels.forEach((label, index) => {
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
            position: relative;
        `;
        
        // Add tooltip to the 4th column (index 3 - the dynamic rating column)
        if (index === 3) {
            th.style.cursor = 'help';
            th.title = 'At 4.3 rating the 5th star on Amazon is colored half in. At 4.8 the 5th star is fully colored in, which leads to better conversion rates.';
            
            // Enhanced tooltip styling
            th.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#374151';
            });
            
            th.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'transparent';
            });
        }
        
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
    
    // Only run on product detail pages with /dp/ or /gp/ in the URL
    if (!window.location.pathname.includes('/dp/') && !window.location.pathname.includes('/gp/') || window.location.pathname.includes('/gp/bestsellers')) {
        console.log("NicheIntel Pro: Not a product detail page or is a bestsellers page, skipping book page info");
        return;
    }
    
    // Check if tmm-grid-swatch elements exist (indicates individual book page)
    const tmmSwatches = document.querySelectorAll('[id^="tmm-grid-swatch-"]');
    if (tmmSwatches.length === 0) {
        console.log("NicheIntel Pro: No tmm-grid-swatch elements found, not an individual book page, skipping");
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