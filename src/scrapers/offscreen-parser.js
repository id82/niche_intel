/**
 * Offscreen Parser Module
 * Parses Amazon product page HTML without a live browser tab
 * Used for background/incognito processing via offscreen document
 */

import {
    getMarketplaceInfo,
    estimateSales,
    exceedsKdpPageLimits,
    calculateTraditionalPublishingEstimate,
    calculateSimplifiedRoyalty,
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
 * Extract product details from parsed document
 */
function extractProductDetails(doc, url) {
    console.log("Offscreen: Starting product details extraction for:", url);
    const details = {
        bsr: null, bsr_category: null, bsr_sub_categories: [],
        print_length: null, publication_date: null,
        publisher: null, self_published: false,
        new_release: null, days_on_market: null,
        dimensions: { height: null, width: null, depth: null, unit: null },
        large_trim: false
    };

    const detailContainer = doc.querySelector("#detailBullets_feature_div, #productDetails_feature_div");

    if (detailContainer) {
        const findDetailValue = (label) => {
            const labelEl = [...detailContainer.querySelectorAll('.a-text-bold, th')].find(
                el => cleanText(el.textContent).startsWith(label)
            );
            if (!labelEl) return null;
            const valueEl = labelEl.nextElementSibling || labelEl.closest('tr')?.querySelector('td:last-child');
            return valueEl ? cleanText(valueEl.textContent) : null;
        };

        // Publisher
        const publisherText = findDetailValue("Publisher");
        if (publisherText) {
            const publisherName = publisherText.split('(')[0].trim();
            details.publisher = publisherName;
            details.self_published = publisherName.toLowerCase() === 'independently published';
        }

        // Publication date
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

        // Print length
        const printLengthText = findDetailValue("Print length");
        if (printLengthText) {
            const match = printLengthText.match(/\d+/);
            if (match) details.print_length = parseInt(match[0], 10);
        }

        // Dimensions
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
                    details.large_trim = width > 6.12 || height > 9;
                } else if (unit === 'cm') {
                    details.large_trim = width > 15.54 || height > 22.86;
                }
            }
        }
    }

    // BSR extraction
    console.log("Offscreen: Starting BSR extraction");
    try {
        let aElement = doc.querySelector('div[id="detailBulletsWrapper_feature_div"] a[href*="gp/bestseller"]');

        if (!aElement) {
            const parentDiv = doc.getElementById('detailBulletsWrapper_feature_div');
            if (parentDiv) {
                const childDiv = parentDiv.querySelector('#detailBullets_feature_div');
                if (childDiv) {
                    const siblingUl = childDiv.nextElementSibling;
                    if (siblingUl) aElement = siblingUl.querySelector('a');
                }
            }
        }

        if (aElement) {
            const mainText = aElement.previousSibling;
            if (mainText) {
                const bsrMatch = mainText.textContent.match(/\d*,?\d+,?\d*/);
                if (bsrMatch) {
                    details.bsr = parseInt(bsrMatch[0].replace(/,/g, ''), 10);
                    console.log("Offscreen: Extracted BSR:", details.bsr);
                }
            }
        } else {
            // Fallback
            const bsrTextElement = [...doc.querySelectorAll('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr')]
                .find(el => el.textContent.includes('Best Sellers Rank'));
            if (bsrTextElement) {
                const bsrMatch = bsrTextElement.textContent.match(/#([\d,]+)/);
                if (bsrMatch) {
                    details.bsr = parseInt(bsrMatch[1].replace(/,/g, ''), 10);
                    console.log("Offscreen: Fallback extracted BSR:", details.bsr);
                }
            }
        }
    } catch (e) {
        console.warn("Offscreen: BSR extraction failed:", e.message);
    }

    console.log("Offscreen: Final BSR value:", details.bsr);
    return details;
}

/**
 * Extract book formats from parsed document
 */
