/**
 * Royalty Calculator Module
 * Handles sales estimation and royalty calculations for KDP and traditional publishing
 */

// Sales estimation constants
const SALES_MULTIPLIERS = {
    ebook: { USD: 1, GBP: 0.31, DE: 0.36, FR: 0.11, ES: 0.093, IT: 0.10, NL: 0.023, YEN: 0.22, IN: 0.021, CAD: 0.17, MEX: 0.044, AUD: 0.022, SE: 1, PL: 1 },
    paperback: { USD: 1, GBP: 0.16, DE: 0.19, FR: 0.055, ES: 0.048, IT: 0.053, NL: 0.012, YEN: 0.12, IN: 0.011, CAD: 0.089, MEX: 0.023, AUD: 0.011, SE: 1, PL: 1 },
    hardcover: { USD: 1, GBP: 0.16, DE: 0.19, FR: 0.055, ES: 0.048, IT: 0.053, NL: 0.012, YEN: 0.12, IN: 0.011, CAD: 0.089, MEX: 0.023, AUD: 0.011, SE: 1, PL: 1 }
};

// BSR to sales conversion constants
const BSR_CONSTANTS = { A: 3.35038, B: -0.29193, C: -0.070538 };

// KDP page limits
const KDP_PAPERBACK_MAX_PAGES = 828;
const KDP_HARDCOVER_MAX_PAGES = 550;

// Royalty rate thresholds by marketplace
const ROYALTY_THRESHOLDS = {
    USD: 9.99, DE: 9.99, FR: 9.99, IT: 9.99, ES: 9.99, NL: 9.99,
    GBP: 7.99, CAD: 13.99, AUD: 13.99, YEN: 1000, PL: 40, SE: 99
};

// Traditional publishing royalty rate estimate
const TRADITIONAL_ROYALTY_RATE = 0.10;

// EU markets for VAT calculation
const EU_MARKET_CODES = ['DE', 'FR', 'IT', 'ES', 'NL'];

/**
 * Calculate core units from BSR using polynomial formula
 */
function coreUnits(bsr) {
    if (bsr <= 100000) {
        const t = Math.log10(bsr);
        return 10 ** (BSR_CONSTANTS.A + BSR_CONSTANTS.B * t + BSR_CONSTANTS.C * t * t);
    }
    return 100000 / (100000 + (bsr - 100000) * 8);
}

/**
 * Get sales multiplier for book type and market
 */
function getMultiplier(type, market) {
    return SALES_MULTIPLIERS[type]?.[market] ?? 1;
}

/**
 * Estimate daily sales from BSR
 */
export function estimateSales(bsr, bookType, market) {
    if (!Number.isFinite(bsr) || bsr < 1) return 0;
    return Math.max(0, 1.37 * coreUnits(bsr) * getMultiplier(bookType, market));
}

/**
 * Get marketplace info from hostname or URL
 */
export function getMarketplaceInfo(hostnameOrUrl) {
    const hostname = hostnameOrUrl || (typeof window !== 'undefined' ? window.location.hostname : '');
    const tldMap = {
        'amazon.com': { code: 'USD' }, 'amazon.ca': { code: 'CAD' }, 'amazon.co.uk': { code: 'GBP' },
        'amazon.de': { code: 'DE' }, 'amazon.fr': { code: 'FR' }, 'amazon.it': { code: 'IT' },
        'amazon.es': { code: 'ES' }, 'amazon.nl': { code: 'NL' }, 'amazon.com.au': { code: 'AUD' },
        'amazon.co.jp': { code: 'YEN' }, 'amazon.pl': { code: 'PL' }, 'amazon.se': { code: 'SE' }
    };
    for (const key in tldMap) {
        if (hostname.includes(key)) return tldMap[key];
    }
    return { code: 'USD' };
}

/**
 * Check if book exceeds KDP page limits
 */
export function exceedsKdpPageLimits(bookType, pageCount) {
    const type = bookType.toLowerCase();
    if (type.includes('paperback') && pageCount > KDP_PAPERBACK_MAX_PAGES) return true;
    if (type.includes('hardcover') && pageCount > KDP_HARDCOVER_MAX_PAGES) return true;
    return false;
}

/**
 * Extract best price from format prices array
 */
