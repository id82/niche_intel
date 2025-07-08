// Global variables for data management
let allData = []; // To store data for all processed ASINs
let uniqueAsins = new Set(); // To track unique ASINs and avoid double counting
let processedCount = 0;
let totalToProcess = 0;
let searchKeyword = ''; // Global search keyword for filename generation

document.addEventListener('DOMContentLoaded', async () => {
    console.log("report.js: DOM fully loaded and parsed.");
    const tableContainer = document.getElementById('table-container');
    const progressText = document.getElementById('progress-text');
    
    // Create positioned hover modal for images
    createImageHoverModal();

    console.log("report.js: Loading initial data from local storage.");
    const { serpData, asinsToProcess, currentDomain, searchKeyword: loadedKeyword } = await chrome.storage.local.get(['serpData', 'asinsToProcess', 'currentDomain', 'searchKeyword']);

    if (!serpData || !asinsToProcess) {
        console.error("report.js: Could not load initial data from storage.");
        tableContainer.innerHTML = '<p>Error: Could not load initial data from storage. Please try again.</p>';
        progressText.textContent = 'Error: Could not load data. Please restart the analysis.';
        return;
    }
    
    console.log("report.js: Initial data loaded successfully.", { serpData, asinsToProcess });
    
    // Store search keyword globally and update header if available
    searchKeyword = loadedKeyword || '';
    if (searchKeyword) {
        const headerTitle = document.querySelector('.header h1');
        if (headerTitle) {
            headerTitle.innerHTML = `NicheIntel Pro by <a href="https://adigy.ai" target="_blank" class="adigy-link">Adigy.AI</a> - Ads Automation for Publishers - "${searchKeyword}"`;
        }
        // Also update page title
        document.title = `NicheIntel Pro - ${searchKeyword}`;
    }
    
    // Initialize global variables
    processedCount = 0;
    totalToProcess = asinsToProcess.length;
    allData = []; // Reset global array
    uniqueAsins = new Set(); // Reset global set

    progressText.textContent = `Progress: ${processedCount} / ${totalToProcess} products analyzed.`;

    renderInitialTable(serpData, asinsToProcess, tableContainer, currentDomain);

    // Listen for messages from the background script
    console.log("report.js: Adding message listener for updates from background script.");
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("report.js: Received message from background script:", request);
        if (request.command === "update-row") {
            console.log(`report.js: Updating row for ASIN ${request.asin}. Raw data:`, request.data);
            console.log(`report.js: BSR debugging for ${request.asin}:`, {
                hasProductDetails: !!(request.data && request.data.product_details),
                bsrFromProductDetails: request.data?.product_details?.bsr,
                fullProductDetails: request.data?.product_details,
                rawDataKeys: request.data ? Object.keys(request.data) : 'no data'
            });
            const rowData = { ...request.data, asin: request.asin };
            // Also add the initial product info from SERP data to have all data in one place
            const initialProductInfo = serpData.productInfo[request.asin] || {};
            const combinedData = { ...initialProductInfo, ...rowData };
            console.log(`report.js: Combined data for ASIN ${request.asin}:`, combinedData);
            console.log(`report.js: Combined BSR debugging for ${request.asin}:`, {
                bsrFromCombined: combinedData?.product_details?.bsr,
                fullCombinedProductDetails: combinedData?.product_details
            });
            
            // Update author info if the individual page has better data
            if (rowData.author_info && rowData.author_info.name) {
                combinedData.authors = [rowData.author_info.name];
            }
            
            updateTableRow(request.asin, combinedData);
            
            // Only add to allData if this ASIN hasn't been processed yet (avoid double counting)
            if (!uniqueAsins.has(request.asin)) {
                allData.push(combinedData); // Add data to the array
                uniqueAsins.add(request.asin);
            } else {
                // Update existing data for this ASIN
                const existingIndex = allData.findIndex(item => item.asin === request.asin);
                if (existingIndex !== -1) {
                    allData[existingIndex] = combinedData;
                }
            }
            
            // Update the author display in the table if we have better data
            if (combinedData.authors && combinedData.authors.length > 0) {
                const authorDiv = document.querySelector(`tr[data-asin="${request.asin}"] .author`);
                if (authorDiv) {
                    authorDiv.textContent = combinedData.authors.join(', ');
                }
            }
            
            // Update checkbox functionality for new rows
            const checkbox = document.querySelector(`input[data-asin="${request.asin}"]`);
            if (checkbox && !checkbox.hasAttribute('data-listener-added')) {
                checkbox.addEventListener('change', function() {
                    updateSelectAllState();
                    updateTotalsCalculations();
                });
                checkbox.setAttribute('data-listener-added', 'true');
            }
            processedCount++;
            progressText.textContent = `Progress: ${processedCount} / ${totalToProcess} products analyzed.`;
    
    // Update progress bar if we have one
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        const percentage = Math.round((processedCount / totalToProcess) * 100);
        progressBar.style.width = percentage + '%';
        progressBar.textContent = percentage + '%';
    }
    
    // Reinitialize scroll sync if the filter is active and table dimensions changed
    const filterToggle = document.getElementById('filterToggle');
    if (filterToggle && filterToggle.checked && scrollSyncInitialized) {
        setTimeout(() => {
            setupScrollSynchronization();
        }, 50);
    }
        } else if (request.command === "analysis-complete") {
            console.log("report.js: Received analysis complete message.");
            const message = request.stopped ? 
                `Analysis Stopped! ${processedCount} of ${totalToProcess} products were processed.` :
                `Analysis Complete! All ${totalToProcess} products have been processed.`;
            progressText.textContent = message;
            // Keep original background color - no color change needed
            
            // Collapse progress container after 3 seconds
            setTimeout(() => {
                const progressContainer = document.getElementById('progress-container');
                progressContainer.style.transition = 'all 0.5s ease-out';
                progressContainer.style.maxHeight = '0px';
                progressContainer.style.padding = '0';
                progressContainer.style.margin = '0';
                progressContainer.style.overflow = 'hidden';
            }, 3000);
            
            console.log("report.js: Analysis complete, calculating totals for", allData.length, "products");
            calculateAndDisplayTotals(allData); // Calculate and display totals
            console.log("report.js: Regular totals calculated, now calculating high royalty totals");
            calculateAndDisplayHighRoyaltyTotals(allData); // Calculate and display high royalty totals
            console.log("report.js: All totals calculation complete");
            
            // Show export button
            document.getElementById('exportData').style.display = 'inline-block';
            
            // Clean up - clear stored data to prevent memory leaks
            chrome.storage.local.remove(['serpData', 'asinsToProcess', 'currentDomain', 'searchKeyword'])
                .then(() => console.log("report.js: Cleaned up storage after analysis completion"))
                .catch(err => console.warn("report.js: Failed to clean up storage:", err));
        }
    });
});

