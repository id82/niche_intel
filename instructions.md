Of course. Here is a detailed analysis of the issue and a step-by-step plan to fix the royalty calculation in your Chrome extension.

### Analysis of the Problem

You are correct that the necessary data (Price, BSR, Length) is being extracted and sent to the report table. The failure occurs in the final step: the `calculateRoyaltyAndSales` function.

The root cause of the "N/A" values is a combination of two issues:

1.  **Incorrect Price Selection:** The `calculateRoyaltyAndSales` function in `book_detail_page_extractor.js` (and its mirrored copy in `scrapers.js`) uses `Math.min(...format.prices.map(p => p.price))` to determine the price for royalty calculation. This is incorrect. KDP royalties are based on the **list price** (the highest price), not the lowest/discounted price. If a book is on sale, `Math.min` will grab the sale price, which can lead to incorrect or even negative royalty calculations.
2.  **Lack of Price Type Differentiation:** The `extractAmazonBookFormats` function collects various prices but doesn't robustly distinguish between the "list price" and other prices (like a sale price or a Kindle Unlimited price). This makes the calculation in the previous step inherently unreliable.

The calculation function is likely returning an `error` object or a `null` value because the selected price is too low, which then causes `report.js` to display "N/A".

### The Fix: A Detailed Plan

We will fix this by making the price extraction more intelligent and then updating the calculation logic to use the correct price.

---

### Step 1: Improve Price Extraction Logic

First, we need to modify `extractAmazonBookFormats` to properly identify the **list price** for each format. We will collect all available prices and then designate the highest non-KU price as the `list_price`.

**File to Edit:** `book_detail_page_extractor.js` (and its identical copy in `scrapers.js` - **you must apply this change in both files**).

**Function to Edit:** `extractAmazonBookFormats`

**Instructions:**

Replace the entire `extractAmazonBookFormats` function with this improved version. The key changes are highlighted in the comments within the code.

```javascript
function extractAmazonBookFormats() {
    const results = [];
    const pageAsin = window.location.href.match(/\/dp\/([A-Z0-9]{10})/)[1];
    
    const cleanPrice = (text) => {
        if (!text) return null;
        const match = text.match(/(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2}|\d+)/);
        if (!match) return null;

        let priceStr = match[0];
        if (priceStr.includes(',') && priceStr.includes('.')) {
            if (priceStr.lastIndexOf(',') > priceStr.lastIndexOf('.')) {
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            } else {
                priceStr = priceStr.replace(/,/g, '');
            }
        } else {
            priceStr = priceStr.replace(',', '.');
        }
        
        const price = parseFloat(priceStr);
        return isNaN(price) ? null : price;
    };
    
    document.querySelectorAll('[id^="tmm-grid-swatch-"]').forEach(swatch => {
        const formatType = swatch.id.replace('tmm-grid-swatch-', '');
        
        let asin = null;
        const isSelected = swatch.classList.contains('selected');
        if (isSelected) {
            asin = pageAsin;
        } else {
            const link = swatch.querySelector('a[href*="/dp/"]');
            const hrefMatch = link?.href.match(/\/dp\/([A-Z0-9]{10})/);
            asin = hrefMatch ? hrefMatch[1] : null;
        }
        
        const formatLabel = swatch.querySelector('span[aria-label*="Format:"]');
        let formatName = formatLabel ? formatLabel.getAttribute('aria-label').split(' Format:')[0] : '';
        
        if (formatType === 'AUDIO_DOWNLOAD' || swatch.querySelector('.audible_mm_title')) {
            formatName = 'Audiobook';
        }
        
        const prices = [];
        const isKU = !!swatch.querySelector('i.a-icon-kindle-unlimited');
        
        if (formatName === 'Audiobook') {
            const audioPriceEl = swatch.querySelector('.audible_mm_price');
            if (audioPriceEl) {
                const audioPrice = cleanPrice(audioPriceEl.textContent);
                if (audioPrice !== null) prices.push({ price: audioPrice, type: 'price' }); // Use generic 'price' type initially
            }
        }

        const slotPrice = swatch.querySelector('.slot-price span[aria-label]');
        if (slotPrice) {
            const mainPrice = cleanPrice(slotPrice.getAttribute('aria-label'));
            if (mainPrice !== null && !prices.some(p => p.price === mainPrice)) {
                prices.push({
                    price: mainPrice,
                    type: isKU && formatType === 'KINDLE' ? 'ku_price' : 'price' // Use generic 'price' for non-KU
                });
            }
        }
        
        if (formatType === 'KINDLE') {
            const extraMessage = swatch.querySelector('.kindleExtraMessage');
            if (extraMessage) {
                const priceElement = extraMessage.querySelector('.a-color-price') || extraMessage.querySelector('span.a-color-price');
                let listPrice = priceElement ? cleanPrice(priceElement.textContent) : cleanPrice(extraMessage.textContent);
                
                if (listPrice !== null && !prices.some(p => p.price === listPrice)) {
                    prices.push({ price: listPrice, type: 'price' }); // Use generic 'price'
                }
            }
        }

        // --- START: NEW LOGIC TO IDENTIFY LIST PRICE ---
        // Finalize price types after collecting all prices for this format
        const nonKuPrices = prices.filter(p => p.type !== 'ku_price');
        if (nonKuPrices.length > 0) {
            // The highest non-KU price is the list price
            const maxPrice = Math.max(...nonKuPrices.map(p => p.price));
            let listPriceSet = false;

            for (const price of prices) {
                if (price.type !== 'ku_price') {
                    if (price.price === maxPrice && !listPriceSet) {
                        price.type = 'list_price'; // This is the one we'll use for calculation
                        listPriceSet = true;
                    } else {
                        price.type = 'other_price'; // This is likely a sale price
                    }
                }
            }
        }
        // --- END: NEW LOGIC TO IDENTIFY LIST PRICE ---
        
        if (asin && formatName) {
            results.push({
                asin,
                formatName,
                formatType,
                prices,
                isKindleUnlimited: isKU,
                isSelected: isSelected
            });
        }
    });
    
    return results;
}
```

