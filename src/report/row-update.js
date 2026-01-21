/**
 * Row Update Module
 * Updates table rows with product data
 */

import { getCurrentDomain } from './state.js';
import { getCurrencySymbol, get } from './utils.js';

export function updateTableRow(asin, data) {
    console.log(`report.js: Updating table row for ASIN ${asin} with data:`, data);
    if (!data) {
        console.warn(`report.js: No data provided for ASIN ${asin}. Highlighting row as failed.`);
        document.querySelector(`tr[data-asin="${asin}"]`).style.backgroundColor = '#f8d7da';
        return;
    }

    const updateCell = (id, value, format) => {
        const cell = document.getElementById(id);
        const isBSRCell = id.includes('bsr-');
        if (cell) {
            let displayValue = 'N/A';
            if (value !== null && value !== undefined) {
                displayValue = format ? format(value) : value;
            }
            cell.textContent = displayValue;
            cell.classList.remove('placeholder');
        }
    };

    const badgeStatus = get(['badge_status'], data);
    const formatCount = get(['formats'], data)?.length;
    const avgRating = get(['customer_reviews', 'average_rating'], data);
    const reviewImageCount = get(['customer_reviews', 'review_image_count'], data);
    const reviewCount = get(['customer_reviews', 'review_count'], data);
    const bsr = get(['product_details', 'bsr'], data);
    const daysOnMarket = get(['product_details', 'days_on_market'], data);
    const pageCount = get(['product_details', 'print_length'], data);
    const publisher = get(['product_details', 'publisher'], data);
    const largeTrim = get(['product_details', 'large_trim'], data);
    const aplusCount = get(['aplus_content', 'modulesCount'], data);
    const ugcVideoCount = get(['ugc_videos', 'video_count'], data);
    const editorialReviews = get(['editorial_reviews'], data);
    const royaltyUnit = get(['royalties', 'royalty_per_unit'], data);
    const royaltyMonth = get(['royalties', 'monthly_royalty'], data);
    const authors = get(['authors'], data);

    // Update title with badge if badge status changed
    if (badgeStatus) {
        const badgeClass = `badge-${badgeStatus}`;
        const badgeAcronym = badgeStatus === 'bestseller' ? 'BS' :
            badgeStatus === 'new-release' ? 'NR' :
                badgeStatus === 'amazon-charts' ? 'AC' : '';
        const titleElement = document.getElementById(`title-${asin}`);
        if (titleElement && badgeAcronym) {
            const currentTitle = titleElement.textContent;
            const cleanTitle = currentTitle.replace(/^(\(.*?\)\s*)?/, '');
            const badgeHTML = `<span class="badge-bubble ${badgeClass}" title="${badgeStatus.replace('-', ' ')}">${badgeAcronym}</span>`;
            titleElement.innerHTML = badgeHTML + cleanTitle;
        }
    }

    updateCell(`formats-${asin}`, formatCount, val => val || 0);
    updateCell(`rating-${asin}`, avgRating, val => val || 0);
    updateCell(`review-images-${asin}`, reviewImageCount, val => val || 0);
    if (reviewCount !== null && reviewCount !== undefined) {
        updateCell(`reviews-${asin}`, reviewCount, val => val.toLocaleString());
    }
    updateCell(`bsr-${asin}`, bsr, val => val ? val.toLocaleString() : 'N/A');
    updateCell(`days-${asin}`, daysOnMarket, val => val !== null ? val.toLocaleString() : 'N/A');
    updateCell(`length-${asin}`, pageCount, val => val ? val.toLocaleString() : 'N/A');
    updateCell(`publisher-${asin}`, publisher, val => val || 'Independently published');
    updateCell(`trim-${asin}`, largeTrim, val => val ? 'Yes' : 'No');
    updateCell(`aplus-${asin}`, aplusCount, val => val || 0);
    updateCell(`ugc-videos-${asin}`, ugcVideoCount, val => val || 0);
    updateCell(`author-${asin}`, authors, val => val && val.length > 0 ? val.join(', ') : 'N/A');

    // Handle editorial reviews
    const editorialReviewsCell = document.getElementById(`editorial-reviews-${asin}`);
    if (editorialReviewsCell) {
        const hasEditorialReviews = editorialReviews && Object.keys(editorialReviews).length > 0;
        editorialReviewsCell.textContent = hasEditorialReviews ? 'Yes' : 'No';
        editorialReviewsCell.classList.remove('placeholder');
    }

    // Update price cell
    const formats = get(['formats'], data);
    let priceDisplay = 'N/A';
    if (formats && formats.length > 0) {
        const selectedFormat = formats.find(f => f.isSelected) || formats[0];
        if (selectedFormat && selectedFormat.prices && selectedFormat.prices.length > 0) {
            const prices = selectedFormat.prices.sort((a, b) => a.price - b.price);
            const listPrice = prices.find(p => p.type === 'list_price')?.price || prices[prices.length - 1].price;
            const lowestPrice = prices[0].price;

            const currencySymbol = getCurrencySymbol(getCurrentDomain());
            if (listPrice && lowestPrice && lowestPrice < listPrice) {
                const discount = Math.round(((listPrice - lowestPrice) / listPrice) * 100);
                priceDisplay = `${currencySymbol}${listPrice.toFixed(2)}<br><span class="discount-price">${currencySymbol}${lowestPrice.toFixed(2)}(-${discount}%)</span>`;
            } else if (listPrice) {
                priceDisplay = `${currencySymbol}${listPrice.toFixed(2)}`;
            }
        }
    }
    const priceCell = document.getElementById(`price-${asin}`);
    if (priceCell) {
        priceCell.innerHTML = priceDisplay;
        priceCell.classList.remove('placeholder');
    }

    // Update royalty cells
    const royaltyUnitCell = document.getElementById(`royalty-unit-${asin}`);
    if (royaltyUnitCell) {
        const isEstimate = data.royalties && data.royalties.is_estimate;
        const estimateTooltip = isEstimate ?
            'Estimated. Book exceeds KDP page limits. Royalty based on ~10% traditional publishing rate.' : '';

        if (data.royalties && data.royalties.error && (royaltyUnit === null || royaltyUnit === undefined)) {
            royaltyUnitCell.textContent = 'N/A';
        } else if (royaltyUnit !== null) {
            const currencySymbol = getCurrencySymbol(getCurrentDomain());
            if (isEstimate) {
                royaltyUnitCell.innerHTML = `<span class="royalty-estimated" title="${estimateTooltip}">${currencySymbol}${royaltyUnit.toFixed(2)}</span>`;
                royaltyUnitCell.classList.add('has-estimate');
            } else {
                royaltyUnitCell.textContent = `${currencySymbol}${royaltyUnit.toFixed(2)}`;
                royaltyUnitCell.classList.remove('has-estimate');
            }
        } else {
            royaltyUnitCell.textContent = 'N/A';
        }
        royaltyUnitCell.classList.remove('placeholder');
    }

    const royaltyMonthCell = document.getElementById(`royalty-month-${asin}`);
    if (royaltyMonthCell) {
        const isEstimate = data.royalties && data.royalties.is_estimate;
        const estimateTooltip = isEstimate ?
            'Estimated. Book exceeds KDP page limits. Royalty based on ~10% traditional publishing rate.' : '';

        if (data.royalties && data.royalties.error && (royaltyMonth === null || royaltyMonth === undefined)) {
            royaltyMonthCell.textContent = 'N/A';
        } else if (royaltyMonth !== null) {
            const currencySymbol = getCurrencySymbol(getCurrentDomain());
            if (isEstimate) {
                royaltyMonthCell.innerHTML = `<span class="royalty-estimated" title="${estimateTooltip}">${currencySymbol}${Math.round(royaltyMonth).toLocaleString()}</span>`;
                royaltyMonthCell.classList.add('has-estimate');
            } else {
                royaltyMonthCell.textContent = `${currencySymbol}${Math.round(royaltyMonth).toLocaleString()}`;
                royaltyMonthCell.classList.remove('has-estimate');
            }
        } else {
            royaltyMonthCell.textContent = 'N/A';
        }
        royaltyMonthCell.classList.remove('placeholder');
    }

    console.log(`report.js: Row for ASIN ${asin} updated successfully.`);
}