function getTypeTooltip(type) {
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

function getTruncatedTitle(title, maxLength = 60) {
    if (!title || title === 'N/A') return title;
    
    // Calculate dynamic max length based on viewport width
    const viewportWidth = window.innerWidth;
    let dynamicMaxLength = maxLength;
    
    // Adjust max length based on viewport width
    if (viewportWidth < 1200) {
        dynamicMaxLength = 60;  // Narrow viewport
    } else if (viewportWidth < 1600) {
        dynamicMaxLength = 80;  // Medium viewport
    } else {
        dynamicMaxLength = 120; // Wide viewport
    }
    
    if (title.length <= dynamicMaxLength) {
        return title;
    }
    
    // Truncate at word boundary when possible
    const truncated = title.substring(0, dynamicMaxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > dynamicMaxLength * 0.8) {
        // If we can find a space in the last 20% of the truncated string, use it
        return truncated.substring(0, lastSpaceIndex) + '...';
    } else {
        // Otherwise just truncate at character limit
        return truncated + '...';
    }
}

function renderInitialTable(serpData, asinsToProcess, container, currentDomain) {
    console.log("report.js: Rendering initial table.");
    const { productInfo, positions } = serpData;
    
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
        
        // Get the earliest position and collect all placement types
        const earliestPosition = placements.length > 0 ? Math.min(...placements.map(p => p.position)) : 'N/A';
        const uniqueTypes = placements.length > 0 ? [...new Set(placements.map(p => p.type))] : [];
        
        // Format types as bubbles with tooltips
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

        // Get badge value for display with styling
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
                <td>${(product.reviewCount || 0).toLocaleString()}</td>
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
                    <td id="avg-price">$0.00</td>
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
                    <td id="avg-royalty-unit">$0.00</td>
                    <td id="total-royalty-month">$0</td>
                    <td></td> <!-- Publisher -->
                </tr>
                <tr id="high-royalty-totals-row" style="font-weight: bold; background-color: #e8f5e8;">
                    <td colspan="5">High Royalty (≥$500/month) -  <span id="high-royalty-count">0</span></td>
                    <td id="high-avg-price">$0.00</td>
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
                    <td id="high-avg-royalty-unit">$0.00</td>
                    <td id="high-total-royalty-month">$0</td>
                    <td></td> <!-- Publisher -->
                </tr>
            </tfoot>
        </table>
    `;
    container.innerHTML = tableHTML;
    console.log("report.js: Initial table rendered.");
    
    // Add image hover events after table is rendered
    setTimeout(() => addImageHoverEvents(), 100);
    
    // Add sorting functionality
    addSortingFunctionality();
    
    // Add checkbox functionality
    addCheckboxFunctionality();
    
}

function addSortingFunctionality() {
    const sortableHeaders = document.querySelectorAll('th.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const column = parseInt(header.dataset.column);
            const type = header.dataset.type;
            const currentSort = header.classList.contains('sort-asc') ? 'asc' : 
                               header.classList.contains('sort-desc') ? 'desc' : 'none';
            
            // Clear all other sort indicators
            sortableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            
            // Determine new sort direction
            let newSort = 'asc';
            if (currentSort === 'asc') {
                newSort = 'desc';
            }
            
            // Special handling for specific columns where "good" values should be first
            if (type === 'bsr' && currentSort === 'none') {
                newSort = 'asc'; // Low BSR is good, so ascending first
            } else if (type === 'royalty' && currentSort === 'none') {
                newSort = 'desc'; // High royalty is good, so descending first
            }
            
            // Apply sort indicator
            header.classList.add(`sort-${newSort}`);
            
            // Sort the table
            sortTable(column, type, newSort);
        });
    });
}

function sortTable(columnIndex, dataType, direction) {
    const table = document.querySelector('table tbody');
    const rows = Array.from(table.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        const aCell = a.children[columnIndex];
        const bCell = b.children[columnIndex];
        
        let aValue = getCellValue(aCell, dataType);
        let bValue = getCellValue(bCell, dataType);
        
        // Handle special cases
        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        let comparison = 0;
        if (dataType === 'number' || dataType === 'bsr' || dataType === 'royalty') {
            comparison = parseFloat(aValue) - parseFloat(bValue);
        } else {
            comparison = aValue.toString().localeCompare(bValue.toString(), undefined, { numeric: true });
        }
        
        return direction === 'asc' ? comparison : -comparison;
    });
    
    // Re-append sorted rows
    rows.forEach(row => table.appendChild(row));
}

function getCellValue(cell, dataType) {
    if (!cell) return null;
    
    const text = cell.textContent.trim();
    
    if (text === 'N/A' || text === '...' || text === '') return null;
    
    switch (dataType) {
        case 'number':
        case 'bsr':
            // Remove commas and extract first number
            const numMatch = text.replace(/,/g, '').match(/[\d.]+/);
            return numMatch ? parseFloat(numMatch[0]) : null;
            
        case 'royalty':
            // Extract number from currency format like $1,234
            const royaltyMatch = text.replace(/[$,]/g, '').match(/[\d.]+/);
            return royaltyMatch ? parseFloat(royaltyMatch[0]) : null;
            
        case 'text':
            return text.toLowerCase();
            
        default:
            return text;
    }
}

function addCheckboxFunctionality() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    
    // Handle select all checkbox
    selectAllCheckbox.addEventListener('change', function() {
        const isChecked = this.checked;
        rowCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        updateTotalsCalculations();
    });
    
    // Handle individual row checkboxes
    rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectAllState();
            updateTotalsCalculations();
        });
    });
    
    // Initial calculation with all rows selected
    updateTotalsCalculations();
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedBoxes.length === rowCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
    }
}

function clearTotalsRows() {
    // Clear main totals row
    document.getElementById('avg-price').textContent = '$0.00';
    document.getElementById('total-reviews').textContent = '0';
    document.getElementById('avg-rating').textContent = '0.00';
    document.getElementById('total-review-images').textContent = '0';
    document.getElementById('avg-formats').textContent = '0.0';
    document.getElementById('avg-bsr').textContent = 'N/A';
    document.getElementById('avg-days').textContent = 'N/A';
    document.getElementById('avg-length').textContent = '0';
    document.getElementById('pct-large-trim').textContent = '0%';
    document.getElementById('avg-aplus').textContent = '0.0';
    document.getElementById('avg-ugc-videos').textContent = '0.0';
    document.getElementById('pct-editorial-reviews').textContent = '0%';
    document.getElementById('avg-royalty-unit').textContent = '$0.00';
    document.getElementById('total-royalty-month').textContent = '$0';
    
    // Clear high royalty totals row
    document.getElementById('high-royalty-count').textContent = '0';
    document.getElementById('high-avg-price').textContent = '$0.00';
    document.getElementById('high-total-reviews').textContent = '0';
    document.getElementById('high-avg-rating').textContent = '0.00';
    document.getElementById('high-total-review-images').textContent = '0';
    document.getElementById('high-avg-formats').textContent = '0.0';
    document.getElementById('high-avg-bsr').textContent = 'N/A';
    document.getElementById('high-avg-days').textContent = 'N/A';
    document.getElementById('high-avg-length').textContent = '0';
    document.getElementById('high-pct-large-trim').textContent = '0%';
    document.getElementById('high-avg-aplus').textContent = '0.0';
    document.getElementById('high-avg-ugc-videos').textContent = '0.0';
    document.getElementById('high-pct-editorial-reviews').textContent = '0%';
    document.getElementById('high-avg-royalty-unit').textContent = '$0.00';
    document.getElementById('high-total-royalty-month').textContent = '$0';
}

function updateTotalsCalculations() {
    // Safety check: ensure allData exists and is an array
    if (!allData || !Array.isArray(allData)) {
        console.warn("report.js: allData is not available yet, clearing totals");
        clearTotalsRows();
        return;
    }
    
    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
    const selectedAsins = Array.from(checkedBoxes).map(cb => cb.dataset.asin);
    
    // Filter allData to only include selected rows
    const selectedData = allData.filter(item => selectedAsins.includes(item.asin));
    
    if (selectedData.length === 0) {
        // If no rows are selected, clear all totals using the helper function.
        clearTotalsRows();
        return;
    }
    
    // Calculate and display totals for the selected data.
    calculateAndDisplayTotals(selectedData);
    calculateAndDisplayHighRoyaltyTotals(selectedData);
}

function updateTableRow(asin, data) {
    console.log(`report.js: Updating table row for ASIN ${asin} with data:`, data);
    if (!data) {
        console.warn(`report.js: No data provided for ASIN ${asin}. Highlighting row as failed.`);
        document.querySelector(`tr[data-asin="${asin}"]`).style.backgroundColor = '#f8d7da'; // Highlight failed rows
        return;
    }
    
    const get = (p, o) => p.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, o);

    const updateCell = (id, value, format) => {
        const cell = document.getElementById(id);
        const isBSRCell = id.includes('bsr-');
        if (isBSRCell) {
            console.log(`report.js: BSR updateCell - ID: ${id}, Value:`, value, 'Type:', typeof value, 'Found cell:', !!cell);
        } else {
            console.log(`report.js: Updating cell ${id} for ASIN ${asin}. Found cell:`, !!cell, 'Value:', value);
        }
        if (cell) {
            let displayValue = 'N/A';
            if (value !== null && value !== undefined) {
                displayValue = format ? format(value) : value;
            }
            if (isBSRCell) {
                console.log(`report.js: BSR updateCell - Final display value:`, displayValue);
            } else {
                console.log(`report.js: Setting ${id} to "${displayValue}"`);
            }
            cell.textContent = displayValue;
            cell.classList.remove('placeholder');
        } else {
            console.warn(`report.js: Cell with ID "${id}" not found for ASIN ${asin}`);
        }
    };

    const badgeStatus = get(['badge_status'], data);
    const formatCount = get(['formats'], data)?.length;
    const avgRating = get(['customer_reviews', 'average_rating'], data);
    const reviewImageCount = get(['customer_reviews', 'review_image_count'], data);
    const bsr = get(['product_details', 'bsr'], data);
    console.log(`report.js: BSR extraction for ${asin}:`, {
        bsrValue: bsr,
        hasProductDetails: !!(data && data.product_details),
        productDetailsKeys: data?.product_details ? Object.keys(data.product_details) : 'no product_details',
        fullProductDetails: data?.product_details
    });
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
            // Remove existing badge if present
            const cleanTitle = currentTitle.replace(/^(\(.*?\)\s*)?/, '');
            // Add new styled badge
            const badgeHTML = `<span class="badge-bubble ${badgeClass}" title="${badgeStatus.replace('-', ' ')}">${badgeAcronym}</span>`;
            titleElement.innerHTML = badgeHTML + cleanTitle;
        }
    }

    // Badge is now handled in title display
    updateCell(`formats-${asin}`, formatCount, val => val || 0);
    updateCell(`rating-${asin}`, avgRating, val => val || 0);
    updateCell(`review-images-${asin}`, reviewImageCount, val => val || 0);
    console.log(`report.js: About to update BSR cell for ${asin}. BSR value:`, bsr, 'Type:', typeof bsr);
    updateCell(`bsr-${asin}`, bsr, val => val ? val.toLocaleString() : 'N/A');
    updateCell(`days-${asin}`, daysOnMarket, val => val !== null ? val.toLocaleString() : 'N/A');
    updateCell(`length-${asin}`, pageCount, val => val ? val.toLocaleString() : 'N/A');
    updateCell(`publisher-${asin}`, publisher);
    updateCell(`trim-${asin}`, largeTrim, val => val ? 'Yes' : 'No');
    updateCell(`aplus-${asin}`, aplusCount, val => val || 0);
    updateCell(`ugc-videos-${asin}`, ugcVideoCount, val => val || 0);
    updateCell(`author-${asin}`, authors, val => val && val.length > 0 ? val.join(', ') : 'N/A');
    // Handle editorial reviews specially to ensure "No" instead of "N/A"
    const editorialReviewsCell = document.getElementById(`editorial-reviews-${asin}`);
    if (editorialReviewsCell) {
        const hasEditorialReviews = editorialReviews && Object.keys(editorialReviews).length > 0;
        editorialReviewsCell.textContent = hasEditorialReviews ? 'Yes' : 'No';
        editorialReviewsCell.classList.remove('placeholder');
    }
    
    // Update price cell with list price and discount handling
    const formats = get(['formats'], data);
    let priceDisplay = 'N/A';
    if (formats && formats.length > 0) {
        // Find the selected format or use the first one
        const selectedFormat = formats.find(f => f.isSelected) || formats[0];
        if (selectedFormat && selectedFormat.prices && selectedFormat.prices.length > 0) {
            const prices = selectedFormat.prices.sort((a, b) => a.price - b.price);
            const listPrice = prices.find(p => p.type === 'list_price')?.price || prices[prices.length - 1].price;
            const lowestPrice = prices[0].price;
            
            if (listPrice && lowestPrice && lowestPrice < listPrice) {
                const discount = Math.round(((listPrice - lowestPrice) / listPrice) * 100);
                priceDisplay = `$${listPrice.toFixed(2)}<br><span class="discount-price">$${lowestPrice.toFixed(2)}(-${discount}%)</span>`;
            } else if (listPrice) {
                priceDisplay = `$${listPrice.toFixed(2)}`;
            }
        }
    }
    const priceCell = document.getElementById(`price-${asin}`);
    if (priceCell) {
        priceCell.innerHTML = priceDisplay;
        priceCell.classList.remove('placeholder');
    }
    
    const royaltyUnitCell = document.getElementById(`royalty-unit-${asin}`);
    if (royaltyUnitCell) {
        // Show fallback calculation results even if there was an error in complex calculation
        if(data.royalties && data.royalties.error && (royaltyUnit === null || royaltyUnit === undefined)) {
            royaltyUnitCell.textContent = 'N/A';
        } else {
            royaltyUnitCell.textContent = royaltyUnit !== null ? `$${royaltyUnit.toFixed(2)}` : 'N/A';
        }
        royaltyUnitCell.classList.remove('placeholder');
    }

    const royaltyMonthCell = document.getElementById(`royalty-month-${asin}`);
    if (royaltyMonthCell) {
        // Show fallback calculation results even if there was an error in complex calculation
        if(data.royalties && data.royalties.error && (royaltyMonth === null || royaltyMonth === undefined)) {
            royaltyMonthCell.textContent = 'N/A';
        } else {
            royaltyMonthCell.textContent = royaltyMonth !== null ? `$${Math.round(royaltyMonth).toLocaleString()}` : 'N/A';
        }
        royaltyMonthCell.classList.remove('placeholder');
    }
    
    console.log(`report.js: Row for ASIN ${asin} updated successfully.`);
}

function calculateAndDisplayTotals(allData) {
    const get = (p, o) => p.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, o);

    const totals = {
        reviewsSum: 0,
        reviewsCount: 0,
        ratingSum: 0,
        ratingCount: 0,
        reviewImagesSum: 0,
        reviewImagesCount: 0,
        bsrSum: 0,
        bsrCount: 0,
        daysSum: 0,
        daysCount: 0,
        lengthSum: 0,
        lengthCount: 0,
        aplusSum: 0,
        aplusCount: 0,
        ugcVideos: 0,
        ugcCount: 0,
        royaltyUnitSum: 0,
        royaltyUnitCount: 0,
        royaltyMonthSum: 0,
        royaltyMonthCount: 0,
        formatSum: 0,
        formatCount: 0,
        priceSum: 0,
        priceCount: 0,
        largeTrimYesCount: 0,
        editorialReviewsYesCount: 0,
        totalProducts: 0,
    };

    for (const data of allData) {
        if (!data) continue;

        const reviewCount = get(['reviewCount'], data);
        const avgRating = get(['customer_reviews', 'average_rating'], data);
        const reviewImages = get(['customer_reviews', 'review_image_count'], data);
        const bsr = get(['product_details', 'bsr'], data);
        const days = get(['product_details', 'days_on_market'], data);
        const pageCount = get(['product_details', 'print_length'], data);
        const aplus = get(['aplus_content', 'modulesCount'], data);
        const ugc = get(['ugc_videos', 'video_count'], data);
        const royaltyUnit = get(['royalties', 'royalty_per_unit'], data);
        const royaltyMonth = get(['royalties', 'monthly_royalty'], data);
        const formatCount = get(['formats'], data)?.length || 0;
        const largeTrim = get(['product_details', 'large_trim'], data);
        const editorialReviews = get(['editorial_reviews'], data);
        
        // Extract price for averaging
        const formats = get(['formats'], data);
        let price = null;
        if (formats && formats.length > 0) {
            const selectedFormat = formats.find(f => f.isSelected) || formats[0];
            if (selectedFormat && selectedFormat.prices && selectedFormat.prices.length > 0) {
                const listPrice = selectedFormat.prices.find(p => p.type === 'list_price')?.price;
                price = listPrice || selectedFormat.prices[0].price;
            }
        }

        if (reviewCount !== null && reviewCount !== undefined) {
            totals.reviewsSum += reviewCount;
            totals.reviewsCount++;
        }
        if (avgRating) {
            totals.ratingSum += avgRating;
            totals.ratingCount++;
        }
        if (reviewImages !== null && reviewImages !== undefined) {
            totals.reviewImagesSum += reviewImages;
            totals.reviewImagesCount++;
        }
        if (bsr) {
            totals.bsrSum += bsr;
            totals.bsrCount++;
        }
        if (days) {
            totals.daysSum += days;
            totals.daysCount++;
        }
        if (pageCount) {
            totals.lengthSum += pageCount;
            totals.lengthCount++;
        }
        if (aplus) {
            totals.aplusSum += aplus;
            totals.aplusCount++;
        }
        if (ugc !== null && ugc !== undefined) {
            totals.ugcVideos += ugc;
            totals.ugcCount++;
        }
        if (royaltyUnit) {
            totals.royaltyUnitSum += royaltyUnit;
            totals.royaltyUnitCount++;
        }
        if (royaltyMonth !== null && royaltyMonth !== undefined) {
            totals.royaltyMonthSum += royaltyMonth;
            totals.royaltyMonthCount++;
        }

        if (formatCount) {
            totals.formatSum += formatCount;
            totals.formatCount++;
        }
        if (price !== null && price !== undefined) {
            totals.priceSum += price;
            totals.priceCount++;
        }
        if (largeTrim) {
            totals.largeTrimYesCount++;
        }
        if (editorialReviews && Object.keys(editorialReviews).length > 0) {
            totals.editorialReviewsYesCount++;
        }
        totals.totalProducts++;
    }

    document.getElementById('avg-price').textContent = (totals.priceCount > 0 ? `$${(totals.priceSum / totals.priceCount).toFixed(2)}` : '$0.00');
    document.getElementById('total-reviews').textContent = (totals.reviewsCount > 0 ? Math.round(totals.reviewsSum / totals.reviewsCount).toLocaleString() : '0');
    document.getElementById('avg-rating').textContent = (totals.ratingCount > 0 ? (totals.ratingSum / totals.ratingCount).toFixed(2) : '0.00');
    document.getElementById('total-review-images').textContent = (totals.reviewImagesCount > 0 ? Math.round(totals.reviewImagesSum / totals.reviewImagesCount).toLocaleString() : '0');
    document.getElementById('avg-bsr').textContent = (totals.bsrCount > 0 ? Math.round(totals.bsrSum / totals.bsrCount).toLocaleString() : 'N/A');
    document.getElementById('avg-days').textContent = (totals.daysCount > 0 ? Math.round(totals.daysSum / totals.daysCount).toLocaleString() : 'N/A');
    document.getElementById('avg-length').textContent = (totals.lengthCount > 0 ? Math.round(totals.lengthSum / totals.lengthCount).toLocaleString() : 'N/A');
    document.getElementById('avg-aplus').textContent = (totals.aplusCount > 0 ? (totals.aplusSum / totals.aplusCount).toFixed(1) : '0.0');
    document.getElementById('avg-ugc-videos').textContent = (totals.ugcCount > 0 ? (totals.ugcVideos / totals.ugcCount).toFixed(1) : '0.0');
    document.getElementById('avg-royalty-unit').textContent = (totals.royaltyUnitCount > 0 ? `$${(totals.royaltyUnitSum / totals.royaltyUnitCount).toFixed(2)}` : '$0.00');
    document.getElementById('total-royalty-month').textContent = (totals.royaltyMonthCount > 0 ? `$${Math.round(totals.royaltyMonthSum / totals.royaltyMonthCount).toLocaleString()}` : '$0');

    // New calculations
    const avgFormats = totals.formatCount > 0 ? (totals.formatSum / totals.formatCount).toFixed(1) : '0.0';
    document.getElementById('avg-formats').textContent = avgFormats;

    const pctLargeTrim = totals.totalProducts > 0 ? Math.round((totals.largeTrimYesCount / totals.totalProducts) * 100) + '%' : '0%';
    document.getElementById('pct-large-trim').textContent = pctLargeTrim;

    const pctEditorialReviews = totals.totalProducts > 0 ? Math.round((totals.editorialReviewsYesCount / totals.totalProducts) * 100) + '%' : '0%';
    document.getElementById('pct-editorial-reviews').textContent = pctEditorialReviews;
}

function calculateAndDisplayHighRoyaltyTotals(allData) {
    console.log("report.js: Starting calculateAndDisplayHighRoyaltyTotals with data:", allData.length, "products");
    const get = (p, o) => p.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, o);
    
    // Debug: Log data structure for first few items
    allData.slice(0, 3).forEach((data, index) => {
        console.log(`report.js: Sample data ${index}:`, {
            hasData: !!data,
            hasRoyalties: !!(data && data.royalties),
            royaltiesError: data?.royalties?.error,
            monthlyRoyalty: get(['royalties', 'monthly_royalty'], data),
            royaltyPerUnit: get(['royalties', 'royalty_per_unit'], data),
            fullRoyaltiesObject: data?.royalties
        });
    });
    
    // Filter for books with monthly royalty >= $500
    const highRoyaltyBooks = allData.filter(data => {
        if (!data || !data.royalties) {
            return false;
        }
        
        // Check if we have valid royalty data, even if there was an error in complex calculation
        const royaltyMonth = get(['royalties', 'monthly_royalty'], data);
        
        // Only exclude if there's an error AND no valid monthly royalty
        if (data.royalties.error && (royaltyMonth === null || royaltyMonth === undefined)) {
            return false;
        }
        
        const isHighRoyalty = royaltyMonth !== null && royaltyMonth !== undefined && royaltyMonth >= 500;
        if (isHighRoyalty) {
            console.log(`report.js: Found high royalty book with $${royaltyMonth}/month:`, data.asin || 'unknown', data.royalties.error ? '(from fallback calc)' : '(from full calc)');
        }
        return isHighRoyalty;
    });
    
    console.log(`report.js: Found ${highRoyaltyBooks.length} high royalty books (≥$500/month)`);
    
    const highTotals = {
        reviewsSum: 0,
        reviewsCount: 0,
        ratingSum: 0,
        ratingCount: 0,
        reviewImagesSum: 0,
        reviewImagesCount: 0,
        bsrSum: 0,
        bsrCount: 0,
        daysSum: 0,
        daysCount: 0,
        lengthSum: 0,
        lengthCount: 0,
        aplusSum: 0,
        aplusCount: 0,
        ugcVideos: 0,
        ugcCount: 0,
        royaltyUnitSum: 0,
        royaltyUnitCount: 0,
        royaltyMonthSum: 0,
        royaltyMonthCount: 0,
        formatSum: 0,
        formatCount: 0,
        priceSum: 0,
        priceCount: 0,
        largeTrimYesCount: 0,
        editorialReviewsYesCount: 0,
        totalProducts: 0,
    };
    
    for (const data of highRoyaltyBooks) {
        if (!data) continue;
        
        const reviewCount = get(['reviewCount'], data);
        const avgRating = get(['customer_reviews', 'average_rating'], data);
        const reviewImages = get(['customer_reviews', 'review_image_count'], data);
        const bsr = get(['product_details', 'bsr'], data);
        const days = get(['product_details', 'days_on_market'], data);
        const pageCount = get(['product_details', 'print_length'], data);
        const aplus = get(['aplus_content', 'modulesCount'], data);
        const ugc = get(['ugc_videos', 'video_count'], data);
        const royaltyUnit = get(['royalties', 'royalty_per_unit'], data);
        const royaltyMonth = get(['royalties', 'monthly_royalty'], data);
        const formatCount = get(['formats'], data)?.length || 0;
        const largeTrim = get(['product_details', 'large_trim'], data);
        const editorialReviews = get(['editorial_reviews'], data);
        
        // Extract price for high royalty averaging
        const formats = get(['formats'], data);
        let price = null;
        if (formats && formats.length > 0) {
            const currentFormat = formats.find(f => f.isSelected) || formats.find(f => f.formatName.toLowerCase() === 'paperback') || formats[0];
            if (currentFormat && currentFormat.prices && currentFormat.prices.length > 0) {
                const listPrice = currentFormat.prices.find(p => p.type === 'list_price')?.price;
                price = listPrice || Math.max(...currentFormat.prices.map(p => p.price));
            }
        }
        
        if (reviewCount !== null && reviewCount !== undefined) {
            highTotals.reviewsSum += reviewCount;
            highTotals.reviewsCount++;
        }
        if (avgRating) {
            highTotals.ratingSum += avgRating;
            highTotals.ratingCount++;
        }
        if (reviewImages !== null && reviewImages !== undefined) {
            highTotals.reviewImagesSum += reviewImages;
            highTotals.reviewImagesCount++;
        }
        if (bsr) {
            highTotals.bsrSum += bsr;
            highTotals.bsrCount++;
        }
        if (days) {
            highTotals.daysSum += days;
            highTotals.daysCount++;
        }
        if (pageCount) {
            highTotals.lengthSum += pageCount;
            highTotals.lengthCount++;
        }
        if (aplus) {
            highTotals.aplusSum += aplus;
            highTotals.aplusCount++;
        }
        if (ugc !== null && ugc !== undefined) {
            highTotals.ugcVideos += ugc;
            highTotals.ugcCount++;
        }
        if (royaltyUnit) {
            highTotals.royaltyUnitSum += royaltyUnit;
            highTotals.royaltyUnitCount++;
        }
        if (royaltyMonth !== null && royaltyMonth !== undefined) {
            highTotals.royaltyMonthSum += royaltyMonth;
            highTotals.royaltyMonthCount++;
        }
        
        if (formatCount) {
            highTotals.formatSum += formatCount;
            highTotals.formatCount++;
        }
        if (price !== null && price !== undefined) {
            highTotals.priceSum += price;
            highTotals.priceCount++;
        }
        if (largeTrim) {
            highTotals.largeTrimYesCount++;
        }
        if (editorialReviews && Object.keys(editorialReviews).length > 0) {
            highTotals.editorialReviewsYesCount++;
        }
        highTotals.totalProducts++;
    }
    
    // Count books published in the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const recentBooksCount = highRoyaltyBooks.filter(data => {
        const daysOnMarket = get(['product_details', 'days_on_market'], data);
        return daysOnMarket !== null && daysOnMarket !== undefined && daysOnMarket <= 90;
    }).length;
    
    // Update the high royalty count with recent books info and total count
    const totalBooks = allData.length;
    const countText = highTotals.totalProducts > 0
        ? `${highTotals.totalProducts}/${totalBooks} books (${recentBooksCount} with <90 days on market)`
        : `0/${totalBooks} books`;
    document.getElementById('high-royalty-count').textContent = countText;
    
    // Calculate final values
    const avgPrice = highTotals.priceCount > 0 ? `$${(highTotals.priceSum / highTotals.priceCount).toFixed(2)}` : '$0.00';
    const avgReviews = highTotals.reviewsCount > 0 ? Math.round(highTotals.reviewsSum / highTotals.reviewsCount).toLocaleString() : '0';
    const avgRating = highTotals.ratingCount > 0 ? (highTotals.ratingSum / highTotals.ratingCount).toFixed(2) : '0.00';
    const avgReviewImages = highTotals.reviewImagesCount > 0 ? Math.round(highTotals.reviewImagesSum / highTotals.reviewImagesCount).toLocaleString() : '0';
    const avgBsr = highTotals.bsrCount > 0 ? Math.round(highTotals.bsrSum / highTotals.bsrCount).toLocaleString() : 'N/A';
    const avgDays = highTotals.daysCount > 0 ? Math.round(highTotals.daysSum / highTotals.daysCount).toLocaleString() : 'N/A';
    const avgLength = highTotals.lengthCount > 0 ? Math.round(highTotals.lengthSum / highTotals.lengthCount).toLocaleString() : 'N/A';
    const avgAplus = highTotals.aplusCount > 0 ? (highTotals.aplusSum / highTotals.aplusCount).toFixed(1) : '0.0';
    const avgUgc = highTotals.ugcCount > 0 ? (highTotals.ugcVideos / highTotals.ugcCount).toFixed(1) : '0.0';
    const avgRoyaltyUnit = highTotals.royaltyUnitCount > 0 ? `$${(highTotals.royaltyUnitSum / highTotals.royaltyUnitCount).toFixed(2)}` : '$0.00';
    const avgRoyaltyMonth = highTotals.royaltyMonthCount > 0 ? `$${Math.round(highTotals.royaltyMonthSum / highTotals.royaltyMonthCount).toLocaleString()}` : '$0';

    console.log("report.js: High Royalty totals calculated:", {
        totalProducts: highTotals.totalProducts,
        avgPrice,
        avgReviews,
        avgRating,
        avgBsr,
        avgRoyaltyUnit,
        avgRoyaltyMonth,
        royaltyUnitCount: highTotals.royaltyUnitCount,
        royaltyMonthCount: highTotals.royaltyMonthCount
    });

    // Update all the high royalty totals
    document.getElementById('high-avg-price').textContent = avgPrice;
    document.getElementById('high-total-reviews').textContent = avgReviews;
    document.getElementById('high-avg-rating').textContent = avgRating;
    document.getElementById('high-total-review-images').textContent = avgReviewImages;
    document.getElementById('high-avg-bsr').textContent = avgBsr;
    document.getElementById('high-avg-days').textContent = avgDays;
    document.getElementById('high-avg-length').textContent = avgLength;
    document.getElementById('high-avg-aplus').textContent = avgAplus;
    document.getElementById('high-avg-ugc-videos').textContent = avgUgc;
    document.getElementById('high-avg-royalty-unit').textContent = avgRoyaltyUnit;
    document.getElementById('high-total-royalty-month').textContent = avgRoyaltyMonth;
    
    // Verify that all elements exist before updating
    const elements = [
        'high-royalty-count', 'high-avg-price', 'high-total-reviews', 'high-avg-rating',
        'high-total-review-images', 'high-avg-bsr', 'high-avg-days', 'high-avg-length',
        'high-avg-aplus', 'high-avg-ugc-videos', 'high-avg-royalty-unit', 'high-total-royalty-month'
    ];
    
    const missingElements = elements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.error("report.js: Missing High Royalty elements:", missingElements);
    } else {
        console.log("report.js: All High Royalty elements found and updated successfully");
    }
    
    // New calculations for high royalty books
    const highAvgFormats = highTotals.formatCount > 0 ? (highTotals.formatSum / highTotals.formatCount).toFixed(1) : '0.0';
    document.getElementById('high-avg-formats').textContent = highAvgFormats;
    
    const highPctLargeTrim = highTotals.totalProducts > 0 ? Math.round((highTotals.largeTrimYesCount / highTotals.totalProducts) * 100) + '%' : '0%';
    document.getElementById('high-pct-large-trim').textContent = highPctLargeTrim;
    
    const highPctEditorialReviews = highTotals.totalProducts > 0 ? Math.round((highTotals.editorialReviewsYesCount / highTotals.totalProducts) * 100) + '%' : '0%';
    document.getElementById('high-pct-editorial-reviews').textContent = highPctEditorialReviews;
}

// Add export functionality
document.addEventListener('DOMContentLoaded', () => {
    const exportButton = document.getElementById('exportData');
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            exportToCSV();
        });
        // Show the button since it's now in the header
        exportButton.style.display = 'inline-block';
    }
    
    const copyAsinsButton = document.getElementById('copyAsins');
    if (copyAsinsButton) {
        copyAsinsButton.addEventListener('click', () => {
            copyAsinsToClipboard();
        });
    }
    
    // ASIN Focus functionality
    setupAsinFocus();
    
    // Filter functionality
    setupFilterFunctionality();
});

function copyAsinsToClipboard() {
    console.log("report.js: Copying ASINs to clipboard");
    
    const copyAsinsButton = document.getElementById('copyAsins');
    
    // Get all ASIN links from the table
    const asinLinks = document.querySelectorAll('.asin-cell a');
    if (asinLinks.length === 0) {
        alert('No ASINs found to copy');
        return;
    }
    
    // Extract ASINs and join with newlines
    const asins = Array.from(asinLinks).map(link => link.textContent.trim());
    const asinText = asins.join('\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(asinText).then(() => {
        // Temporarily change button text to show success
        const originalText = copyAsinsButton.textContent;
        copyAsinsButton.textContent = 'Copied!';
        setTimeout(() => {
            copyAsinsButton.textContent = originalText;
        }, 2000);
        console.log("report.js: Successfully copied ASINs to clipboard");
    }).catch(err => {
        console.error('Failed to copy ASINs:', err);
        // Try fallback method
        try {
            const textArea = document.createElement('textarea');
            textArea.value = asinText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const originalText = copyAsinsButton.textContent;
            copyAsinsButton.textContent = 'Copied!';
            setTimeout(() => {
                copyAsinsButton.textContent = originalText;
            }, 2000);
            console.log("report.js: Successfully copied ASINs using fallback method");
        } catch (fallbackErr) {
            console.error('Fallback copy method also failed:', fallbackErr);
            alert('Failed to copy ASINs to clipboard');
        }
    });
}

function exportToCSV() {
    console.log("report.js: Exporting data to CSV");
    
    // Get table data
    const table = document.querySelector('table');
    if (!table) {
        alert('No data to export');
        return;
    }
    
    const csvData = [];
    
    // Define custom headers (skip Select and Type columns, split Price into two columns)
    const customHeaders = [
        'ASIN', 'Cover', 'Title & Author', 'List Price', 'Discount Price', 'Reviews', 
        'Avg Rating', 'Review Images', 'Formats', 'BSR', 'Days on Market', 'Length', 
        'Large Trim', 'A+ Modules', 'UGC Videos', 'Editorial Reviews', 'Royalty/Book', 
        'Royalty/Month', 'Publisher'
    ];
    csvData.push(customHeaders.join(','));
    
    // Get data rows (excluding totals rows)
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = [];
        
        cells.forEach((cell, index) => {
            // Skip Select column (index 0) and Type column (index 1)
            if (index === 0 || index === 1) {
                return;
            }
            
            let cellText = '';
            
            // Handle ASIN links (index 2)
            if (index === 2 && cell.querySelector('a')) {
                cellText = cell.querySelector('a').textContent.trim();
            }
            // Handle images (index 3) - show URL
            else if (index === 3 && cell.querySelector('img')) {
                const img = cell.querySelector('img');
                cellText = img.src || '';
            }
            // Handle title and author (index 4)
            else if (index === 4 && cell.querySelector('.title')) {
                const title = cell.querySelector('.title').textContent.trim();
                const author = cell.querySelector('.author');
                cellText = author ? `${title} by ${author.textContent.trim()}` : title;
            }
            // Handle price column (index 5) - split into two columns
            else if (index === 5) {
                const cellHTML = cell.innerHTML;
                let listPrice = '';
                let discountPrice = '';
                
                if (cellHTML.includes('<br>')) {
                    // Has discount: $31.00<br><span class="discount-price">$25.12(-19%)</span>
                    const parts = cellHTML.split('<br>');
                    if (parts.length >= 2) {
                        // Extract list price (remove $ symbol)
                        listPrice = parts[0].replace(/\$/, '').trim();
                        
                        // Extract discount price from the span (remove $ and percentage)
                        const discountSpan = parts[1];
                        const match = discountSpan.match(/\$(\d+\.?\d*)/);
                        if (match) {
                            discountPrice = match[1];
                        }
                    }
                } else {
                    // No discount: just $31.00
                    const priceText = cell.textContent.trim();
                    if (priceText !== 'N/A') {
                        listPrice = priceText.replace(/\$/, '');
                    }
                }
                
                // Add both price columns
                rowData.push(listPrice);
                rowData.push(discountPrice);
                return; // Don't process this column further
            }
            // Handle royalty columns (remove $ symbols)
            else if (index === 17 || index === 18) {
                cellText = cell.textContent.trim().replace(/\$/, '').replace(/,/g, '');
                if (cellText === 'N/A') cellText = '';
            }
            // Default case for other columns
            else {
                cellText = cell.textContent.trim();
            }
            
            // Escape quotes and wrap in quotes if contains comma or quote
            if (cellText.includes(',') || cellText.includes('"') || cellText.includes('\n')) {
                cellText = '"' + cellText.replace(/"/g, '""') + '"';
            }
            
            rowData.push(cellText);
        });
        
        csvData.push(rowData.join(','));
    });
    
    // Create CSV content
    const csvContent = csvData.join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Create filename with search keyword and date
    const sanitizedKeyword = searchKeyword ? searchKeyword.replace(/[^a-zA-Z0-9_-]/g, '_') : 'analysis';
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `${sanitizedKeyword}_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log("report.js: CSV export completed");
}

// Positioned hover modal functionality
let hoverTimeout = null;

function createImageHoverModal() {
    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'image-hover-modal';
    modal.innerHTML = '<img src="" alt="Enlarged cover image">';
    document.body.appendChild(modal);
}

function showImageModal(imageSrc, sourceElement) {
    const modal = document.getElementById('image-hover-modal');
    const img = modal.querySelector('img');
    
    // Set image source
    img.src = imageSrc;
    
    // Calculate position relative to source element
    const rect = sourceElement.getBoundingClientRect();
    const modalWidth = 220; // max-width from CSS
    const modalHeight = 300; // max-height from CSS
    const offset = 10; // offset from original image
    
    // Smart positioning logic
    let left = rect.right + offset;
    let top = rect.top;
    
    // Check if modal would go off right edge of viewport
    if (left + modalWidth > window.innerWidth) {
        left = rect.left - modalWidth - offset; // Show on left side instead
    }
    
    // Check if modal would go off bottom edge of viewport
    if (top + modalHeight > window.innerHeight) {
        top = window.innerHeight - modalHeight - offset; // Adjust to stay in viewport
    }
    
    // Ensure modal doesn't go off top edge
    if (top < offset) {
        top = offset;
    }
    
    // Ensure modal doesn't go off left edge (final safety check)
    if (left < offset) {
        left = offset;
    }
    
    // Position and show modal
    modal.style.left = left + 'px';
    modal.style.top = top + 'px';
    modal.style.display = 'block';
    modal.style.opacity = '1';
}

function hideImageModal() {
    const modal = document.getElementById('image-hover-modal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 200);
}

function addImageHoverEvents() {
    const coverImages = document.querySelectorAll('.cover-image');
    
    coverImages.forEach(img => {
        img.addEventListener('mouseenter', () => {
            if (img.src && img.src !== '') {
                // Clear any existing timeout
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                }
                
                // Small delay to prevent flickering on rapid mouse movement
                hoverTimeout = setTimeout(() => {
                    showImageModal(img.src, img);
                }, 150);
            }
        });
        
        img.addEventListener('mouseleave', () => {
            // Clear timeout if mouse leaves before delay completes
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            
            // Hide modal after short delay to allow moving to modal
            setTimeout(() => {
                hideImageModal();
            }, 100);
        });
    });
    
    // Also hide modal when mouse leaves the modal itself
    const modal = document.getElementById('image-hover-modal');
    if (modal) {
        modal.addEventListener('mouseenter', () => {
            // Keep modal visible when hovering over it
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
        });
        
        modal.addEventListener('mouseleave', () => {
            hideImageModal();
        });
    }
}

// Add resize listener to re-truncate titles when viewport width changes
let resizeTimeout;
window.addEventListener('resize', () => {
    // Debounce resize events to avoid excessive re-calculations
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Re-truncate all titles based on new viewport width
        document.querySelectorAll('.title[data-full-title]').forEach(titleElement => {
            const fullTitle = titleElement.getAttribute('data-full-title');
            const badgeHTML = titleElement.querySelector('.badge-bubble')?.outerHTML || '';
            const truncatedTitle = getTruncatedTitle(fullTitle);
            titleElement.innerHTML = badgeHTML + truncatedTitle;
            titleElement.setAttribute('title', fullTitle);
        });
    }, 250); // Wait 250ms after resize stops
});

