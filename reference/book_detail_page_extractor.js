/**
 * Unified Amazon Product Page Extractor
 *
 * Extracts a comprehensive set of data from a single Amazon product page.
 * This version is robust across international domains and includes all final
 * data cleaning, normalization, and extraction enhancements.
 *
 */

function runFullProductPageExtraction() {
    console.log("🚀 Starting Full Amazon Product Page Extraction...");

    // Helper functions
    const cleanText = (text) => text?.replace(/[\s\u200F\u200E]+/g, ' ').trim() || null;
    const getText = (el, selector) => el ? cleanText(el.querySelector(selector)?.textContent) : null;
    const getAttr = (el, selector, attr) => el?.querySelector(selector)?.getAttribute(attr) || null;
    const normalizeDate = (dateString) => {
        if (!dateString) return null;
        try {
            const cleanDateString = dateString.replace(/(\w{3})\./, '$1');
            const date = new Date(cleanDateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toISOString().split('T')[0];
        } catch (e) { return dateString; }
    };

    function extractProductDetails() {
        const details = { 
            bsr: null, bsr_category: null, bsr_sub_categories: [], 
            print_length: null, publication_date: null, 
            publisher: null, self_published: false,
            new_release: null, days_on_market: null,
            dimensions: { height: null, width: null, depth: null, unit: null },
            large_trim: false
        };
        const detailContainer = document.querySelector("#detailBullets_feature_div, #productDetails_feature_div");

        if (detailContainer) {
            const findDetailValue = (label) => {
                const labelEl = [...detailContainer.querySelectorAll('.a-text-bold, th')].find(
                    el => el.textContent.trim().startsWith(label)
                );
                if (!labelEl) return null;
                const valueEl = labelEl.nextElementSibling || labelEl.closest('tr')?.querySelector('td:last-child');
                return valueEl ? cleanText(valueEl.textContent) : null;
            };

            const publisherText = findDetailValue("Publisher");
            if (publisherText) {
                const publisherName = publisherText.split('(')[0].trim();
                details.publisher = publisherName;
                details.self_published = publisherName.toLowerCase() === 'independently published';
            }

            let pubDateText = findDetailValue("Publication date");
            if (!pubDateText && publisherText) {
                 const dateMatch = publisherText.match(/\(([^)]+)\)/);
                 if (dateMatch) pubDateText = dateMatch[1];
            }
            const normalizedDate = normalizeDate(pubDateText);
            details.publication_date = normalizedDate;
            if (normalizedDate) {
                const pubDate = new Date(normalizedDate);
                const today = new Date();
                pubDate.setUTCHours(0, 0, 0, 0);
                today.setUTCHours(0, 0, 0, 0);
                const timeDiff = today.getTime() - pubDate.getTime();
                const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
                details.days_on_market = daysDiff;
                details.new_release = daysDiff >= 0 && daysDiff <= 30;
            }

            const dimensionsText = findDetailValue("Dimensions");
            if (dimensionsText) {
                const numbers = dimensionsText.match(/(\d+\.?\d*)/g);
                if (numbers && numbers.length === 3) {
                    const sortedDims = numbers.map(parseFloat).sort((a, b) => b - a);
                    details.dimensions.height = sortedDims[0];
                    details.dimensions.width = sortedDims[1];
                    details.dimensions.depth = sortedDims[2];
                    const unitMatch = dimensionsText.match(/inches|cm/i);
                    details.dimensions.unit = unitMatch ? unitMatch[0].toLowerCase() : null;

                    const { height, width, unit } = details.dimensions;
                    if (unit === 'inches') {
                        if (width > 6.12 || height > 9) {
                            details.large_trim = true;
                        }
                    } else if (unit === 'cm') {
                        if (width > 15.54 || height > 22.86) {
                            details.large_trim = true;
                        }
                    }
                }
            }
            
            const printLengthText = findDetailValue("Print length");
            if (printLengthText) {
                details.print_length = parseInt(printLengthText.match(/\d+/)[0], 10);
            }
        }
        
        try {
            const parentDiv = document.getElementById('detailBulletsWrapper_feature_div');
            const childDiv = parentDiv.querySelector('#detailBullets_feature_div');
            const siblingUl = childDiv.nextElementSibling;
            const aElement = siblingUl.querySelector('a');
            const mainText = aElement.previousSibling;
            const bsrMatch = mainText.textContent.match(/\d*,?\d+,?\d*/);
            details.bsr = bsrMatch ? parseInt(bsrMatch[0].replace(/,/g, ''), 10) : null;
            const categoryMatch = mainText.textContent.match(/(?<=in\s).+?(?=\s\()/);
            details.bsr_category = categoryMatch ? categoryMatch[0] : null;
            const subCategories = aElement.nextElementSibling;
            const subCategoryResults = [];
            for (let li of subCategories.children) {
                const text = li.textContent.trim();
                const link = li.querySelector('a');
                if (link) {
                    const numberMatch = text.match(/\d*,?\d+,?\d*/);
                    subCategoryResults.push({
                        rank: numberMatch ? parseInt(numberMatch[0].replace(/,/g, ''), 10) : null,
                        link: link.getAttribute('href'),
                        name: link.textContent.trim()
                    });
                }
            }
            details.bsr_sub_categories = subCategoryResults;
        } catch (e) {
            // This can fail gracefully if BSR details aren't present
        }

        return details;
    }

    function extractBadgeStatus() {
        const badgeLink = document.querySelector('a.badge-link, #zeitgeistBadge_feature_div a');
        if (!badgeLink) return 'absent';
        const text = cleanText(badgeLink.textContent);
        if (text.includes('Best Seller')) return 'bestseller';
        if (text.includes('New Release')) return 'new-release';
        if (text.includes('Amazon Charts') || text.includes('this week')) return 'amazon-charts';
        return 'unknown';
    }

    function extractAplusContent() {
        const modules = [];
        const aplusContainer = document.querySelector('#aplus_feature_div, #aplus, .aplus-v2');
        
        // If the A+ container is not found, return the empty modules array and a count of 0.
        if (!aplusContainer) {
            return { modules, modulesCount: modules.length };
        }

        aplusContainer.querySelectorAll('.aplus-module').forEach((module, index) => {
            const section = { moduleIndex: index + 1, images: [], text: [] };
            module.querySelectorAll('img').forEach(img => {
                let imgSrc = img.dataset.src || img.getAttribute('data-a-dynamic-image') || img.src;
                if (imgSrc && imgSrc.startsWith('{')) { try { imgSrc = Object.keys(JSON.parse(imgSrc))[0]; } catch (e) {} }
                if (imgSrc && !imgSrc.includes('grey-pixel.gif')) {
                     section.images.push({ src: imgSrc, alt: cleanText(img.alt) || '' });
                }
            });
            const textFragments = [];
            module.querySelectorAll('h3, h4, p, li, span').forEach(el => {
                const text = cleanText(el.textContent);
                if (text && text.length > 5 && !/^[.{#]/.test(text) && !text.includes('__CR')) textFragments.push(text);
            });
            section.text = [...new Set(textFragments)];
            if (section.images.length > 0 || section.text.length > 0) modules.push(section);
        });

        // Return the extracted modules and their count.
        return { modules, modulesCount: modules.length };
    }
    

    function extractEditorialReviews() {
        // Find the top-level container for editorial reviews.
        const editorialDiv = document.querySelector('#editorialReviews_feature_div');
        if (!editorialDiv) return null;

        // Get the main title from the h2 element.
        const mainTitleEl = editorialDiv.querySelector('h2');
        // Use a fallback title in case the h2 is missing for some reason.
        const mainTitle = mainTitleEl ? mainTitleEl.textContent.trim() : 'Editorial Reviews'; 
        
        // First, try the primary selector for the expander container.
        // If it returns null, the || operator will automatically try the fallback selector.
        const contentContainer = 
            editorialDiv.querySelector('.a-row.a-expander-container.a-expander-extend-container') ||
            editorialDiv.querySelector('.a-section.a-spacing-small.a-padding-base');

        // If both selectors failed, we can't proceed.
        if (!contentContainer) return null;
        
        const reviews = {};
        let currentSubTitle = null;

        // Loop through the direct children of whichever container was found.
        for (const child of contentContainer.children) {
            // If the child is an H3, it's a new subtitle.
            if (child.tagName === 'H3') {
                currentSubTitle = child.textContent.trim();
            } 
            // If it's a content div and we have a pending subtitle, pair them.
            else if (currentSubTitle && child.tagName === 'DIV') {
                const content = child.textContent.trim();
                if (content) {
                    reviews[currentSubTitle] = content;
                    currentSubTitle = null; // Reset to find the next pair.
                }
            }
        }

        // Return null if no valid reviews were extracted.
        if (Object.keys(reviews).length === 0) {
            return null;
        }

        // Return the structured object with the main title as the key.
        return { [mainTitle]: reviews };
    }


    function extractAuthorInfo() {
        // This selector for byline authors is stable and does not need changes.
        const bylineAuthors = [...document.querySelectorAll('#bylineInfo .author a.a-link-normal')]
            .map(a => cleanText(a.textContent))
            .filter(Boolean);

        // Use a more robust selector for the main author card container.
        // It combines a stable part of the ID with a stable part of the class name.
        const authorCard = document.querySelector('div[id^="CardInstance"][class*="_about-the-author-card_style_cardParentDiv"]');
        
        let biography = null, imageUrl = null, cardAuthorName = null;

        if (authorCard) {
            // Extract biography using a selector that ignores the unique hash.
            biography = getText(authorCard, 'div[class*="_peekableContent"]');
            if (biography?.includes("Discover more of the author's books")) {
                biography = null;
            }
            
            // Extract image URL using a stable class selector.
            imageUrl = getAttr(authorCard, 'img[class*="_authorImage"]', 'src');

            // Extract the author's name using a more specific and stable selector, avoiding generic tags like 'h2'.
            cardAuthorName = getText(authorCard, 'div[class*="_authorName"] a');
        }
        
        // Prioritize byline authors if they exist, otherwise use the name from the card.
        const authorName = bylineAuthors.length > 0 ? bylineAuthors.join(', ') : cardAuthorName;
        
        if (!authorName) return null;
        
        // Check if the image is the default placeholder.
        const validImage = imageUrl && imageUrl !== "https://m.media-amazon.com/images/I/01Kv-W2ysOL._SY600_.png";
        
        // Count words in the biography.
        const bioWordCount = biography ? biography.trim().split(/\s+/).length : 0;
        
        return { 
            name: authorName, 
            biography, 
            imageUrl, 
            validImage, 
            bioWordCount 
        };
    }
    
    function extractCustomerReviews() {
        const reviews = [];
        document.querySelectorAll('[data-hook="review"]').forEach(reviewEl => {
            const ratingMatch = getText(reviewEl, '[data-hook*="review-star-rating"]')?.match(/(\d+\.?\d*)/);
            const dateMatch = getText(reviewEl, '.review-date')?.match(/Reviewed in (.+?) on (.+)/);
            reviews.push({
                reviewerName: getText(reviewEl, '.a-profile-name'),
                title: getText(reviewEl, '.review-title-content')?.replace(/^\d+\.?\d*\s+out\s+of\s+\d+\s+stars\s*/i, '').trim(),
                rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
                date: dateMatch ? normalizeDate(dateMatch[2]) : null,
                country: dateMatch ? cleanText(dateMatch[1].replace(/^the\s+/i, '')) : null,
                text: getText(reviewEl, '.review-text-content'),
                verified: !!reviewEl.querySelector('[data-hook="avp-badge-linkless"]')
            });
        });
        return reviews;
    }

    function getReviewImageCount() {
        const firstCard = document.querySelector('#cm_cr_carousel_images_section .a-carousel-card[aria-setsize]');
        return firstCard ? parseInt(firstCard.getAttribute('aria-setsize')) : document.querySelectorAll('#cm_cr_carousel_images_section .a-carousel-card').length;
    }

    function extractBadgeStatus() {
        const badgeLink = document.querySelector('a.badge-link, #zeitgeistBadge_feature_div a');
        if (!badgeLink) return 'absent';
        const text = cleanText(badgeLink.textContent);
        if (text.includes('Best Seller')) return 'bestseller';
        if (text.includes('New Release')) return 'new-release';
        if (text.includes('Amazon Charts') || text.includes('this week')) return 'amazon-charts';
        return 'unknown';
    }

    function extractUgcVideos() {
        const results = {
            videos: [],
            video_count: 0
        };

        try {
            const widget = document.querySelector('div[id="va-related-videos-widget_feature_div"]');
            if (!widget) {
                return results; // Return empty results if the widget isn't found
            }

            const videoSlides = widget.querySelectorAll('li[aria-roledescription="slide"]');

            // Helper to construct a full URL from a potentially relative path
            const makeAbsoluteUrl = (path) => {
                if (!path || path.startsWith('http')) {
                    return path; // Return as-is if it's null, empty, or already absolute
                }
                // Use the page's origin to build a full URL
                return new URL(path, window.location.origin).href;
            };

            videoSlides.forEach(li => {
                const videoContainerDiv = li.firstElementChild;
                if (!videoContainerDiv) return; // Skip if the slide has no content div

                results.videos.push({
                    title: videoContainerDiv.dataset.title || null,
                    creatorName: videoContainerDiv.dataset.publicName || null,
                    creatorProfileUrl: makeAbsoluteUrl(videoContainerDiv.dataset.profileLink),
                    duration: videoContainerDiv.dataset.formattedDuration || null,
                    uploadDate: videoContainerDiv.dataset.videoAge || null,
                    videoUrl: makeAbsoluteUrl(videoContainerDiv.dataset.vdpUrl)
                });
            });

            results.video_count = results.videos.length;

        } catch (e) {
            console.warn("Could not extract UGC videos.", e);
        }

        return results;
    }

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
                    if (audioPrice !== null) prices.push({ price: audioPrice, type: 'list_price' });
                }
            }

            const slotPrice = swatch.querySelector('.slot-price span[aria-label]');
            if (slotPrice) {
                const mainPrice = cleanPrice(slotPrice.getAttribute('aria-label'));
                if (mainPrice !== null && !prices.some(p => p.price === mainPrice)) {
                    prices.push({
                        price: mainPrice,
                        type: isKU && formatType === 'KINDLE' ? 'ku_price' : 'list_price'
                    });
                }
            }
            
            if (formatType === 'KINDLE') {
                const extraMessage = swatch.querySelector('.kindleExtraMessage');
                if (extraMessage) {
                    const priceElement = extraMessage.querySelector('.a-color-price') || extraMessage.querySelector('span.a-color-price');
                    let listPrice = priceElement ? cleanPrice(priceElement.textContent) : cleanPrice(extraMessage.textContent);
                    
                    if (listPrice !== null && !prices.some(p => p.price === listPrice)) {
                        prices.push({ price: listPrice, type: 'list_price' });
                    }
                }
            }
            
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

    function extractAverateRating(){
        let average_rating = null;
        try {
            const ratingText = document.querySelector('div[id="averageCustomerReviews"] a')?.firstElementChild?.textContent?.trim();
            if (ratingText) {
                average_rating = parseFloat(ratingText);
                if (isNaN(average_rating)) average_rating = null;
            }
        } catch(e) {
            console.warn("Could not extract average rating.", e);
        }
        return average_rating;
    }
    
    function extractReviewCount(){
        let review_count = null;
        try {
            const reviewCountAriaLabel = document.querySelector('span[id="acrCustomerReviewText"]')?.ariaLabel;
            if (reviewCountAriaLabel) {
                const countStr = reviewCountAriaLabel.split(" ", 2)[0].replaceAll(",", "");
                review_count = parseInt(countStr, 10);
                if (isNaN(review_count)) review_count = null;
            }
        } catch(e) {
            console.warn("Could not extract review count.", e);
        }
        return review_count;
    }

    // --- START: ROYALTY & SALES CALCULATION FUNCTIONS (Refactored) ---

    // --- 1. Sales Estimator Logic ---
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
    function getMultiplier(type, market) { return multipliers[type]?.[market] ?? 1; }
    function estimateSales(bsr, bookType, market) {
      if (!Number.isFinite(bsr) || bsr < 1) return 0;
      return Math.max(0, 1.37 * coreUnits(bsr) * getMultiplier(bookType, market));
    }

    // --- 2. Royalty Calculator Logic ---
    const royaltyThresholds_by_code = { USD: 9.99, DE: 9.99, FR: 9.99, IT: 9.99, ES: 9.99, NL: 9.99, GBP: 7.99, CAD: 13.99, AUD: 13.99, YEN: 1000, PL: 40, SE: 99 };
    
    function getMarketplaceInfo() {
        const hostname = window.location.hostname;
        const tldMap = {
            'amazon.com': { code: 'USD' }, 'amazon.ca': { code: 'CAD' }, 'amazon.co.uk': { code: 'GBP' },
            'amazon.de': { code: 'DE' }, 'amazon.fr': { code: 'FR' }, 'amazon.it': { code: 'IT' },
            'amazon.es': { code: 'ES' }, 'amazon.nl': { code: 'NL' }, 'amazon.com.au': { code: 'AUD' },
            'amazon.co.jp': { code: 'YEN' }, 'amazon.pl': { code: 'PL' }, 'amazon.se': { code: 'SE' }
        };
        for (const key in tldMap) {
            if (hostname.includes(key)) return tldMap[key];
        }
        return { code: 'USD' }; // Default fallback
    }

    function calculateRoyaltyAndSales(format, productDetails, marketplaceInfo) {
        const book_type = format.formatName.toLowerCase();
        if (!format.prices || format.prices.length === 0) return { error: "No price found for this format." };
        const list_price = Math.min(...format.prices.map(p => p.price));
        
        const page_count = productDetails.print_length;
        const bsr = productDetails.bsr;
        if (!list_price || !page_count || !bsr) return { error: "Missing essential data (price, page count, or BSR)." };

        const market_code = marketplaceInfo.code;
        const trim_size = productDetails.large_trim ? 'large' : 'regular';
        const interior_type = 'Black Ink'; // Assumption
        const eu_market_codes = ['DE', 'FR', 'IT', 'ES', 'NL'];
        const marketKey = eu_market_codes.includes(market_code) ? 'EU' : market_code;

        let printing_cost = 0;
        let is_supported = true;

        if (book_type === 'paperback') {
            if (page_count >= 24 && page_count <= 108) {
                const costs = { USD: 2.30, CAD: 2.99, YEN: 422, GBP: 1.93, AUD: 4.74, EU: 2.05, PL: 9.58, SE: 22.84 };
                const largeCosts = { USD: 2.84, CAD: 3.53, YEN: 530, GBP: 2.15, AUD: 5.28, EU: 2.48, PL: 11.61, SE: 27.67 };
                printing_cost = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
            } else if (page_count >= 110 && page_count <= 828) {
                const costs = { USD: [1.00, 0.012], CAD: [1.26, 0.016], YEN: [206, 2], GBP: [0.85, 0.010], AUD: [2.42, 0.022], EU: [0.75, 0.012], PL: [3.51, 0.056], SE: [8.37, 0.134] };
                const largeCosts = { USD: [1.00, 0.017], CAD: [1.26, 0.021], YEN: [206, 3], GBP: [0.85, 0.012], AUD: [2.42, 0.027], EU: [0.75, 0.016], PL: [3.51, 0.075], SE: [8.37, 0.179] };
                const [fixed, perPage] = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                printing_cost = fixed + (page_count * perPage);
            } else { is_supported = false; }
        } else if (book_type === 'hardcover') {
            if (page_count >= 75 && page_count <= 108) {
                const costs = { USD: 6.80, GBP: 5.23, EU: 5.95, PL: 27.85, SE: 66.38 };
                const largeCosts = { USD: 7.49, GBP: 5.45, EU: 6.35, PL: 29.87, SE: 71.21 };
                if (costs[marketKey]) { printing_cost = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey]; } else { is_supported = false; }
            } else if (page_count >= 110 && page_count <= 550) {
                const costs = { USD: [5.65, 0.012], GBP: [4.15, 0.010], EU: [4.65, 0.012], PL: [20.34, 0.056], SE: [48.49, 0.134] };
                const largeCosts = { USD: [5.65, 0.017], GBP: [4.15, 0.012], EU: [4.65, 0.016], PL: [20.34, 0.075], SE: [48.49, 0.179] };
                if (costs[marketKey]) { const [fixed, perPage] = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey]; printing_cost = fixed + (page_count * perPage); } else { is_supported = false; }
            } else { is_supported = false; }
        } else { is_supported = false; }

        if (!is_supported || !printing_cost) return { error: `Combination not supported (Type: ${book_type}, Pages: ${page_count})` };
        printing_cost = parseFloat(printing_cost.toFixed(2));

        let royalty_rate = 0.6;
        const threshold = royaltyThresholds_by_code[market_code];
        if (threshold && list_price < threshold) royalty_rate = 0.5;

        let VAT = 0, price_after_vat = list_price;
        if (eu_market_codes.includes(market_code)) {
            let vat_rate = 0.07; // DE, NL
            if (market_code === "FR") vat_rate = 0.055;
            if (["IT", "ES"].includes(market_code)) vat_rate = 0.04;
            VAT = list_price * vat_rate;
            price_after_vat = list_price - VAT;
        }
        
        const royalty_amount = price_after_vat * royalty_rate - printing_cost;
        const daily_sales = estimateSales(bsr, book_type, market_code);
        const monthly_sales = Math.round(daily_sales * 30);
        const monthly_royalty = royalty_amount > 0 ? royalty_amount * monthly_sales : 0;

        return {
            royalty_per_unit: parseFloat(royalty_amount.toFixed(2)),
            monthly_sales: monthly_sales,
            monthly_royalty: parseFloat(monthly_royalty.toFixed(2)),
            calculation_assumptions: {
                interior_type: interior_type, list_price_used: list_price,
                royalty_rate_used: royalty_rate, printing_cost: printing_cost,
                bsr_used: bsr, vat_applied: parseFloat(VAT.toFixed(2))
            }
        };
    }
    // --- END: ROYALTY & SALES CALCULATION FUNCTIONS ---

    // --- Main Execution ---
    const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
    if (!asinMatch) {
        console.error("Could not find ASIN in the URL. Make sure you are on a product page.");
        return;
    }
    const fullProductData = {
        asin: asinMatch[1],
        title: document.querySelector('span[id="productTitle"]')?.textContent.trim() || null,
        cover_url: document.querySelector('img[id="landingImage"]')?.src || null,
        badge_status: extractBadgeStatus(),
        product_details: extractProductDetails(),
        formats: extractAmazonBookFormats(),
        aplus_content: extractAplusContent(),
        editorial_reviews: extractEditorialReviews(),
        author_info: extractAuthorInfo(),
        ugc_videos: extractUgcVideos(),
        customer_reviews: {
            average_rating: extractAverateRating(),
            review_count: extractReviewCount(),
            review_image_count: getReviewImageCount(),
            reviews_on_page: extractCustomerReviews()
        },
        royalties: null // Placeholder 
    };

    // --- INTEGRATE PAGE-SPECIFIC PROFITABILITY CALCULATION ---
    const currentFormat = fullProductData.formats.find(f => f.isSelected);
    if (currentFormat) {
        console.log(`📊 Current format is "${currentFormat.formatName}". Running profitability calculation...`);
        const marketplaceInfo = getMarketplaceInfo();
        
        // Only calculate for physical books
        const formatNameLower = currentFormat.formatName.toLowerCase();
        if (formatNameLower === 'paperback' || formatNameLower === 'hardcover') {
            fullProductData.royalties = calculateRoyaltyAndSales(
                currentFormat,
                fullProductData.product_details,
                marketplaceInfo
            );
        } else {
             console.log(`-- Profitability calculation skipped for non-physical format: "${currentFormat.formatName}".`);
        }
    } else {
        console.warn("Could not determine the currently selected format on the page.");
    }
    
    console.log("✅ Extraction Complete!");
    return fullProductData;
}

runFullProductPageExtraction();