function extractPrice(prices) {
    if (!prices || prices.length === 0) return null;

    const listPriceObj = prices.find(p => p.type === 'list_price');
    if (listPriceObj) return listPriceObj.price;

    const validPrices = prices.filter(p => p.type !== 'ku_price' && p.price > 0).map(p => p.price);
    return validPrices.length > 0 ? Math.max(...validPrices) : null;
}

/**
 * Calculate estimated royalty for books that exceed KDP page limits
 * These are likely traditionally published books, not self-published via KDP
 */
export function calculateTraditionalPublishingEstimate(format, productDetails, marketplaceInfo, logPrefix = 'scrapers.js') {
    console.log(`${logPrefix}: Using traditional publishing estimate (book exceeds KDP page limits)`);

    const price = extractPrice(format.prices);
    const bsr = productDetails.bsr || null;
    const pageCount = productDetails.print_length;
    const book_type = format.formatName.toLowerCase();

    if (!price) {
        console.warn(`${logPrefix}: No valid price found for traditional publishing estimate`);
        return { error: "No valid price found", is_estimate: true };
    }

    // Estimate monthly sales from BSR if available
    let monthly_sales = 0;
    if (bsr) {
        const daily_sales = estimateSales(bsr, book_type, marketplaceInfo.code);
        monthly_sales = Math.round(daily_sales * 30);
    } else {
        monthly_sales = 10;
        console.warn(`${logPrefix}: No BSR available, using fallback monthly sales estimate`);
    }

    const royaltyPerUnit = parseFloat((price * TRADITIONAL_ROYALTY_RATE).toFixed(2));
    const monthly_royalty = Math.round(royaltyPerUnit * monthly_sales);

    console.log(`${logPrefix}: Traditional publishing estimate result:`, {
        royalty_per_unit: royaltyPerUnit,
        monthly_sales,
        monthly_royalty,
        page_count: pageCount,
        exceeds_kdp_limit: true
    });

    return {
        royalty_per_unit: royaltyPerUnit,
        monthly_sales: monthly_sales,
        monthly_royalty: monthly_royalty,
        is_estimate: true,
        calculation_assumptions: {
            is_traditional_publishing_estimate: true,
            traditional_royalty_rate: TRADITIONAL_ROYALTY_RATE,
            price_used: price,
            page_count: pageCount,
            bsr_used: bsr,
            book_type: book_type,
            reason: `Book exceeds KDP page limits (${pageCount} pages)`
        }
    };
}

/**
 * Simplified fallback royalty calculation
 */
export function calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo, logPrefix = 'scrapers.js') {
    console.log(`${logPrefix}: Using simplified fallback royalty calculation`);

    const price = extractPrice(format.prices);
    const bsr = productDetails.bsr || null;
    const pageCount = productDetails.print_length || 100;
    const market_code = marketplaceInfo.code || 'USD';
    const book_type = format.formatName.toLowerCase();

    if (!price) {
        console.warn(`${logPrefix}: No valid price found for simplified calculation`);
        return { error: "No valid price found" };
    }

    // Calculate monthly sales
    let monthly_sales = 0;
    if (bsr) {
        const daily_sales = estimateSales(bsr, book_type, market_code);
        monthly_sales = Math.round(daily_sales * 30);
    } else {
        monthly_sales = 10;
        console.warn(`${logPrefix}: No BSR available, using fallback monthly sales estimate`);
    }

    // Calculate royalty based on book type
    let royaltyPerUnit = 0;
    console.log(`${logPrefix}: Simplified calculation for book type: "${book_type}" with price: $${price}`);

    if (book_type.includes('kindle') || book_type.includes('ebook')) {
        if (price >= 2.99 && price <= 9.99) {
            royaltyPerUnit = price * 0.7;
            console.log(`${logPrefix}: Kindle 70% royalty applied: $${royaltyPerUnit.toFixed(2)}`);
        } else {
            royaltyPerUnit = price * 0.35;
            console.log(`${logPrefix}: Kindle 35% royalty applied: $${royaltyPerUnit.toFixed(2)}`);
        }
    } else if (book_type.includes('hardcover')) {
        const printingCost = 5.65 + (pageCount * 0.012);
        const royaltyRate = price < 10 ? 0.5 : 0.6;
        royaltyPerUnit = Math.max(0, (price * royaltyRate) - printingCost);
        console.log(`${logPrefix}: Hardcover royalty: ($${price} * ${royaltyRate}) - $${printingCost.toFixed(2)} = $${royaltyPerUnit.toFixed(2)}`);
    } else {
        const printingCost = 0.85 + (pageCount * 0.012);
        const royaltyRate = price < 10 ? 0.5 : 0.6;
        royaltyPerUnit = Math.max(0, (price * royaltyRate) - printingCost);
        console.log(`${logPrefix}: Paperback royalty: ($${price} * ${royaltyRate}) - $${printingCost.toFixed(2)} = $${royaltyPerUnit.toFixed(2)}`);
    }

    const monthly_royalty = Math.round(royaltyPerUnit * monthly_sales);

    console.log(`${logPrefix}: Simplified calculation result:`, {
        royalty_per_unit: royaltyPerUnit.toFixed(2),
        monthly_sales,
        monthly_royalty
    });

    return {
        royalty_per_unit: parseFloat(royaltyPerUnit.toFixed(2)),
        monthly_sales: monthly_sales,
        monthly_royalty: monthly_royalty,
        calculation_assumptions: {
            simplified: true,
            price_used: price,
            page_count_used: pageCount,
            bsr_used: bsr,
            book_type: book_type
        }
    };
}