// ASIN Focus Functionality
let focusedAsinRow = null;
let originalRowPosition = null;

function setupAsinFocus() {
    const asinInput = document.getElementById('asinFocusInput');
    const clearIcon = document.getElementById('clearAsinInput');
    const notFoundMessage = document.getElementById('asinNotFound');
    
    if (!asinInput || !clearIcon || !notFoundMessage) return;
    
    // Input event listener
    asinInput.addEventListener('input', function() {
        const value = this.value.trim().toUpperCase();
        
        // Show/hide clear icon
        clearIcon.style.display = value ? 'block' : 'none';
        
        // Hide not found message when typing
        notFoundMessage.style.display = 'none';
        
        // Only process when exactly 10 characters
        if (value.length === 10) {
            focusOnAsin(value);
        } else if (value.length < 10) {
            // Clear focus if less than 10 characters
            clearAsinFocus();
        }
    });
    
    // Clear icon click handler
    clearIcon.addEventListener('click', function() {
        asinInput.value = '';
        clearIcon.style.display = 'none';
        notFoundMessage.style.display = 'none';
        clearAsinFocus();
    });
}

function focusOnAsin(asin) {
    const notFoundMessage = document.getElementById('asinNotFound');
    
    // Find the row with this ASIN
    const asinLinks = document.querySelectorAll('.asin-cell a');
    let targetRow = null;
    
    for (const link of asinLinks) {
        if (link.textContent.trim() === asin) {
            targetRow = link.closest('tr');
            break;
        }
    }
    
    if (!targetRow) {
        // ASIN not found
        notFoundMessage.style.display = 'block';
        clearAsinFocus();
        return;
    }
    
    // Hide not found message
    notFoundMessage.style.display = 'none';
    
    // Clear any existing focus
    clearAsinFocus();
    
    // Store original position
    const tbody = targetRow.parentNode;
    const allRows = Array.from(tbody.children);
    originalRowPosition = {
        row: targetRow,
        index: allRows.indexOf(targetRow),
        nextSibling: targetRow.nextSibling
    };
    
    // Add focused styling and move to top
    targetRow.classList.add('focused-asin-row');
    tbody.insertBefore(targetRow, tbody.firstChild);
    focusedAsinRow = targetRow;
    
    console.log(`ASIN ${asin} focused and moved to top`);
}

