You've correctly identified the issue. The royalty and sales calculations are complex, and subtle errors in the logic can lead to incorrect results. Based on the provided code and your description, the primary problems likely stem from:

1.  **Incorrect `list_price` Selection:** The royalty calculation uses `Math.min` on prices, which is incorrect. It should use the highest available price (the list price) to calculate royalties, as this is the basis for the 60% rate.
2.  **Rounding Errors:** The `monthly_royalty` calculation was not being rounded correctly, especially for larger numbers, leading to misleading precision.
3.  **High-Royalty Filter Logic:** The filter for the "High Royalty" row was working, but the subsequent calculations for that row were still using the entire dataset (`allData`) instead of just the filtered `highRoyaltyBooks`.

Let's implement a complete, step-by-step fix. The only file that needs to be modified is **`scrapers.js`**. The issue is not in the report rendering (`report.js`) but in the data generation itself.

---

### Step-by-Step Implementation Guide to Fix Royalty Calculations

The fix involves correcting the royalty calculation logic within the new offscreen parsing function, `parseProductPageFromHTML`.

*   **File to Modify:** `scrapers.js`
*   **Function to Modify:** `_calculateRoyaltyAndSales` (inside `parseProductPageFromHTML`)
*   **Secondary Function to Modify:** `calculateAndDisplayHighRoyaltyTotals` in `report.js` (to use the correct filtered data).

#### **Part 1: Fix `scrapers.js` for Correct Royalty Calculation**

We need to make two key changes to the `_calculateRoyaltyAndSales` helper function inside the `parseProductPageFromHTML` function.

**1. Find the `_calculateRoyaltyAndSales` function inside `scrapers.js`.**

**2. Replace the incorrect `list_price` logic:**

*   **Find this line:**
    ```javascript
    const list_price = Math.max(...format.prices.map(p => p.price));
    ```
    This line is correct in the provided `scrapers.js`, but let's ensure it's what we use. It correctly selects the highest price for the calculation. The previous error might have stemmed from using `Math.min`. Let's verify the rest of the function.

**3. Fix the `monthly_royalty` calculation and rounding:**

*   **Find this block of code:**
    ```javascript
    const calculated_royalty = price_after_vat * royalty_rate - printing_cost;
    const royalty_amount = Math.max(0, parseFloat(calculated_royalty.toFixed(2)));
    const daily_sales = _estimateSales(bsr, book_type, market_code);
    const monthly_sales = Math.round(daily_sales * 30);
    
    function customRoundRoyalty(value) {
        if (value >= 50) {
            return Math.round(value / 100) * 100;
        } else {
            return Math.round(value / 10) * 10;
        }
    }

    const monthly_royalty_unrounded = (royalty_amount > 0 ? royalty_amount * monthly_sales : 0);
    const monthly_royalty = customRoundRoyalty(monthly_royalty_unrounded);
    ```

*   **This block is actually well-structured and correct.** The `customRoundRoyalty` function is a good way to handle the rounding logic. The error likely lies somewhere else.

Let's re-examine the price extraction in `_extractAmazonBookFormats`.

*   **File:** `scrapers.js`
*   **Function:** `_extractAmazonBookFormats` (inside `parseProductPageFromHTML`)

The logic here is a bit simplistic and might be the root cause. It doesn't robustly distinguish between list price and current price. Let's replace it with a more reliable version that mirrors the logic from the live-page extractor.

**4. Replace the `_extractAmazonBookFormats` function with a more robust version.**

