/**
 * Product Page Extractor Module
 * Extracts detailed information from Amazon book product pages
 */

import {
    getMarketplaceInfo,
    calculateRoyaltyAndSales
} from './royalty-calculator.js';

// Helper functions
const cleanText = (text) => text?.replace(/[\s\u200F\u200E]+/g, ' ').trim() || null;
const getText = (el, selector) => el ? cleanText(el.querySelector(selector)?.textContent) : null;
const getAttr = (el, selector, attr) => el?.querySelector(selector)?.getAttribute(attr) || null;

const normalizeDate = (dateString) => {
    if (!dateString) return null;
    try {
        const cleanedString = dateString.replace(/[\s\u200F\u200E\u202A\u202B\u202C\u202D\u202E]+/g, ' ').trim();
        const cleanDateString = cleanedString.replace(/(\w{3,4})\.(?=\s)/g, '$1');
        const date = new Date(cleanDateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toISOString().split('T')[0];
    } catch (e) {
        return dateString;
    }
};

/**
 * Extract product details (BSR, page count, publisher, etc.)
 */
function extractProductDetails() {
    console.log("scrapers.js: Starting extractProductDetails.");
    const details = {
        bsr: null, bsr_category: null, bsr_sub_categories: [],
        print_length: null, publication_date: null,
        publisher: null, self_published: false,
        new_release: null, days_on_market: null,
        dimensions: { height: null, width: null, depth: null, unit: null },
        large_trim: false
    };

    const detailContainer = document.querySelector("#detailBullets_feature_div, #productDetails_feature_div");
    console.log("scrapers.js: Detail container found:", !!detailContainer);

    if (detailContainer) {
        const findDetailValue = (label) => {
            console.log(`scrapers.js: Searching for detail: "${label}"`);
            const labelEl = [...detailContainer.querySelectorAll('.a-text-bold, th')].find(
                el => cleanText(el.textContent).startsWith(label)
            );
            if (!labelEl) {
                console.log(`scrapers.js: Label "${label}" not found.`);
                return null;
            }
            const valueEl = labelEl.nextElementSibling || labelEl.closest('tr')?.querySelector('td:last-child');
            const value = valueEl ? cleanText(valueEl.textContent) : null;
            console.log(`scrapers.js: Found value for "${label}":`, value);
            return value;
        };

        // Publisher extraction
        const publisherText = findDetailValue("Publisher");
        if (publisherText) {
            const publisherName = publisherText.split('(')[0].trim();
            details.publisher = publisherName;
            details.self_published = publisherName.toLowerCase() === 'independently published';
            console.log("scrapers.js: Extracted Publisher:", details.publisher, "Self-published:", details.self_published);
        }

        // Publication date extraction
        let pubDateText = findDetailValue("Publication date");
        if (!pubDateText && publisherText) {
            const dateMatch = publisherText.match(/\(([^)]+)\)/);
            if (dateMatch) pubDateText = dateMatch[1];
            console.log("scrapers.js: Found publication date from publisher string:", pubDateText);
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
            console.log("scrapers.js: Calculated Days on Market:", details.days_on_market, "New Release:", details.new_release);
        }

        // Dimensions extraction
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
                console.log("scrapers.js: Extracted Dimensions:", details.dimensions);

                const { height, width, unit } = details.dimensions;
                if (unit === 'inches') {
                    details.large_trim = width > 6.12 || height > 9;
                } else if (unit === 'cm') {
                    details.large_trim = width > 15.54 || height > 22.86;
                }
                console.log("scrapers.js: Determined Large Trim:", details.large_trim);
            }
        }

        // Print length extraction
        const printLengthText = findDetailValue("Print length");
        if (printLengthText) {
            details.print_length = parseInt(printLengthText.match(/\d+/)[0], 10);
            console.log("scrapers.js: Extracted Print Length:", details.print_length);
        }
    }

    // BSR extraction
    console.log("scrapers.js: Attempting BSR extraction.");
    try {
        let aElement = document.querySelector('div[id="detailBulletsWrapper_feature_div"] a[href*="gp/bestseller"]');
        if (!aElement) {
            const parentDiv = document.getElementById('detailBulletsWrapper_feature_div');
            if (parentDiv) {
                const childDiv = parentDiv.querySelector('#detailBullets_feature_div');
                if (childDiv) {
                    const siblingUl = childDiv.nextElementSibling;
                    if (siblingUl) aElement = siblingUl.querySelector('a');
                }
            }
        }

        console.log("scrapers.js: BSR aElement found:", !!aElement);
        if (aElement) {
            const mainText = aElement.previousSibling;
            console.log("scrapers.js: BSR mainText content:", mainText ? mainText.textContent : "N/A");
            const bsrMatch = mainText.textContent.match(/\d*,?\d+,?\d*/);
            details.bsr = bsrMatch ? parseInt(bsrMatch[0].replace(/,/g, ''), 10) : null;
            console.log("scrapers.js: Extracted BSR:", details.bsr);
            const categoryMatch = mainText.textContent.match(/(?<=in\s).+?(?=\s\()/);
            details.bsr_category = categoryMatch ? categoryMatch[0] : null;
            console.log("scrapers.js: Extracted BSR Category:", details.bsr_category);

            const subCategories = aElement.nextElementSibling;
            const subCategoryResults = [];
            if (subCategories) {
                console.log("scrapers.js: Extracting sub-categories.");
                for (let li of subCategories.children) {
                    const text = li.textContent.trim();
                    const link = li.querySelector('a');
                    if (link) {
                        const numberMatch = text.match(/\d*,?\d+,?\d*/);
                        const url = link.getAttribute('href').split('/ref=')[0];
                        const name = link.textContent.trim().replace(/\s\(Books\)$/, '');
                        subCategoryResults.push({
                            rank: numberMatch ? parseInt(numberMatch[0].replace(/,/g, ''), 10) : null,
                            link: url,
                            name: name
                        });
                    }
                }
                details.bsr_sub_categories = subCategoryResults;
                console.log("scrapers.js: Extracted Sub-Categories:", details.bsr_sub_categories);
            }
        }
    } catch (e) {
        console.warn("scrapers.js: BSR extraction failed gracefully.", e.message);
    }

    console.log("scrapers.js: Finished extractProductDetails. Final details:", details);
    return details;
}