function clearAsinFocus() {
    if (!focusedAsinRow || !originalRowPosition) return;
    
    // Remove focused styling
    focusedAsinRow.classList.remove('focused-asin-row');
    
    // Return to original position
    const tbody = focusedAsinRow.parentNode;
    if (originalRowPosition.nextSibling) {
        tbody.insertBefore(focusedAsinRow, originalRowPosition.nextSibling);
    } else {
        tbody.appendChild(focusedAsinRow);
    }
    
    // Reset variables
    focusedAsinRow = null;
    originalRowPosition = null;
    
    console.log('ASIN focus cleared');
}

// Override sorting to exclude focused row
const originalSortTable = sortTable;
sortTable = function(columnIndex, dataType, direction) {
    let focusedRowData = null;
    
    // Temporarily remove focused row from sorting
    if (focusedAsinRow) {
        focusedRowData = {
            row: focusedAsinRow,
            parent: focusedAsinRow.parentNode
        };
        focusedAsinRow.remove();
    }
    
    // Perform original sort
    originalSortTable(columnIndex, dataType, direction);
    
    // Re-add focused row at top
    if (focusedRowData) {
        focusedRowData.parent.insertBefore(focusedRowData.row, focusedRowData.parent.firstChild);
    }
};

// Filter functionality
let activeFilters = {};