/**
 * Custom rounding for royalty values
 */
function customRoundRoyalty(value) {
    if (value >= 50) {
        return Math.round(value / 100) * 100;
    }
    return Math.round(value / 10) * 10;
}

/**
 * Calculate printing cost based on book type, page count, and market
 */
function calculatePrintingCost(bookType, pageCount, trimSize, marketKey) {
    const type = bookType.toLowerCase();

    if (type.includes('paperback')) {
        if (pageCount >= 24 && pageCount < 110) {
            const costs = { USD: 2.30, CAD: 2.99, YEN: 422, GBP: 1.93, AUD: 4.74, EU: 2.05, PL: 9.58, SE: 22.84 };
            const largeCosts = { USD: 2.84, CAD: 3.53, YEN: 530, GBP: 2.15, AUD: 5.28, EU: 2.48, PL: 11.61, SE: 27.67 };
            return { cost: trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey], supported: true };
        } else if (pageCount >= 110 && pageCount <= KDP_PAPERBACK_MAX_PAGES) {
            const costs = { USD: [1.00, 0.012], CAD: [1.26, 0.016], YEN: [206, 2], GBP: [0.85, 0.010], AUD: [2.42, 0.022], EU: [0.75, 0.012], PL: [3.51, 0.056], SE: [8.37, 0.134] };
            const largeCosts = { USD: [1.00, 0.017], CAD: [1.26, 0.021], YEN: [206, 3], GBP: [0.85, 0.012], AUD: [2.42, 0.027], EU: [0.75, 0.016], PL: [3.51, 0.075], SE: [8.37, 0.179] };
            const [fixed, perPage] = trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey];
            return { cost: fixed + (pageCount * perPage), supported: true };
        }
    } else if (type.includes('hardcover')) {
        if (pageCount >= 75 && pageCount <= 108) {
            const costs = { USD: 6.80, GBP: 5.23, EU: 5.95, PL: 27.85, SE: 66.38 };
            const largeCosts = { USD: 7.49, GBP: 5.45, EU: 6.35, PL: 29.87, SE: 71.21 };
            if (costs[marketKey]) {
                return { cost: trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey], supported: true };
            }
        } else if (pageCount >= 110 && pageCount <= KDP_HARDCOVER_MAX_PAGES) {
            const costs = { USD: [5.65, 0.012], GBP: [4.15, 0.010], EU: [4.65, 0.012], PL: [20.34, 0.056], SE: [48.49, 0.134] };
            const largeCosts = { USD: [5.65, 0.017], GBP: [4.15, 0.012], EU: [4.65, 0.016], PL: [20.34, 0.075], SE: [48.49, 0.179] };
            if (costs[marketKey]) {
                const [fixed, perPage] = trimSize === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                return { cost: fixed + (pageCount * perPage), supported: true };
            }
        }
    }

    return { cost: 0, supported: false };
}