function extractAmazonBookFormats(doc, url) {
    const formats = [];
    const pageAsin = url.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    if (!pageAsin) return [];

    const buyBoxContainer = doc.querySelector('#Northstar-Buybox, #corePriceDisplay_desktop_feature_div');

    doc.querySelectorAll('[id^="tmm-grid-swatch-"]').forEach(swatch => {
        const formatSpan = swatch.querySelector('span[aria-label*="Format:"]');
        if (!formatSpan) return;

        let formatName = formatSpan.getAttribute('aria-label')?.replace('Format: ', '').trim();
        if (swatch.querySelector('.audible_mm_title')) formatName = 'Audiobook';
        if (!formatName) return;

        const isSelected = swatch.classList.contains('selected');
        const link = swatch.querySelector('a[href*="/dp/"]');
        const asin = isSelected ? pageAsin : link?.getAttribute('href')?.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
        if (!asin) return;

        const prices = [];
        const isKU = !!swatch.querySelector('i.a-icon-kindle-unlimited');

        // Price extraction for selected format from buy box
        if (isSelected && buyBoxContainer) {
            const wholePart = buyBoxContainer.querySelector('.a-price-whole');
            const fractionPart = buyBoxContainer.querySelector('.a-price-fraction');
            if (wholePart && fractionPart) {
                const reconstructedPrice = wholePart.textContent.trim() + fractionPart.textContent.trim();
                const price = cleanPrice(reconstructedPrice);
                if (price !== null) prices.push({ price, type: 'price' });
            }

            const offscreenPrice = buyBoxContainer.querySelector('.aok-offscreen, .a-offscreen');
            if (offscreenPrice) {
                const price = cleanPrice(offscreenPrice.textContent);
                if (price !== null && !prices.some(p => p.price === price)) {
                    prices.push({ price, type: 'price' });
                }
            }
        }

        // Format-specific price
        const slotPriceEl = swatch.querySelector('.slot-price span[aria-label]');
        if (slotPriceEl) {
            const mainPrice = cleanPrice(slotPriceEl.getAttribute('aria-label'));
            if (mainPrice !== null && !prices.some(p => p.price === mainPrice)) {
                prices.push({ price: mainPrice, type: isKU ? 'ku_price' : 'price' });
            }
        }

        // Kindle extra message
        const extraMessage = swatch.querySelector('.kindleExtraMessage');
        if (extraMessage) {
            const priceElement = extraMessage.querySelector('.a-color-price');
            const additionalPrice = cleanPrice(priceElement?.textContent || extraMessage.textContent);
            if (additionalPrice !== null && !prices.some(p => p.price === additionalPrice)) {
                prices.push({ price: additionalPrice, type: 'price' });
            }
        }

        // Strikethrough list price
        if (isSelected) {
            const listPriceEl = buyBoxContainer
                ? buyBoxContainer.querySelector('span[class="a-price a-text-price"] span')
                : doc.querySelector('div[id*="corePriceDisplay"] span[class="a-price a-text-price"] span');
            if (listPriceEl) {
                const listPrice = cleanPrice(listPriceEl.textContent);
                if (listPrice !== null && !prices.some(p => p.price === listPrice)) {
                    prices.push({ price: listPrice, type: 'price' });
                }
            }
        }

        // Fallback for selected format
        if (isSelected && prices.length === 0 && buyBoxContainer) {
            const generalPriceElements = buyBoxContainer.querySelectorAll('.a-color-price');
            if (generalPriceElements.length > 0) {
                const price = cleanPrice(generalPriceElements[0].textContent);
                if (price !== null) prices.push({ price, type: 'price' });
            }
        }

        // Finalize price types
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

        formats.push({
            asin,
            formatName,
            prices,
            isKindleUnlimited: isKU,
            isSelected
        });
    });

    return formats;
}

/**
 * Extract editorial reviews
 */
function extractEditorialReviews(doc) {
    const editorialContainer = doc.querySelector('#editorialReviews_feature_div');
    if (!editorialContainer) return null;

    const reviews = {};
    const expanderContainers = editorialContainer.querySelectorAll('.a-row.a-expander-container.a-expander-extend-container');

    if (expanderContainers.length > 0) {
        expanderContainers.forEach(container => {
            const titleElement = container.querySelector('h3');
            const contentElement = container.querySelector('.a-expander-content');
            if (titleElement && contentElement) {
                const title = cleanText(titleElement.textContent);
                const content = cleanText(contentElement.textContent);
                if (title && content) reviews[title] = content;
            }
        });
    } else {
        const sections = editorialContainer.querySelectorAll('.a-section.a-spacing-small.a-padding-base');
        sections.forEach(section => {
            const titleElement = section.querySelector('h3');
            const contentDivs = section.querySelectorAll('div');
            if (titleElement && contentDivs.length > 0) {
                const title = cleanText(titleElement.textContent);
                const content = Array.from(contentDivs)
                    .map(div => cleanText(div.textContent))
                    .filter(text => text && text !== title)
                    .join(' ');
                if (title && content) reviews[title] = content;
            }
        });
    }

    return Object.keys(reviews).length > 0 ? reviews : null;
}