function setupFilterFunctionality() {
    const filterToggle = document.getElementById('filterToggle');
    const filterContainer = document.getElementById('filter-container');
    const clearFiltersButton = document.getElementById('clearFilters');
    
    // Toggle filter container visibility
    filterToggle.addEventListener('change', function() {
        if (this.checked) {
            filterContainer.style.display = 'flex';
            // Set up scroll synchronization after filter container is visible
            setTimeout(() => {
                setupScrollSynchronization();
            }, 100);
        } else {
            filterContainer.style.display = 'none';
            // Clean up scroll synchronization when hiding filters
            cleanupScrollSynchronization();
            // Clear all filters when toggle is turned off
            clearAllFilters();
        }
    });
    
    // Clear filters button
    clearFiltersButton.addEventListener('click', function() {
        clearAllFilters();
    });
    
    // Add event listeners to all filter inputs
    setupFilterInputListeners();
}

function setupFilterInputListeners() {
    // Add listeners to all filter inputs
    const inputs = document.querySelectorAll('.filter-input');
    inputs.forEach(input => {
        input.addEventListener('input', debounce(applyFilters, 300));
    });
    
    // Add listeners to all filter selects
    const selects = document.querySelectorAll('.filter-select');
    selects.forEach(select => {
        select.addEventListener('change', applyFilters);
    });
}

