/**
 * Utilities Module
 * Helper functions for the report
 */

import { getCurrentDomain } from './state.js';

// Currency symbol mapping based on domain
const CURRENCY_MAP = {
    'amazon.com': '$',
    'amazon.ca': '$',
    'amazon.co.uk': '\u00A3',
    'amazon.de': '\u20AC',
    'amazon.fr': '\u20AC',
    'amazon.it': '\u20AC',
    'amazon.es': '\u20AC',
    'amazon.nl': '\u20AC',
    'amazon.com.au': '$',
    'amazon.co.jp': '\u00A5',
    'amazon.pl': 'zl',
    'amazon.se': 'kr'
};

export function getCurrencySymbol(domain) {
    return CURRENCY_MAP[domain] || '';
}

export function getTypeTooltip(type) {
    const tooltips = {
        'O': 'Organic - natural ranking without paid advertising',
        'SP': 'Sponsored Products - individual product advertising',
        'SB': 'Sponsored Brands - brand advertising at top of search results',
        'PV': 'Product Video - video advertising placements for 1 ASIN',
        'BV': 'Brand Video - video advertising placements for multiple ASINs',
        'OC': 'Organic Carousel - multiple ASINs in strip',
        'SC': 'Sponsored Carousel - multiple ASINs in sponsored strip',
    };
    return tooltips[type] || `${type} - placement type`;
}

export function getTruncatedTitle(title, maxLength = 60) {
    if (!title || title === 'N/A') return title;

    const viewportWidth = window.innerWidth;
    let dynamicMaxLength = maxLength;

    if (viewportWidth < 1200) {
        dynamicMaxLength = 60;
    } else if (viewportWidth < 1600) {
        dynamicMaxLength = 80;
    } else {
        dynamicMaxLength = 120;
    }

    if (title.length <= dynamicMaxLength) {
        return title;
    }

    const truncated = title.substring(0, dynamicMaxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > dynamicMaxLength * 0.8) {
        return truncated.substring(0, lastSpaceIndex) + '...';
    } else {
        return truncated + '...';
    }
}

// Deep property accessor
export function get(path, obj) {
    return path.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, obj);
}

// Debounce utility
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get cell value for sorting/filtering
export function getCellValue(cell, dataType) {
    if (!cell) return null;

    const text = cell.textContent.trim();

    if (text === 'N/A' || text === '...' || text === '') return null;

    switch (dataType) {
        case 'number':
        case 'bsr':
            const numMatch = text.replace(/,/g, '').match(/[\d.]+/);
            return numMatch ? parseFloat(numMatch[0]) : null;

        case 'royalty':
            const royaltyMatch = text.replace(/[$,]/g, '').match(/[\d.]+/);
            return royaltyMatch ? parseFloat(royaltyMatch[0]) : null;

        case 'text':
            return text.toLowerCase();

        default:
            return text;
    }
}