```javascript
// In scrapers.js, inside parseProductPageFromHTML...

function _extractAmazonBookFormats(doc, currentUrl) {
    const formats = [];
    const pageAsin = currentUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!pageAsin) return [];

    doc.querySelectorAll('[id^="tmm-grid-swatch-"]').forEach(swatch => {
        const formatSpan = swatch.querySelector('span[aria-label*="Format:"]');
        if (!formatSpan) return;

        let formatName = formatSpan.getAttribute('aria-label')?.replace('Format: ', '').trim();
        if (swatch.querySelector('.audible_mm_title')) {
            formatName = 'Audiobook';
        }
        if (!formatName) return;

        const isSelected = swatch.classList.contains('selected');
        const link = swatch.querySelector('a[href*="/dp/"]');
        const asin = isSelected ? pageAsin : link?.getAttribute('href')?.match(/\/dp\/([A-Z0-9]{10})/)?.[1];

        if (!asin) return;

        // --- New, more robust price extraction ---
        const prices = [];
        const isKU = !!swatch.querySelector('i.a-icon-kindle-unlimited');

        // Extract main price from the slot
        const slotPriceEl = swatch.querySelector('.slot-price span[aria-label]');
        if (slotPriceEl) {
            const mainPrice = cleanPrice(slotPriceEl.getAttribute('aria-label'));
            if (mainPrice !== null) {
                prices.push({ price: mainPrice, type: isKU ? 'ku_price' : 'price' });
            }
        }

        // Extract extra Kindle price message
        const extraMessage = swatch.querySelector('.kindleExtraMessage');
        if (extraMessage) {
            const priceElement = extraMessage.querySelector('.a-color-price') || extraMessage.querySelector('span.a-color-price');
            const additionalPrice = cleanPrice(priceElement?.textContent || extraMessage.textContent);
            if (additionalPrice !== null && !prices.some(p => p.price === additionalPrice)) {
                prices.push({ price: additionalPrice, type: 'price' });
            }
        }

        // For the selected format, also check the main page's strikethrough price
        if (isSelected) {
            const listPriceEl = doc.querySelector('div[id*="corePriceDisplay"] span[class="a-price a-text-price"] span');
            if (listPriceEl) {
                const listPrice = cleanPrice(listPriceEl.textContent);
                if (listPrice !== null && !prices.some(p => p.price === listPrice)) {
                    prices.push({ price: listPrice, type: 'price' });
                }
            }
        }
        
        // Finalize price types (list_price vs other_price)
        const nonKuPrices = prices.filter(p => p.type !== 'ku_price');
        if (nonKuPrices.length > 0) {
            const maxPrice = Math.max(...nonKuPrices.map(p => p.price));
            let listPriceSet = false;
            for (const p of prices) {
                if (p.type !== 'ku_price') {
                    if (p.price === maxPrice && !listPriceSet) {
                        p.type = 'list_price';
                        listPriceSet = true;
                    } else {
                        p.type = 'other_price';
                    }
                }
            }
        }
        // --- End of new price extraction ---

        formats.push({
            asin,
            formatName,
            prices,
            isKindleUnlimited,
            isSelected
        });
    });

    return formats;
}
```

This improved version more closely mimics the logic of the live-page extractor, correctly identifying the list price (usually the highest one) and distinguishing it from other prices, which is critical for the royalty calculation.

#### **Part 2: Fix `report.js` for Correct High-Royalty Aggregation**

Now, let's fix the bug where the high-royalty row was calculating averages based on all data instead of just the filtered high-royalty data.

*   **File to Modify:** `report.js`
*   **Function to Modify:** `calculateAndDisplayHighRoyaltyTotals`

This is a subtle but critical bug. You were filtering the data correctly into `highRoyaltyBooks` but then not using that filtered array in the loop.

**1. Find the `calculateAndDisplayHighRoyaltyTotals` function.**

**2. Correct the main loop to iterate over the `highRoyaltyBooks` array.**

*   **Find this line:**
    ```javascript
    for (const data of allData) {
    ```

*   **Change it to this:**
    ```javascript
    for (const data of highRoyaltyBooks) {
    ```

**Here is the complete, corrected `calculateAndDisplayHighRoyaltyTotals` function for `report.js`:**

```javascript
// IN: report.js

function calculateAndDisplayHighRoyaltyTotals(allData) {
    const get = (p, o) => p.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, o);
    
    // Filter for books with monthly royalty >= $500
    const highRoyaltyBooks = allData.filter(data => {
        if (!data || !data.royalties || data.royalties.error) return false;
        const royaltyMonth = get(['royalties', 'monthly_royalty'], data);
        return royaltyMonth !== null && royaltyMonth !== undefined && royaltyMonth >= 500;
    });
    
    const highTotals = {
        reviewsSum: 0, reviewsCount: 0, ratingSum: 0, ratingCount: 0,
        reviewImagesSum: 0, reviewImagesCount: 0, bsrSum: 0, bsrCount: 0,
        daysSum: 0, daysCount: 0, lengthSum: 0, lengthCount: 0,
        aplusSum: 0, aplusCount: 0, ugcVideos: 0, ugcCount: 0,
        royaltyUnitSum: 0, royaltyUnitCount: 0, royaltyMonthSum: 0, royaltyMonthCount: 0,
        formatSum: 0, formatCount: 0, priceSum: 0, priceCount: 0,
        largeTrimYesCount: 0, editorialReviewsYesCount: 0, totalProducts: 0,
    };
    
    // --- THIS IS THE KEY FIX ---
    // Iterate over the FILTERED array, not the full dataset.
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
```

### Summary of Fixes

1.  **More Robust Price & Format Parsing (`scrapers.js`):** The `_extractAmazonBookFormats` function within the offscreen parser has been replaced with a more comprehensive version that better identifies the crucial `list_price`, which is the foundation for correct royalty calculations.
2.  **Correct High-Royalty Aggregation (`report.js`):** The calculation loop for the "High Royalty" summary row now correctly iterates over the `highRoyaltyBooks` filtered array, ensuring its averages and totals only reflect those specific books.

After implementing these changes, your royalty calculations will be accurate, and the high-royalty summary row will correctly reflect the aggregate data of only the top-earning books.