function applyFilters() {
    const tbody = document.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    // Build active filters object
    activeFilters = buildActiveFilters();
    
    let visibleCount = 0;
    let filteredData = [];
    
    rows.forEach(row => {
        const asin = row.dataset.asin;
        
        // Check if this is the focused ASIN row - if so, always keep it visible
        const isFocusedRow = row.classList.contains('focused-asin-row');
        const isVisible = isFocusedRow || passesAllFilters(row);
        
        if (isVisible) {
            row.style.display = '';
            visibleCount++;
            
            // Collect data for totals calculation
            const rowData = getRowDataForTotals(row, asin);
            if (rowData) {
                filteredData.push(rowData);
            }
        } else {
            row.style.display = 'none';
        }
    });
    
    // Update totals based on filtered data
    calculateAndDisplayTotals(filteredData);
    calculateAndDisplayHighRoyaltyTotals(filteredData);
}

function buildActiveFilters() {
    const filters = {};
    
    // Price filters
    const priceMin = parseFloat(document.getElementById('priceMin').value);
    const priceMax = parseFloat(document.getElementById('priceMax').value);
    if (!isNaN(priceMin) || !isNaN(priceMax)) {
        filters.price = { min: priceMin, max: priceMax };
    }
    
    // Reviews filters
    const reviewsMin = parseInt(document.getElementById('reviewsMin').value);
    const reviewsMax = parseInt(document.getElementById('reviewsMax').value);
    if (!isNaN(reviewsMin) || !isNaN(reviewsMax)) {
        filters.reviews = { min: reviewsMin, max: reviewsMax };
    }
    
    // Rating filters
    const ratingMin = parseFloat(document.getElementById('ratingMin').value);
    const ratingMax = parseFloat(document.getElementById('ratingMax').value);
    if (!isNaN(ratingMin) || !isNaN(ratingMax)) {
        filters.rating = { min: ratingMin, max: ratingMax };
    }
    
    // Review Images filters
    const reviewImagesMin = parseInt(document.getElementById('reviewImagesMin').value);
    const reviewImagesMax = parseInt(document.getElementById('reviewImagesMax').value);
    if (!isNaN(reviewImagesMin) || !isNaN(reviewImagesMax)) {
        filters.reviewImages = { min: reviewImagesMin, max: reviewImagesMax };
    }
    
    // Formats filters
    const formatsMin = parseInt(document.getElementById('formatsMin').value);
    const formatsMax = parseInt(document.getElementById('formatsMax').value);
    if (!isNaN(formatsMin) || !isNaN(formatsMax)) {
        filters.formats = { min: formatsMin, max: formatsMax };
    }
    
    // BSR filters
    const bsrMin = parseInt(document.getElementById('bsrMin').value);
    const bsrMax = parseInt(document.getElementById('bsrMax').value);
    if (!isNaN(bsrMin) || !isNaN(bsrMax)) {
        filters.bsr = { min: bsrMin, max: bsrMax };
    }
    
    // Days on Market filters
    const daysMarketMin = parseInt(document.getElementById('daysMarketMin').value);
    const daysMarketMax = parseInt(document.getElementById('daysMarketMax').value);
    if (!isNaN(daysMarketMin) || !isNaN(daysMarketMax)) {
        filters.daysMarket = { min: daysMarketMin, max: daysMarketMax };
    }
    
    // Length filters
    const lengthMin = parseInt(document.getElementById('lengthMin').value);
    const lengthMax = parseInt(document.getElementById('lengthMax').value);
    if (!isNaN(lengthMin) || !isNaN(lengthMax)) {
        filters.length = { min: lengthMin, max: lengthMax };
    }
    
    // Royalty/Book filters
    const royaltyBookMin = parseFloat(document.getElementById('royaltyBookMin').value);
    const royaltyBookMax = parseFloat(document.getElementById('royaltyBookMax').value);
    if (!isNaN(royaltyBookMin) || !isNaN(royaltyBookMax)) {
        filters.royaltyBook = { min: royaltyBookMin, max: royaltyBookMax };
    }
    
    // Royalty/Month filters
    const royaltyMonthMin = parseFloat(document.getElementById('royaltyMonthMin').value);
    const royaltyMonthMax = parseFloat(document.getElementById('royaltyMonthMax').value);
    if (!isNaN(royaltyMonthMin) || !isNaN(royaltyMonthMax)) {
        filters.royaltyMonth = { min: royaltyMonthMin, max: royaltyMonthMax };
    }
    
    // Boolean filters
    const largeTrimValue = document.getElementById('largeTrimFilter').value;
    if (largeTrimValue) {
        filters.largeTrim = largeTrimValue;
    }
    
    const aModulesValue = document.getElementById('aModulesFilter').value;
    if (aModulesValue) {
        filters.aModules = aModulesValue;
    }
    
    const ugcVideosValue = document.getElementById('ugcVideosFilter').value;
    if (ugcVideosValue) {
        filters.ugcVideos = ugcVideosValue;
    }
    
    const editorialReviewsValue = document.getElementById('editorialReviewsFilter').value;
    if (editorialReviewsValue) {
        filters.editorialReviews = editorialReviewsValue;
    }
    
    return filters;
}