/**
 * Extract author info
 */
function extractAuthorInfo(doc) {
    console.log("Offscreen: Starting author info extraction");

    const bylineAuthors = [...doc.querySelectorAll('#bylineInfo .author a.a-link-normal')]
        .map(a => cleanText(a.textContent))
        .filter(Boolean);

    const authorCard = doc.querySelector('div[id^="CardInstance"][class*="_about-the-author-card_style_cardParentDiv"]');

    let biography = null, imageUrl = null, cardAuthorName = null;

    if (authorCard) {
        biography = getText(authorCard, 'div[class*="_peekableContent"]');
        if (biography?.includes("Discover more of the author's books")) biography = null;
        imageUrl = getAttr(authorCard, 'img[class*="_authorImage"]', 'src');
        cardAuthorName = getText(authorCard, 'div[class*="_authorName"] a');
    }

    const authorName = bylineAuthors.length > 0 ? bylineAuthors.join(', ') : cardAuthorName;
    if (!authorName) return null;

    const validImage = imageUrl && imageUrl !== "https://m.media-amazon.com/images/I/01Kv-W2ysOL._SY600_.png";
    const bioWordCount = biography ? biography.trim().split(/\s+/).length : 0;

    return { name: authorName, biography, imageUrl, validImage, bioWordCount };
}

/**
 * Parse product page from HTML string
 */
export function parseProductPageFromHTML(htmlString, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const find = (selector) => doc.querySelector(selector);
    const findAll = (selector) => doc.querySelectorAll(selector);

    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    const fullProductData = {
        asin: asinMatch ? asinMatch[1] : null,
        title: find('span#productTitle')?.textContent.trim() || null,
        cover_url: find('img#landingImage')?.src || null,
        product_details: extractProductDetails(doc, url),
        formats: extractAmazonBookFormats(doc, url),
        customer_reviews: {
            average_rating: parseFloat(find('div#averageCustomerReviews a span.a-icon-alt')?.textContent),
            review_count: (() => {
                const count = parseInt(find('span#acrCustomerReviewText')?.textContent?.replace(/,/g, ''));
                return isNaN(count) ? null : count;
            })(),
            review_image_count: findAll('#cm_cr_carousel_images_section .a-carousel-card').length
        },
        aplus_content: { modulesCount: findAll('[data-aplus-module], .aplus-module').length },
        ugc_videos: { video_count: findAll('[data-video-url], .video-block').length },
        editorial_reviews: extractEditorialReviews(doc),
        author_info: extractAuthorInfo(doc),
        royalties: null
    };

    // Calculate royalties
    const marketplaceInfo = getMarketplaceInfo(url);
    const currentFormat = fullProductData.formats.find(f => f.isSelected);

    console.log(`Offscreen: Current format:`, currentFormat?.formatName);

    if (currentFormat) {
        const formatNameLower = currentFormat.formatName.toLowerCase();
        if (formatNameLower.includes('paperback') || formatNameLower.includes('hardcover') ||
            formatNameLower.includes('kindle') || formatNameLower.includes('ebook')) {
            console.log(`Offscreen: Calculating royalties for ${formatNameLower}`);
            fullProductData.royalties = calculateRoyaltyAndSales(
                currentFormat,
                fullProductData.product_details,
                marketplaceInfo,
                'Offscreen'
            );
        }
    } else if (fullProductData.formats && fullProductData.formats.length > 0) {
        const fallbackFormat = fullProductData.formats[0];
        const formatNameLower = fallbackFormat.formatName.toLowerCase();
        console.log(`Offscreen: Using fallback format: "${fallbackFormat.formatName}"`);

        if (formatNameLower.includes('paperback') || formatNameLower.includes('hardcover') ||
            formatNameLower.includes('kindle') || formatNameLower.includes('ebook')) {
            fullProductData.royalties = calculateRoyaltyAndSales(
                fallbackFormat,
                fullProductData.product_details,
                marketplaceInfo,
                'Offscreen'
            );
        }
    }

    console.log(`Offscreen: Successfully parsed ${url}`);
    return fullProductData;
}