/**
 * Extract badge status (bestseller, new release, etc.)
 */
function extractBadgeStatus() {
    const badgeLink = document.querySelector('a.badge-link, #zeitgeistBadge_feature_div a');
    if (!badgeLink) return 'absent';
    const text = cleanText(badgeLink.textContent);
    if (text.includes('Best Seller')) return 'bestseller';
    if (text.includes('New Release')) return 'new-release';
    if (text.includes('Amazon Charts') || text.includes('this week')) return 'amazon-charts';
    return 'unknown';
}

/**
 * Extract A+ content modules
 */
function extractAplusContent() {
    console.log("scrapers.js: Starting extractAplusContent.");
    const modules = [];
    const aplusContainer = document.querySelector('#aplus_feature_div, #aplus, .aplus-v2');

    if (!aplusContainer) {
        console.log("scrapers.js: A+ content container not found.");
        return { modules: [], modulesCount: 0 };
    }

    aplusContainer.querySelectorAll('.aplus-module').forEach((module, index) => {
        const section = { moduleIndex: index + 1, images: [], text: [] };
        module.querySelectorAll('img').forEach(img => {
            let imgSrc = img.dataset.src || img.getAttribute('data-a-dynamic-image') || img.src;
            if (imgSrc && imgSrc.startsWith('{')) {
                try { imgSrc = Object.keys(JSON.parse(imgSrc))[0]; } catch (e) {}
            }
            if (imgSrc && !imgSrc.includes('grey-pixel.gif')) {
                section.images.push({ src: imgSrc, alt: cleanText(img.alt) || '' });
            }
        });
        const textFragments = [];
        module.querySelectorAll('h3, h4, p, li, span').forEach(el => {
            const text = cleanText(el.textContent);
            if (text && text.length > 5 && !/^[.{#]/.test(text) && !text.includes('__CR')) {
                textFragments.push(text);
            }
        });
        section.text = [...new Set(textFragments)];
        if (section.images.length > 0 || section.text.length > 0) modules.push(section);
    });

    console.log(`scrapers.js: Finished extractAplusContent. Found ${modules.length} modules.`);
    return { modules, modulesCount: modules.length };
}

/**
 * Extract editorial reviews
 */
function extractEditorialReviews() {
    const editorialDiv = document.querySelector('#editorialReviews_feature_div');
    if (!editorialDiv) return null;

    const mainTitleEl = editorialDiv.querySelector('h2');
    const mainTitle = mainTitleEl ? mainTitleEl.textContent.trim() : 'Editorial Reviews';

    const contentContainer =
        editorialDiv.querySelector('.a-row.a-expander-container.a-expander-extend-container') ||
        editorialDiv.querySelector('.a-section.a-spacing-small.a-padding-base');

    if (!contentContainer) return null;

    const reviews = {};
    let currentSubTitle = null;

    for (const child of contentContainer.children) {
        if (child.tagName === 'H3') {
            currentSubTitle = child.textContent.trim();
        } else if (currentSubTitle && child.tagName === 'DIV') {
            const content = child.textContent.trim();
            if (content) {
                reviews[currentSubTitle] = content;
                currentSubTitle = null;
            }
        }
    }

    if (Object.keys(reviews).length === 0) return null;
    return { [mainTitle]: reviews };
}

/**
 * Extract author information
 */
function extractAuthorInfo() {
    console.log("scrapers.js: Starting extractAuthorInfo extraction");

    const bylineAuthors = [...document.querySelectorAll('#bylineInfo .author a.a-link-normal')]
        .map(a => cleanText(a.textContent))
        .filter(Boolean);
    console.log("scrapers.js: Byline authors found:", bylineAuthors);

    const authorCard = document.querySelector('div[id^="CardInstance"][class*="_about-the-author-card_style_cardParentDiv"]');
    console.log("scrapers.js: Author card found:", !!authorCard);

    let biography = null, imageUrl = null, cardAuthorName = null;

    if (authorCard) {
        biography = getText(authorCard, 'div[class*="_peekableContent"]');
        console.log("scrapers.js: Biography extracted:", biography ? "Found" : "Not found");
        if (biography?.includes("Discover more of the author's books")) {
            biography = null;
            console.log("scrapers.js: Biography cleared (generic message detected)");
        }

        imageUrl = getAttr(authorCard, 'img[class*="_authorImage"]', 'src');
        console.log("scrapers.js: Image URL extracted:", imageUrl ? "Found" : "Not found");

        cardAuthorName = getText(authorCard, 'div[class*="_authorName"] a');
        console.log("scrapers.js: Card author name extracted:", cardAuthorName);
    }

    const authorName = bylineAuthors.length > 0 ? bylineAuthors.join(', ') : cardAuthorName;
    console.log("scrapers.js: Final author name:", authorName);

    if (!authorName) {
        console.warn("scrapers.js: No author name found, returning null");
        return null;
    }

    const validImage = imageUrl && imageUrl !== "https://m.media-amazon.com/images/I/01Kv-W2ysOL._SY600_.png";
    const bioWordCount = biography ? biography.trim().split(/\s+/).length : 0;

    const result = {
        name: authorName,
        biography,
        imageUrl,
        validImage,
        bioWordCount
    };
    console.log("scrapers.js: Final author info result:", result);
    return result;
}

/**
 * Extract customer reviews from page
 */
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

/**
 * Get review image count
 */
function getReviewImageCount() {
    const firstCard = document.querySelector('#cm_cr_carousel_images_section .a-carousel-card[aria-setsize]');
    return firstCard
        ? parseInt(firstCard.getAttribute('aria-setsize'))
        : document.querySelectorAll('#cm_cr_carousel_images_section .a-carousel-card').length;
}

/**
 * Extract UGC videos
 */
function extractUgcVideos() {
    const results = { videos: [], video_count: 0 };

    try {
        const widget = document.querySelector('div[id="va-related-videos-widget_feature_div"]');
        if (!widget) return results;

        const videoSlides = widget.querySelectorAll('li[aria-roledescription="slide"]');

        const makeAbsoluteUrl = (path) => {
            if (!path || path.startsWith('http')) return path;
            return new URL(path, window.location.origin).href;
        };

        videoSlides.forEach(li => {
            const videoContainerDiv = li.firstElementChild;
            if (!videoContainerDiv) return;

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

/**
 * Clean price text and extract numeric value
 */
function cleanPrice(text) {
    if (!text) return null;
    text = text.trim();
    const match = text.match(/(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2}|\d+)/);
    if (!match) return null;

    let priceStr = match[0].replace(/[$,\u20AC\u00A3\u00A5\u20B9\u20A9]/g, '');
    if (priceStr.includes(',') && priceStr.includes('.')) {
        if (priceStr.lastIndexOf(',') > priceStr.lastIndexOf('.')) {
            priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else {
            priceStr = priceStr.replace(/,/g, '');
        }
    } else if (priceStr.includes(',')) {
        const parts = priceStr.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            priceStr = priceStr.replace(',', '.');
        } else {
            priceStr = priceStr.replace(/,/g, '');
        }
    }

    const price = parseFloat(priceStr);
    return isNaN(price) ? null : price;
}

/**
 * Extract book format information
 */
function extractAmazonBookFormats() {
    console.log("scrapers.js: Starting extractAmazonBookFormats.");
    const results = [];
    const pageAsin = window.location.href.match(/\/dp\/([A-Z0-9]{10})/)[1];

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
                if (audioPrice !== null) prices.push({ price: audioPrice, type: 'price' });
            }
        }

        const slotPrice = swatch.querySelector('.slot-price span[aria-label]');
        if (slotPrice) {
            const mainPrice = cleanPrice(slotPrice.getAttribute('aria-label'));
            if (mainPrice !== null && !prices.some(p => p.price === mainPrice)) {
                prices.push({
                    price: mainPrice,
                    type: isKU && formatType === 'KINDLE' ? 'ku_price' : 'price'
                });
            }
        }

        if (formatType === 'KINDLE') {
            const extraMessage = swatch.querySelector('.kindleExtraMessage');
            if (extraMessage) {
                const priceElement = extraMessage.querySelector('.a-color-price') || extraMessage.querySelector('span.a-color-price');
                let listPrice = priceElement ? cleanPrice(priceElement.textContent) : cleanPrice(extraMessage.textContent);

                if (listPrice !== null && !prices.some(p => p.price === listPrice)) {
                    prices.push({ price: listPrice, type: 'price' });
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

    // Add strikethrough list price to selected format
    const listPriceEl = document.querySelector('div[id*="corePriceDisplay"] span[class="a-price a-text-price"] span');
    if (listPriceEl) {
        const listPriceText = listPriceEl.textContent;
        const listPrice = cleanPrice(listPriceText);
        if (listPrice) {
            const selectedFormat = results.find(r => r.isSelected);
            if (selectedFormat && !selectedFormat.prices.some(p => p.price === listPrice)) {
                selectedFormat.prices.push({ price: listPrice, type: 'price' });
            }
        }
    }

    // Process prices for each format
    for (const format of results) {
        if (!format.prices || format.prices.length < 1) continue;

        const nonKuPrices = format.prices.filter(p => p.type !== 'ku_price');
        if (nonKuPrices.length === 0) continue;

        const maxPrice = Math.max(...nonKuPrices.map(p => p.price));

        let listPriceSet = false;
        for (const price of format.prices) {
            if (price.type !== 'ku_price') {
                if (price.price === maxPrice && !listPriceSet) {
                    price.type = 'list_price';
                    listPriceSet = true;
                } else {
                    price.type = 'other_price';
                }
            }
        }
    }

    console.log("scrapers.js: Finished extractAmazonBookFormats. Results:", results);
    return results;
}

/**
 * Extract average rating
 */
function extractAverageRating() {
    let average_rating = null;
    try {
        const ratingText = document.querySelector('div[id="averageCustomerReviews"] a')?.firstElementChild?.textContent?.trim();
        if (ratingText) {
            average_rating = parseFloat(ratingText);
            if (isNaN(average_rating)) average_rating = null;
        }
    } catch (e) {
        console.warn("Could not extract average rating.", e);
    }
    return average_rating;
}

/**
 * Extract review count
 */
function extractReviewCount() {
    let review_count = null;
    try {
        const reviewCountText = document.querySelector('span[id="acrCustomerReviewText"]')?.textContent;
        if (reviewCountText) {
            const countStr = reviewCountText.split(" ")[0].replace(/,/g, "");
            review_count = parseInt(countStr, 10);
            if (isNaN(review_count)) review_count = null;
            console.log("NicheIntel Pro: Extracted review count:", review_count, "from text:", reviewCountText);
        }
    } catch (e) {
        console.warn("Could not extract review count.", e);
    }
    return review_count;
}

/**
 * Run full product page extraction
 */
export function runFullProductPageExtraction() {
    console.log("scrapers.js: Starting runFullProductPageExtraction.");

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
            average_rating: extractAverageRating(),
            review_count: extractReviewCount(),
            review_image_count: getReviewImageCount(),
            reviews_on_page: extractCustomerReviews()
        },
        royalties: null
    };

    // Calculate royalties for supported formats
    const currentFormat = fullProductData.formats.find(f => f.isSelected);
    if (currentFormat) {
        console.log(`Current format is "${currentFormat.formatName}". Running profitability calculation...`);
        const marketplaceInfo = getMarketplaceInfo();
        const formatNameLower = currentFormat.formatName.toLowerCase();
        console.log(`scrapers.js: Format name (lowercase): "${formatNameLower}"`);

        if (formatNameLower.includes('paperback') || formatNameLower.includes('hardcover') ||
            formatNameLower.includes('kindle') || formatNameLower.includes('ebook')) {
            console.log(`scrapers.js: Calculating royalties for ${formatNameLower} format`);
            fullProductData.royalties = calculateRoyaltyAndSales(
                currentFormat,
                fullProductData.product_details,
                marketplaceInfo,
                'scrapers.js'
            );
            console.log(`scrapers.js: Royalty calculation result:`, fullProductData.royalties);
        } else {
            console.log(`scrapers.js: Profitability calculation skipped for non-supported format: "${currentFormat.formatName}"`);
        }
    } else {
        console.warn("scrapers.js: Could not determine the currently selected format on the page.");
        console.log("scrapers.js: Available formats:", fullProductData.formats);

        // Fallback to first available format
        if (fullProductData.formats && fullProductData.formats.length > 0) {
            const fallbackFormat = fullProductData.formats[0];
            const formatNameLower = fallbackFormat.formatName.toLowerCase();
            console.log(`scrapers.js: Using fallback format: "${fallbackFormat.formatName}"`);

            if (formatNameLower.includes('paperback') || formatNameLower.includes('hardcover') ||
                formatNameLower.includes('kindle') || formatNameLower.includes('ebook')) {
                console.log(`scrapers.js: Calculating royalties for fallback ${formatNameLower} format`);
                fullProductData.royalties = calculateRoyaltyAndSales(
                    fallbackFormat,
                    fullProductData.product_details,
                    getMarketplaceInfo(),
                    'scrapers.js'
                );
                console.log(`scrapers.js: Fallback royalty calculation result:`, fullProductData.royalties);
            } else {
                console.log(`scrapers.js: Fallback format also not supported: "${fallbackFormat.formatName}"`);
            }
        } else {
            console.error("scrapers.js: No formats found at all for this product");
        }
    }

    console.log("Extraction Complete!");
    return fullProductData;
}