function passesAllFilters(row) {
    const asin = row.dataset.asin;
    
    // Check numerical filters
    if (activeFilters.price && !passesNumericalFilter(row, 5, activeFilters.price)) return false;
    if (activeFilters.reviews && !passesNumericalFilter(row, 6, activeFilters.reviews)) return false;
    if (activeFilters.rating && !passesNumericalFilter(row, 7, activeFilters.rating)) return false;
    if (activeFilters.reviewImages && !passesNumericalFilter(row, 8, activeFilters.reviewImages)) return false;
    if (activeFilters.formats && !passesNumericalFilter(row, 9, activeFilters.formats)) return false;
    if (activeFilters.bsr && !passesNumericalFilter(row, 10, activeFilters.bsr)) return false;
    if (activeFilters.daysMarket && !passesNumericalFilter(row, 11, activeFilters.daysMarket)) return false;
    if (activeFilters.length && !passesNumericalFilter(row, 12, activeFilters.length)) return false;
    if (activeFilters.royaltyBook && !passesNumericalFilter(row, 17, activeFilters.royaltyBook)) return false;
    if (activeFilters.royaltyMonth && !passesNumericalFilter(row, 18, activeFilters.royaltyMonth)) return false;
    
    // Check boolean filters
    if (activeFilters.largeTrim && !passesBooleanFilter(row, 13, activeFilters.largeTrim)) return false;
    if (activeFilters.aModules && !passesBooleanFilter(row, 14, activeFilters.aModules)) return false;
    if (activeFilters.ugcVideos && !passesBooleanFilter(row, 15, activeFilters.ugcVideos)) return false;
    if (activeFilters.editorialReviews && !passesBooleanFilter(row, 16, activeFilters.editorialReviews)) return false;
    
    return true;
}

