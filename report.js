document.addEventListener('DOMContentLoaded', async () => {
    console.log("report.js: DOM fully loaded and parsed.");
    const tableContainer = document.getElementById('table-container');
    const progressText = document.getElementById('progress-text');
    
    // Create positioned hover modal for images
    createImageHoverModal();

    console.log("report.js: Loading initial data from local storage.");
    const { serpData, asinsToProcess, currentDomain } = await chrome.storage.local.get(['serpData', 'asinsToProcess', 'currentDomain']);

    if (!serpData || !asinsToProcess) {
        console.error("report.js: Could not load initial data from storage.");
        tableContainer.innerHTML = '<p>Error: Could not load initial data from storage. Please try again.</p>';
        progressText.textContent = 'Error: Could not load data. Please restart the analysis.';
        return;
    }
    
    console.log("report.js: Initial data loaded successfully.", { serpData, asinsToProcess });
    let processedCount = 0;
    const totalToProcess = asinsToProcess.length;
    let allData = []; // To store data for all processed ASINs
    let uniqueAsins = new Set(); // To track unique ASINs and avoid double counting

    progressText.textContent = `Progress: ${processedCount} / ${totalToProcess} products analyzed.`;

    renderInitialTable(serpData, asinsToProcess, tableContainer, currentDomain);

    // Listen for messages from the background script
    console.log("report.js: Adding message listener for updates from background script.");
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("report.js: Received message from background script:", request);
        if (request.command === "update-row") {
            console.log(`report.js: Updating row for ASIN ${request.asin}.`);
            const rowData = { ...request.data, asin: request.asin };
            // Also add the initial product info from SERP data to have all data in one place
            const initialProductInfo = serpData.productInfo[request.asin] || {};
            const combinedData = { ...initialProductInfo, ...rowData };
            
            // Update author info if the individual page has better data
            if (rowData.author_info && rowData.author_info.name && 
                (!initialProductInfo.authors || initialProductInfo.authors.length === 0)) {
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
            processedCount++;
            progressText.textContent = `Progress: ${processedCount} / ${totalToProcess} products analyzed (processing in batches of 5).`;
    
    // Update progress bar if we have one
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        const percentage = Math.round((processedCount / totalToProcess) * 100);
        progressBar.style.width = percentage + '%';
        progressBar.textContent = percentage + '%';
    }
        } else if (request.command === "analysis-complete") {
            console.log("report.js: Received analysis complete message.");
            const message = request.stopped ? 
                `Analysis Stopped! ${processedCount} of ${totalToProcess} products were processed.` :
                `Analysis Complete! All ${totalToProcess} products have been processed.`;
            progressText.textContent = message;
            document.getElementById('progress-container').style.backgroundColor = request.stopped ? '#f8d7da' : '#d4edda'; // Red if stopped, green if complete
            
            // Collapse progress container after 3 seconds
            setTimeout(() => {
                const progressContainer = document.getElementById('progress-container');
                progressContainer.style.transition = 'all 0.5s ease-out';
                progressContainer.style.maxHeight = '0px';
                progressContainer.style.padding = '0';
                progressContainer.style.margin = '0';
                progressContainer.style.overflow = 'hidden';
            }, 3000);
            
            calculateAndDisplayTotals(allData); // Calculate and display totals
            calculateAndDisplayHighRoyaltyTotals(allData); // Calculate and display high royalty totals
            
            // Show export button
            document.getElementById('exportData').style.display = 'inline-block';
            
            // Clean up - clear stored data to prevent memory leaks
            chrome.storage.local.remove(['serpData', 'asinsToProcess', 'currentDomain'])
                .then(() => console.log("report.js: Cleaned up storage after analysis completion"))
                .catch(err => console.warn("report.js: Failed to clean up storage:", err));
        }
    });
});

