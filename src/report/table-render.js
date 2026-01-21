/**
 * Table Rendering Module
 * Initial table rendering functionality
 */

import { getCurrentDomain } from './state.js';
import { getCurrencySymbol, getTypeTooltip, getTruncatedTitle } from './utils.js';
import { addSortingFunctionality } from './sorting.js';
import { addCheckboxFunctionality } from './selection.js';
import { addImageHoverEvents } from './image-hover.js';

export function renderInitialTable(serpData, asinsToProcess, container, currentDomain) {
    console.log("report.js: Rendering initial table.");
    const { productInfo, positions } = serpData;
    const currencySymbol = getCurrencySymbol(currentDomain);

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th><input type="checkbox" id="select-all-checkbox"></th>
                    <th class="sortable" data-column="1" data-type="text">Type</th>
                    <th class="sortable" data-column="2" data-type="text">ASIN</th>
                    <th>Cover</th>
                    <th>Title & Author</th>
                    <th class="sortable" data-column="5" data-type="number">Price</th>
                    <th class="sortable" data-column="6" data-type="number">Reviews</th>
                    <th class="sortable" data-column="7" data-type="number">Avg Rating</th>
                    <th class="sortable" data-column="8" data-type="number">Review Images</th>
                    <th class="sortable" data-column="9" data-type="number">Formats</th>
                    <th class="sortable" data-column="10" data-type="bsr">BSR</th>
                    <th class="sortable" data-column="11" data-type="number">Days on Market</th>
                    <th class="sortable" data-column="12" data-type="number">Length</th>
                    <th class="sortable" data-column="13" data-type="text">Large Trim</th>
                    <th class="sortable" data-column="14" data-type="number">A+ Modules</th>
                    <th class="sortable" data-column="15" data-type="number">UGC Videos</th>
                    <th class="sortable" data-column="16" data-type="text">Editorial Reviews</th>
                    <th class="sortable" data-column="17" data-type="number">Royalty/Book</th>
                    <th class="sortable" data-column="18" data-type="royalty">Royalty/Month</th>
                    <th class="sortable" data-column="19" data-type="text">Publisher</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const asin of asinsToProcess) {
        const product = productInfo[asin] || {};
        const placements = positions[asin] || [];

        const earliestPosition = placements.length > 0 ? Math.min(...placements.map(p => p.position)) : 'N/A';
        const uniqueTypes = placements.length > 0 ? [...new Set(placements.map(p => p.type))] : [];

        let typesHTML = '';
        if (uniqueTypes.length > 0) {
            typesHTML = uniqueTypes.map(type => {
                const className = type === 'organic' ? 'type-organic' :
                    type === 'sponsored' ? 'type-sponsored' : 'type-mixed';
                const tooltip = getTypeTooltip(type);
                return `<span class="type-bubble ${className}" title="${tooltip}">${type}</span>`;
            }).join('');
        } else {
            typesHTML = 'N/A';
        }

        let badgeHTML = '';
        if (product.badge_status) {
            const badgeClass = `badge-${product.badge_status}`;
            const badgeText = product.badge_status === 'bestseller' ? 'BS' :
                product.badge_status === 'new-release' ? 'NR' :
                    product.badge_status === 'amazon-charts' ? 'AC' : '';
            if (badgeText) {
                badgeHTML = `<span class="badge-bubble ${badgeClass}" title="${product.badge_status.replace('-', ' ')}">${badgeText}</span>`;
            }
        }

        const originalTitle = product.title || 'N/A';
        const truncatedTitle = getTruncatedTitle(originalTitle);
        const titleWithBadge = badgeHTML + truncatedTitle;

        tableHTML += `
            <tr data-asin="${asin}">
                <td><input type="checkbox" class="row-checkbox" data-asin="${asin}"></td>
                <td>${typesHTML}</td>
                <td class="asin-cell"><a href="https://${currentDomain}/dp/${asin}" target="_blank">${asin}</a></td>
                <td><img src="${product.coverUrl || ''}" class="cover-image"/></td>
                <td class="title-author-cell">
                    <div class="title" id="title-${asin}" title="${originalTitle}" data-full-title="${originalTitle}">${titleWithBadge}</div>
                    <div class="author">${(product.authors && product.authors.length > 0) ? product.authors.join(', ') : 'N/A'}</div>
                </td>
                <td id="price-${asin}" class="placeholder">...</td>
                <td id="reviews-${asin}">${(product.reviewCount || 0).toLocaleString()}</td>
                <td id="rating-${asin}" class="placeholder">...</td>
                <td id="review-images-${asin}" class="placeholder">...</td>
                <td id="formats-${asin}" class="placeholder">...</td>
                <td id="bsr-${asin}" class="placeholder">...</td>
                <td id="days-${asin}" class="placeholder">...</td>
                <td id="length-${asin}" class="placeholder">...</td>
                <td id="trim-${asin}" class="placeholder">...</td>
                <td id="aplus-${asin}" class="placeholder">...</td>
                <td id="ugc-videos-${asin}" class="placeholder">...</td>
                <td id="editorial-reviews-${asin}" class="placeholder">...</td>
                <td id="royalty-unit-${asin}" class="placeholder">...</td>
                <td id="royalty-month-${asin}" class="placeholder">...</td>
                <td id="publisher-${asin}" class="placeholder">...</td>
            </tr>
        `;
    }

    tableHTML += `
            </tbody>
            <tfoot>
                <tr id="totals-row" style="font-weight: bold;">
                    <td colspan="5">Totals / Averages</td>
                    <td id="avg-price">${currencySymbol}0.00</td>
                    <td id="total-reviews">0</td>
                    <td id="avg-rating">0.00</td>
                    <td id="total-review-images">0</td>
                    <td id="avg-formats">0.0</td>
                    <td id="avg-bsr">N/A</td>
                    <td id="avg-days">N/A</td>
                    <td id="avg-length">0</td>
                    <td id="pct-large-trim">0.00%</td>
                    <td id="avg-aplus">0.0</td>
                    <td id="avg-ugc-videos">0.0</td>
                    <td id="pct-editorial-reviews">0.00%</td>
                    <td id="avg-royalty-unit">${currencySymbol}0.00</td>
                    <td id="total-royalty-month">${currencySymbol}0</td>
                    <td></td>
                </tr>
                <tr id="high-royalty-totals-row" style="font-weight: bold; background-color: #e8f5e8;">
                    <td colspan="5">High Royalty (>=${currencySymbol}500/month) -  <span id="high-royalty-count">0</span></td>
                    <td id="high-avg-price">${currencySymbol}0.00</td>
                    <td id="high-total-reviews">0</td>
                    <td id="high-avg-rating">0.00</td>
                    <td id="high-total-review-images">0</td>
                    <td id="high-avg-formats">0.0</td>
                    <td id="high-avg-bsr">N/A</td>
                    <td id="high-avg-days">N/A</td>
                    <td id="high-avg-length">0</td>
                    <td id="high-pct-large-trim">0.00%</td>
                    <td id="high-avg-aplus">0.0</td>
                    <td id="high-avg-ugc-videos">0.0</td>
                    <td id="high-pct-editorial-reviews">0.00%</td>
                    <td id="high-avg-royalty-unit">${currencySymbol}0.00</td>
                    <td id="high-total-royalty-month">${currencySymbol}0</td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
    `;
    container.innerHTML = tableHTML;
    console.log("report.js: Initial table rendered.");

    setTimeout(() => addImageHoverEvents(), 100);
    addSortingFunctionality();
    addCheckboxFunctionality();
}

// Re-truncate titles on window resize
export function setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            document.querySelectorAll('.title[data-full-title]').forEach(titleElement => {
                const fullTitle = titleElement.getAttribute('data-full-title');
                const badgeHTML = titleElement.querySelector('.badge-bubble')?.outerHTML || '';
                const truncatedTitle = getTruncatedTitle(fullTitle);
                titleElement.innerHTML = badgeHTML + truncatedTitle;
                titleElement.setAttribute('title', fullTitle);
            });
        }, 250);
    });
}