function passesNumericalFilter(row, columnIndex, filter) {
    const cell = row.children[columnIndex];
    if (!cell) return true;
    
    const value = parseFloat(getCellValue(cell, 'number'));
    if (isNaN(value)) return true; // Don't filter out N/A values
    
    if (!isNaN(filter.min) && value < filter.min) return false;
    if (!isNaN(filter.max) && value > filter.max) return false;
    
    return true;
}

function passesBooleanFilter(row, columnIndex, filterValue) {
    const cell = row.children[columnIndex];
    if (!cell) return true;
    
    const cellText = cell.textContent.trim();
    return cellText === filterValue;
}

function getRowDataForTotals(row, asin) {
    // Find the corresponding data in allData array
    const rowData = allData.find(item => item.asin === asin);
    return rowData || null;
}

function clearAllFilters() {
    // Clear all input fields
    const inputs = document.querySelectorAll('.filter-input');
    inputs.forEach(input => input.value = '');
    
    // Reset all selects
    const selects = document.querySelectorAll('.filter-select');
    selects.forEach(select => select.selectedIndex = 0);
    
    // Clear active filters
    activeFilters = {};
    
    // Show all rows (except focused row which should remain visible)
    const tbody = document.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => row.style.display = '');
    
    // Recalculate totals with all data
    calculateAndDisplayTotals(allData);
    calculateAndDisplayHighRoyaltyTotals(allData);
}

function debounce(func, wait) {
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

// Scroll synchronization between filter container and table
let scrollSyncInitialized = false;
let scrollSyncListeners = [];

function setupScrollSynchronization() {
    // Clean up existing listeners first
    cleanupScrollSynchronization();
    
    const filterContainer = document.getElementById('filter-container');
    const tableContainer = document.getElementById('table-container');
    const table = document.querySelector('table');
    const thead = document.querySelector('thead');
    const tbody = document.querySelector('tbody');
    
    console.log('report.js: Setting up scroll sync. Elements found:', {
        filterContainer: !!filterContainer,
        tableContainer: !!tableContainer,
        table: !!table,
        thead: !!thead,
        tbody: !!tbody
    });
    
    if (!filterContainer) {
        console.log('report.js: No filter container found, skipping scroll sync');
        return;
    }
    
    // Check if filter container is visible
    const isVisible = filterContainer.style.display !== 'none' && 
                     window.getComputedStyle(filterContainer).display !== 'none';
    
    if (!isVisible) {
        console.log('report.js: Filter container not visible, skipping scroll sync');
        return;
    }
    
    // For flexbox table structure, we need to sync the scroll of the table container
    // which will affect both thead and tbody simultaneously
    const scrollableElement = tableContainer;
    
    if (!scrollableElement) {
        console.log('report.js: No table container found for scroll sync');
        return;
    }
    
    console.log('report.js: Setting up sync between filter container and table container');
    
    let isFilterScrolling = false;
    let isTableScrolling = false;
    let filterScrollTimeout = null;
    let tableScrollTimeout = null;
    
    // Sync filter scroll to table scroll
    const filterScrollHandler = function(e) {
        if (!isTableScrolling) {
            isFilterScrolling = true;
            
            const scrollLeft = this.scrollLeft;
            console.log('report.js: Filter scrolled to:', scrollLeft);
            
            // For flexbox table structure, apply transform to tbody only
            // This keeps the header fixed while scrolling the body content
            if (tbody) {
                tbody.style.transform = `translateX(-${scrollLeft}px)`;
            }
            
            // Also apply to tfoot if it exists to keep totals aligned
            const tfoot = document.querySelector('tfoot');
            if (tfoot) {
                tfoot.style.transform = `translateX(-${scrollLeft}px)`;
            }
            
            // Set scrollLeft on table container as additional fallback
            if (scrollableElement) {
                scrollableElement.scrollLeft = scrollLeft;
            }
            
            // Clear existing timeout and set new one
            if (filterScrollTimeout) clearTimeout(filterScrollTimeout);
            filterScrollTimeout = setTimeout(() => { 
                isFilterScrolling = false; 
                filterScrollTimeout = null;
            }, 100);
        }
    };
    
    // Sync table scroll to filter scroll  
    const tableScrollHandler = function(e) {
        if (!isFilterScrolling) {
            isTableScrolling = true;
            const scrollLeft = this.scrollLeft;
            
            console.log('report.js: Table scrolled to:', scrollLeft);
            
            // Update filter container scroll
            filterContainer.scrollLeft = scrollLeft;
            
            // Clear existing timeout and set new one
            if (tableScrollTimeout) clearTimeout(tableScrollTimeout);
            tableScrollTimeout = setTimeout(() => { 
                isTableScrolling = false; 
                tableScrollTimeout = null;
            }, 100);
        }
    };
    
    // Add event listeners to both filter container and table container
    filterContainer.addEventListener('scroll', filterScrollHandler);
    scrollableElement.addEventListener('scroll', tableScrollHandler);
    
    // Also add listeners to tbody in case it has independent scrolling
    if (tbody && tbody !== scrollableElement) {
        tbody.addEventListener('scroll', tableScrollHandler);
        scrollSyncListeners.push({
            element: tbody,
            event: 'scroll',
            handler: tableScrollHandler
        });
    }
    
    scrollSyncListeners.push({
        element: filterContainer,
        event: 'scroll',
        handler: filterScrollHandler
    });
    
    scrollSyncListeners.push({
        element: scrollableElement,
        event: 'scroll', 
        handler: tableScrollHandler
    });
    
    scrollSyncInitialized = true;
    console.log('report.js: Scroll synchronization setup complete');
    
    // Debug function to test scroll sync manually
    window.testScrollSync = function(scrollAmount = 100) {
        console.log('Testing scroll sync with amount:', scrollAmount);
        if (filterContainer) {
            filterContainer.scrollLeft = scrollAmount;
            console.log('Filter container scrollLeft set to:', filterContainer.scrollLeft);
        }
        if (scrollableElement) {
            console.log('Table container scrollLeft:', scrollableElement.scrollLeft);
        }
        if (tbody) {
            console.log('Tbody transform:', tbody.style.transform);
        }
        const tfoot = document.querySelector('tfoot');
        if (tfoot) {
            console.log('Tfoot transform:', tfoot.style.transform);
        }
    };
}

function cleanupScrollSynchronization() {
    // Remove existing event listeners
    scrollSyncListeners.forEach(({ element, event, handler }) => {
        if (element && handler) {
            element.removeEventListener(event, handler);
        }
    });
    scrollSyncListeners = [];
    scrollSyncInitialized = false;
    console.log('report.js: Scroll synchronization cleaned up');
}