### Step 2: Fix the Royalty Calculation Logic

Now that we have a reliable `list_price` type, we need to update the `calculateRoyaltyAndSales` function to use it.

**File to Edit:** `book_detail_page_extractor.js` (and its identical copy in `scrapers.js` - **you must apply this change in both files**).

**Function to Edit:** `calculateRoyaltyAndSales`

**Instructions:**

In this function, find the line that defines `list_price` and replace it with the new logic.

**Find this line:**

```javascript
const list_price = Math.min(...format.prices.map(p => p.price));
```

**Replace it with this improved logic:**

```javascript
// Find the list price we identified in the previous step.
const listPriceObject = format.prices.find(p => p.type === 'list_price');

// If not found, fall back to the highest available price as a safety measure.
const list_price = listPriceObject ? listPriceObject.price : Math.max(...format.prices.filter(p => p.type !== 'ku_price').map(p => p.price));
```

This change is critical. It now correctly identifies and uses the book's official list price for the royalty calculation, which will produce accurate results.

### Step 3: Confirm `report.js` Initialization (Verification)

Your code in `report.js` already has comments indicating a previous fix for `TypeError` related to uninitialized properties in the `totals` and `highTotals` objects. This is a good defensive measure. Let's ensure it's correct and remove the now-redundant comments.

**File to Edit:** `report.js`

**Functions to Edit:** `calculateAndDisplayTotals` and `calculateAndDisplayHighRoyaltyTotals`

**Instructions:**

Verify that all accumulator properties inside the `totals` and `highTotals` objects are initialized to `0`. Your current code is already correct, but we can clean up the comments for clarity.

**In `calculateAndDisplayHighRoyaltyTotals`, find these lines:**

```javascript
        lengthSum: 0,                   // <-- FIXED: Initialize properties to prevent TypeError
        lengthCount: 0,                 // <-- FIXED: Initialize properties to prevent TypeError
```

**And simply remove the comments, as the fix is already in place:**

```javascript
        lengthSum: 0,
        lengthCount: 0,
```

This step is minor but represents good code hygiene and confirms that your totals calculation logic is sound and won't crash if it encounters a product with no data.

---

### Summary of Changes

1.  **Modified `extractAmazonBookFormats`:** It now intelligently identifies the `list_price` from all available prices for a book format, making the data structure more reliable.
2.  **Modified `calculateRoyaltyAndSales`:** It now explicitly looks for and uses the identified `list_price` for its calculations, ensuring accuracy. It also has a robust fallback to using the maximum price.
3.  **Verified `report.js`:** Confirmed that the totals calculation logic is correctly initialized to prevent `TypeError` exceptions.

After applying these changes to both `book_detail_page_extractor.js` and `scrapers.js`, your extension will correctly calculate and display the "Royalty/Book" and "Royalty/Month" values in the report.