/**
 * Full royalty and sales calculation for KDP books
 */
export function calculateRoyaltyAndSales(format, productDetails, marketplaceInfo, logPrefix = 'scrapers.js') {
    console.log(`${logPrefix}: Starting calculateRoyaltyAndSales for format:`, format.formatName);
    const book_type = format.formatName.toLowerCase();

    if (!format.prices || format.prices.length === 0) {
        console.error(`${logPrefix}: No price found for this format.`);
        return { error: "No price found for this format." };
    }

    const list_price = extractPrice(format.prices);
    console.log(`${logPrefix}: Using list price: ${list_price}`);

    const page_count = productDetails.print_length;
    const bsr = productDetails.bsr;

    // If essential data is missing, try simplified fallback
    if (!list_price || !page_count || !bsr) {
        console.warn(`${logPrefix}: Missing essential data for complex calculation, attempting simplified fallback.`, { list_price, page_count, bsr });
        return calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo, logPrefix);
    }

    const market_code = marketplaceInfo.code;
    const trim_size = productDetails.large_trim ? 'large' : 'regular';
    const marketKey = EU_MARKET_CODES.includes(market_code) ? 'EU' : market_code;

    console.log(`${logPrefix}: Calculation parameters:`, { book_type, market_code, trim_size, page_count, bsr });

    // Calculate printing cost
    const { cost: printing_cost, supported: is_supported } = calculatePrintingCost(book_type, page_count, trim_size, marketKey);

    if (!is_supported || !printing_cost) {
        // Check if book exceeds KDP page limits
        if (exceedsKdpPageLimits(book_type, page_count)) {
            console.warn(`${logPrefix}: Book exceeds KDP page limits (Type: ${book_type}, Pages: ${page_count}), using traditional publishing estimate`);
            return calculateTraditionalPublishingEstimate(format, productDetails, marketplaceInfo, logPrefix);
        }

        console.warn(`${logPrefix}: Combination not supported (Type: ${book_type}, Pages: ${page_count}), falling back to simplified calculation`);
        return calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo, logPrefix);
    }

    const final_printing_cost = parseFloat(printing_cost.toFixed(2));
    console.log(`${logPrefix}: Calculated printing cost: ${final_printing_cost}`);

    // Determine royalty rate
    let royalty_rate = 0.6;
    const threshold = ROYALTY_THRESHOLDS[market_code];
    if (threshold && list_price < threshold) {
        royalty_rate = 0.5;
        console.log(`${logPrefix}: Price is below threshold. Using royalty rate: ${royalty_rate}`);
    } else {
        console.log(`${logPrefix}: Using default royalty rate: ${royalty_rate}`);
    }

    // Apply VAT for EU markets
    let VAT = 0, price_after_vat = list_price;
    if (EU_MARKET_CODES.includes(market_code)) {
        let vat_rate = 0.07; // DE, NL
        if (market_code === "FR") vat_rate = 0.055;
        if (["IT", "ES"].includes(market_code)) vat_rate = 0.04;
        VAT = list_price * vat_rate;
        price_after_vat = list_price - VAT;
        console.log(`${logPrefix}: Applied VAT: ${VAT.toFixed(2)}. Price after VAT: ${price_after_vat.toFixed(2)}`);
    }

    // Calculate final royalty
    const calculated_royalty = price_after_vat * royalty_rate - final_printing_cost;
    const royalty_amount = Math.max(0, parseFloat(calculated_royalty.toFixed(2)));
    const daily_sales = estimateSales(bsr, book_type, market_code);
    const monthly_sales = Math.round(daily_sales * 30);
    const monthly_royalty_unrounded = royalty_amount > 0 ? royalty_amount * monthly_sales : 0;
    const monthly_royalty = customRoundRoyalty(monthly_royalty_unrounded);

    return {
        royalty_per_unit: royalty_amount,
        monthly_sales: monthly_sales,
        monthly_royalty: monthly_royalty,
        calculation_assumptions: {
            interior_type: 'Black Ink',
            list_price_used: list_price,
            royalty_rate_used: royalty_rate,
            printing_cost: final_printing_cost,
            bsr_used: bsr,
            vat_applied: parseFloat(VAT.toFixed(2))
        }
    };
}