function renderInitialTable(serpData, asinsToProcess, container, currentDomain) {
    console.log("report.js: Rendering initial table.");
    const { productInfo, positions } = serpData;
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>ASIN</th>
                    <th>Cover</th>
                    <th>Title & Author</th>
                    <th>Price</th>
                    <th>Reviews</th>
                    <th>Avg Rating</th>
                    <th>Review Images</th>
                    <th>Formats</th>
                    <th>BSR</th>
                    <th>Days on Market</th>
                    <th>Length</th>
                    <th>Large Trim</th>
                    <th>A+ Modules</th>
                    <th>UGC Videos</th>
                    <th>Editorial Reviews</th>
                    <th>Royalty/Book</th>
                    <th>Royalty/Month</th>
                    <th>Publisher</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const asin of asinsToProcess) {
        const product = productInfo[asin] || {};
        const placements = positions[asin] || [];
        
        // Get the earliest position and collect all placement types
        const earliestPosition = placements.length > 0 ? Math.min(...placements.map(p => p.position)) : 'N/A';
        const allTypes = placements.length > 0 ? [...new Set(placements.map(p => p.type))].join(', ') : 'N/A';

        // Get badge value for display
        const badgeText = product.badge_status ? 
            (product.badge_status === 'bestseller' ? 'BS' : 
             product.badge_status === 'new-release' ? 'NR' : 
             product.badge_status === 'amazon-charts' ? 'AC' : '') : '';
        
        const titleWithBadge = badgeText ? `(${badgeText}) ${product.title || 'N/A'}` : (product.title || 'N/A');
        
        tableHTML += `
            <tr data-asin="${asin}">
                <td>${allTypes}</td>
                <td class="asin-cell"><a href="https://${currentDomain}/dp/${asin}" target="_blank">${asin}</a></td>
                <td><img src="${product.coverUrl || ''}" class="cover-image"/></td>
                <td class="title-author-cell">
                    <div class="title" id="title-${asin}">${titleWithBadge}</div>
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
                    <td colspan="5">High Royalty (≥$500/month) - <span id="high-royalty-count">0</span></td>
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
        if (cell) {
            let displayValue = 'N/A';
            if (value !== null) {
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
    
    // Update title with badge if badge status changed
    if (badgeStatus) {
        const badgeAcronym = badgeStatus === 'bestseller' ? 'BS' : 
                            badgeStatus === 'new-release' ? 'NR' : 
                            badgeStatus === 'amazon-charts' ? 'AC' : '';
        const titleElement = document.getElementById(`title-${asin}`);
        if (titleElement && badgeAcronym) {
            const currentTitle = titleElement.textContent;
            if (!currentTitle.startsWith('(')) {
                titleElement.textContent = `(${badgeAcronym}) ${currentTitle}`;
            }
        }
    }

    // Badge is now handled in title display
    updateCell(`formats-${asin}`, formatCount, val => val || 0);
    updateCell(`rating-${asin}`, avgRating, val => val || 0);
    updateCell(`review-images-${asin}`, reviewImageCount, val => val || 0);
    updateCell(`bsr-${asin}`, bsr, val => val ? val.toLocaleString() : 'N/A');
    updateCell(`days-${asin}`, daysOnMarket, val => val !== null ? val.toLocaleString() : 'N/A');
    updateCell(`length-${asin}`, pageCount, val => val ? val.toLocaleString() : 'N/A');
    updateCell(`publisher-${asin}`, publisher);
    updateCell(`trim-${asin}`, largeTrim, val => val ? 'Yes' : 'No');
    updateCell(`aplus-${asin}`, aplusCount, val => val || 0);
    updateCell(`ugc-videos-${asin}`, ugcVideoCount, val => val || 0);
    updateCell(`editorial-reviews-${asin}`, editorialReviews, val => (val && Object.keys(val).length > 0) ? 'Yes' : 'No');
    
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
        if(data.royalties && data.royalties.error) {
            royaltyUnitCell.textContent = 'N/A';
        } else {
            royaltyUnitCell.textContent = royaltyUnit !== null ? `$${royaltyUnit.toFixed(2)}` : 'N/A';
        }
        royaltyUnitCell.classList.remove('placeholder');
    }

    const royaltyMonthCell = document.getElementById(`royalty-month-${asin}`);
    if (royaltyMonthCell) {
        if(data.royalties && data.royalties.error) {
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
    const get = (p, o) => p.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, o);
    
    // Filter for books with monthly royalty >= $500
    const highRoyaltyBooks = allData.filter(data => {
        if (!data) return false;
        const royaltyMonth = get(['royalties', 'monthly_royalty'], data);
        return royaltyMonth !== null && royaltyMonth !== undefined && royaltyMonth >= 500;
    });
    
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
            const selectedFormat = formats.find(f => f.isSelected) || formats[0];
            if (selectedFormat && selectedFormat.prices && selectedFormat.prices.length > 0) {
                const listPrice = selectedFormat.prices.find(p => p.type === 'list_price')?.price;
                price = listPrice || selectedFormat.prices[0].price;
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
    
    // Update the high royalty count with recent books info
    const countText = highTotals.totalProducts > 0
        ? `${highTotals.totalProducts} books (${recentBooksCount} with <90 days on market)`
        : '0 books';
    document.getElementById('high-royalty-count').textContent = countText;
    
    // Update all the high royalty totals
    document.getElementById('high-avg-price').textContent = (highTotals.priceCount > 0 ? `$${(highTotals.priceSum / highTotals.priceCount).toFixed(2)}` : '$0.00');
    document.getElementById('high-total-reviews').textContent = (highTotals.reviewsCount > 0 ? Math.round(highTotals.reviewsSum / highTotals.reviewsCount).toLocaleString() : '0');
    document.getElementById('high-avg-rating').textContent = (highTotals.ratingCount > 0 ? (highTotals.ratingSum / highTotals.ratingCount).toFixed(2) : '0.00');
    document.getElementById('high-total-review-images').textContent = (highTotals.reviewImagesCount > 0 ? Math.round(highTotals.reviewImagesSum / highTotals.reviewImagesCount).toLocaleString() : '0');
    document.getElementById('high-avg-bsr').textContent = (highTotals.bsrCount > 0 ? Math.round(highTotals.bsrSum / highTotals.bsrCount).toLocaleString() : 'N/A');
    document.getElementById('high-avg-days').textContent = (highTotals.daysCount > 0 ? Math.round(highTotals.daysSum / highTotals.daysCount).toLocaleString() : 'N/A');
    document.getElementById('high-avg-length').textContent = (highTotals.lengthCount > 0 ? Math.round(highTotals.lengthSum / highTotals.lengthCount).toLocaleString() : 'N/A');
    document.getElementById('high-avg-aplus').textContent = (highTotals.aplusCount > 0 ? (highTotals.aplusSum / highTotals.aplusCount).toFixed(1) : '0.0');
    document.getElementById('high-avg-ugc-videos').textContent = (highTotals.ugcCount > 0 ? (highTotals.ugcVideos / highTotals.ugcCount).toFixed(1) : '0.0');
    document.getElementById('high-avg-royalty-unit').textContent = (highTotals.royaltyUnitCount > 0 ? `$${(highTotals.royaltyUnitSum / highTotals.royaltyUnitCount).toFixed(2)}` : '$0.00');
    document.getElementById('high-total-royalty-month').textContent = (highTotals.royaltyMonthCount > 0 ? `$${Math.round(highTotals.royaltyMonthSum / highTotals.royaltyMonthCount).toLocaleString()}` : '$0');
    
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
});

function copyAsinsToClipboard() {
    console.log("report.js: Copying ASINs to clipboard");
    
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
    }).catch(err => {
        console.error('Failed to copy ASINs:', err);
        alert('Failed to copy ASINs to clipboard');
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
    
    const rows = table.querySelectorAll('tr');
    const csvData = [];
    
    // Process each row
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('th, td');
        const rowData = [];
        
        cells.forEach(cell => {
            let cellText = cell.textContent.trim();
            // Handle links - extract just the text (ASIN)
            const link = cell.querySelector('a');
            if (link) {
                cellText = link.textContent.trim();
            }
            // Escape quotes and wrap in quotes if contains comma
            if (cellText.includes(',') || cellText.includes('"')) {
                cellText = '"' + cellText.replace(/"/g, '""') + '"';
            }
            rowData.push(cellText);
        });
        
        csvData.push(rowData.join(','));
    });
    
    // Create CSV content
    const csvContent = csvData.join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon_serp_analysis_${new Date().toISOString().slice(0, 10)}.csv`;
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

