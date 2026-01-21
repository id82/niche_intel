/**
 * SERP (Search Engine Results Page) Extractor Module
 * Extracts product information from Amazon search results pages
 */

/**
 * Run full Amazon search results analysis
 * Extracts product info, classifies page blocks, and analyzes page ownership
 */
export function runFullAmazonAnalysis() {
    console.log("NicheIntel Pro: Main search scraping starting - runFullAmazonAnalysis initiated");

    // ===================================================================
    // STEP 1: EXTRACT DETAILED PRODUCT INFO FROM ALL CARDS
    // ===================================================================
    function extractProductInfo() {
        console.log("scrapers.js: Starting extractProductInfo.");
        const productInfo = {};
        const productCards = document.querySelectorAll('div[data-component-type="s-search-result"]');

        if (productCards.length === 0) {
            console.log("NicheIntel Pro: Main search scraping skipped - No product cards found (no search results on page)");
        } else {
            console.log(`NicheIntel Pro: Main search scraping proceeding - Found ${productCards.length} product cards to analyze`);
        }

        productCards.forEach(card => {
            try {
                const asin = card.dataset.asin;
                if (!asin || asin.length < 10 || productInfo[asin]) return;

                let priceBlock = card.querySelector('div[data-cy="price-recipe"]');
                if (priceBlock) {
                    const formatLink = priceBlock.querySelector('a.a-link-normal');
                    if (formatLink) {
                        const formatText = formatLink.textContent.trim();
                        if (!formatText.includes('Paperback') && !formatText.includes('Kindle') && !formatText.includes('Hardcover')) {
                            return; // Not a book, skip
                        }
                    }
                }

                const product = {};

                // === TITLE EXTRACTION ===
                let titleElement = card.querySelector('h2 a span.a-text-normal');
                if (!titleElement) {
                    titleElement = card.querySelector('.s-title-instructions-style h2.a-size-base-plus');
                }
                if (!titleElement) {
                    const titleBlock = card.querySelector('div[data-cy="title-recipe"]');
                    if (titleBlock) titleElement = titleBlock.querySelector('h2');
                }
                product.title = titleElement ? titleElement.textContent.trim() : null;
                if (!product.title) return;

                // === AUTHOR EXTRACTION ===
                product.authors = [];
                const titleBlock = card.querySelector('div[data-cy="title-recipe"]');
                if (titleBlock) {
                    const authorBlock = titleBlock.querySelector('div.a-row.a-size-base.a-color-secondary');
                    if (authorBlock) {
                        const authorSpans = authorBlock.querySelectorAll('span.a-size-base');
                        authorSpans.forEach(span => {
                            const text = span.textContent.trim();
                            const parentDiv = span.closest('div.a-row');
                            const isSeries = parentDiv && (parentDiv.textContent.toLowerCase().includes('part of') || parentDiv.textContent.toLowerCase().includes('book '));

                            if (text.length > 3 && !isSeries && !/^\d+$/.test(text) && !text.toLowerCase().includes('et al')) {
                                product.authors.push(text);
                            }
                        });

                        if (product.authors.length === 0) {
                            const byline = authorBlock.textContent.trim();
                            if (byline.toLowerCase().startsWith('by ')) {
                                const authorText = byline.substring(3).split('|')[0].trim();
                                if (authorText.length > 3) product.authors.push(authorText);
                            }
                        }
                    }
                }
                product.authors = [...new Set(product.authors)];

                // === RATING EXTRACTION ===
                product.rating = null;
                let reviewsBlock = card.querySelector('div[data-cy="reviews-block"]');
                if (reviewsBlock) {
                    const ratingElement = reviewsBlock.querySelector('span[class="a-icon-alt"]');
                    if (ratingElement) {
                        const ratingMatch = ratingElement.textContent.match(/(\d+\.?\d*)/);
                        product.rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;
                    }
                }
                if (product.rating === null) {
                    const fallbackRating = card.querySelector('i.a-icon-star-small');
                    if (fallbackRating) {
                        const ratingMatch = fallbackRating.textContent.match(/(\d+\.?\d*)/);
                        product.rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;
                    }
                }

                // === REVIEW COUNT EXTRACTION ===
                const parseReviewCount = (text) => {
                    if (!text) return null;
                    text = text.replace(/[()]/g, '').trim();
                    const match = text.match(/^([\d,.]+)\s*([KkMm])?$/);
                    if (!match) return null;
                    let num = parseFloat(match[1].replace(/,/g, ''));
                    if (isNaN(num)) return null;
                    const suffix = match[2]?.toUpperCase();
                    if (suffix === 'K') num *= 1000;
                    else if (suffix === 'M') num *= 1000000;
                    return Math.round(num);
                };

                product.reviewCount = null;
                if (reviewsBlock) {
                    const reviewCountBlock = reviewsBlock.querySelector('[data-csa-c-content-id*="ratings-count"]');
                    if (reviewCountBlock) {
                        const reviewSpan = reviewCountBlock.querySelector('span');
                        if (reviewSpan) product.reviewCount = parseReviewCount(reviewSpan.textContent);
                    }
                }
                if (product.reviewCount === null) {
                    const reviewElement = card.querySelector('a[aria-label*="ratings"]');
                    if (reviewElement) {
                        const reviewSpan = reviewElement.querySelector('span.s-underline-text');
                        if (reviewSpan) product.reviewCount = parseReviewCount(reviewSpan.textContent);
                    }
                }
                if (product.reviewCount === null) {
                    const genericReviewElement = card.querySelector('.a-size-base.s-underline-text');
                    if (genericReviewElement) product.reviewCount = parseReviewCount(genericReviewElement.textContent);
                }

                // === PRICE EXTRACTION ===
                const cleanPrice = (text) => {
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
                };

                product.currentPrice = null;
                product.listPrice = null;
                const prices = [];

                // TIER 1: Component Reconstruction
                const wholePart = card.querySelector('.a-price-whole');
                const fractionPart = card.querySelector('.a-price-fraction');
                if (wholePart && fractionPart) {
                    const reconstructedPrice = wholePart.textContent.trim() + fractionPart.textContent.trim();
                    const price = cleanPrice(reconstructedPrice);
                    if (price !== null) prices.push(price);
                }

                // TIER 1B: priceBlock reconstruction
                if (prices.length === 0 && priceBlock) {
                    const priceBlockWhole = priceBlock.querySelector('.a-price-whole');
                    const priceBlockFraction = priceBlock.querySelector('.a-price-fraction');
                    if (priceBlockWhole && priceBlockFraction) {
                        const reconstructedPrice = priceBlockWhole.textContent.trim() + priceBlockFraction.textContent.trim();
                        const price = cleanPrice(reconstructedPrice);
                        if (price !== null && !prices.includes(price)) prices.push(price);
                    }
                }

                // TIER 2: Screen Reader Text
                if (prices.length === 0) {
                    const offscreenPrice = card.querySelector('.a-price .a-offscreen');
                    if (offscreenPrice) {
                        const price = cleanPrice(offscreenPrice.textContent);
                        if (price !== null) prices.push(price);
                    }
                }

                // TIER 2B: Legacy priceBlock
                if (prices.length === 0 && priceBlock) {
                    const offscreenPrice = priceBlock.querySelector('.a-offscreen');
                    if (offscreenPrice) {
                        const price = cleanPrice(offscreenPrice.textContent);
                        if (price !== null && !prices.includes(price)) prices.push(price);
                    }
                }

                // TIER 3: Format-specific prices
                if (prices.length === 0) {
                    const selectedFormat = card.querySelector('.swatchElement.selected .slot-price .a-color-price');
                    if (selectedFormat) {
                        const price = cleanPrice(selectedFormat.textContent);
                        if (price !== null) prices.push(price);
                    }
                }

                // TIER 4: General fallback
                if (prices.length === 0) {
                    const priceContainer = card.querySelector('.a-price');
                    if (priceContainer) {
                        const priceText = priceContainer.textContent;
                        const priceMatch = priceText.match(/\$?(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2}|\d+)/);
                        if (priceMatch) {
                            const price = cleanPrice(priceMatch[0]);
                            if (price !== null) prices.push(price);
                        }
                    }

                    if (prices.length === 0) {
                        let priceSpans = [];
                        if (priceBlock) {
                            priceSpans = Array.from(priceBlock.querySelectorAll('span[class*="a-price"]'));
                        }
                        if (priceSpans.length === 0) {
                            const priceSection = card.querySelector('.s-price-instructions-style, .a-spacing-none > .a-row.a-color-base');
                            if (priceSection) priceSpans = Array.from(priceSection.querySelectorAll('.a-price'));
                        }

                        for (const span of priceSpans) {
                            const offscreenElement = span.querySelector('span[class="a-offscreen"]');
                            if (offscreenElement) {
                                const price = cleanPrice(offscreenElement.textContent);
                                if (price !== null && !prices.includes(price)) {
                                    prices.push(price);
                                    break;
                                }
                            }
                        }

                        if (prices.length === 0) {
                            const generalPriceElements = card.querySelectorAll('.a-color-price, .a-price .a-offscreen');
                            for (const element of generalPriceElements) {
                                const price = cleanPrice(element.textContent);
                                if (price !== null) {
                                    prices.push(price);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (prices.length > 0) {
                    prices.sort((a, b) => a - b);
                    product.currentPrice = prices[0];
                    product.listPrice = prices[prices.length - 1];
                    if (prices.length > 2) {
                        console.warn(`SERP Product ${asin}: Found ${prices.length} prices, using lowest for current and highest for list:`, prices);
                    }
                } else {
                    console.warn(`SERP Product ${asin}: No valid prices found despite enhanced extraction strategy`);
                }

                // === IMAGE URL ===
                const imageElement = card.querySelector('img.s-image') || card.querySelector('img');
                product.coverUrl = imageElement ? imageElement.src : '';

                // === METADATA ===
                product.asin = asin;
                productInfo[asin] = product;

            } catch (error) {
                console.error(`Error processing product card:`, error);
            }
        });

        console.log(`scrapers.js: Extracted info for ${Object.keys(productInfo).length} unique products.`);
        return productInfo;
    }

    // ===================================================================
    // STEP 2: CLASSIFY PAGE BLOCKS AND BUILD POSITIONAL DATA
    // ===================================================================
    function classifyAndMapPositions() {
        console.log("scrapers.js: Starting classifyAndMapPositions.");
        const containerSelector = 'span[data-component-type="s-search-results"] > div.s-main-slot.s-result-list';
        const searchResultsContainer = document.querySelector(containerSelector);

        if (!searchResultsContainer) {
            console.error("scrapers.js: Main search results container not found.");
            return { orderedResults: [], positions: {} };
        }

        const childDivs = Array.from(searchResultsContainer.children).filter(el => el.tagName === 'DIV');
        const orderedResults = [];
        const positions = {};

        childDivs.forEach((div, index) => {
            let type = 'UNCLASSIFIED';
            let asinsFound = [];
            const classList = div.getAttribute('class') || '';
            const role = div.getAttribute('role');
            const primaryAsin = div.dataset.asin;

            if (!role && classList.includes('large AdHolder')) {
                type = div.querySelector('[data-cel-widget*="sb-video-product-collection"]') ? 'BV' : 'SB';
                div.querySelectorAll('[data-asin]').forEach(el => {
                    if (el.dataset.asin && el.dataset.asin.length >= 10 && !asinsFound.includes(el.dataset.asin)) {
                        asinsFound.push(el.dataset.asin);
                    }
                });
                if (asinsFound.length === 0 && type === 'SB') {
                    div.querySelectorAll('a[href*="lp_asins="]').forEach(link => {
                        const match = link.href.match(/lp_asins=([^&]+)/);
                        if (match && match[1]) {
                            decodeURIComponent(match[1]).split(',').forEach(a => {
                                if (a && !asinsFound.includes(a)) asinsFound.push(a);
                            });
                        }
                    });
                    if (asinsFound.length === 0) {
                        const adCreativeMatches = div.innerHTML.match(/adCreativeId[^-]*-(\d{10})%/g) || [];
                        adCreativeMatches.map(m => m.match(/-(\d{10})%/)[1]).forEach(a => {
                            if (a && !asinsFound.includes(a)) asinsFound.push(a);
                        });
                    }
                }
            } else if (role === 'listitem' && primaryAsin && primaryAsin.length >= 10) {
                type = classList.includes('AdHolder') ? 'SP' : 'O';
                asinsFound.push(primaryAsin);
            } else if (div.querySelector('div[class*="sb-video-creative"]') || div.querySelector('[data-cel-widget*="VIDEO_SINGLE_PRODUCT"]')) {
                type = 'PV';
                const videoAsinElement = div.querySelector('[data-csa-c-asin]');
                if (videoAsinElement) asinsFound.push(videoAsinElement.dataset.csaCAsin);
            } else if (div.querySelector('ol[class*="a-carousel"], div[data-a-carousel]')) {
                const validAsinElements = Array.from(div.querySelectorAll('[data-asin]')).filter(el => el.dataset.asin && el.dataset.asin.length >= 10);
                if (validAsinElements.length > 0) {
                    type = div.querySelector('a[aria-label*="Sponsored"]') || div.textContent.toLowerCase().includes('sponsored') ? 'SC' : 'OC';
                    validAsinElements.forEach(el => {
                        if (!asinsFound.includes(el.dataset.asin)) asinsFound.push(el.dataset.asin);
                    });
                }
            }

            if (type !== 'UNCLASSIFIED') {
                const result = { Position: index + 1, Type: type, ASINs: asinsFound.join(', ') };
                orderedResults.push(result);
                asinsFound.forEach(asin => {
                    if (!positions[asin]) positions[asin] = [];
                    positions[asin].push({ position: index + 1, type: type });
                });
            }
        });

        console.log("scrapers.js: Finished classifyAndMapPositions.");
        return { orderedResults, positions };
    }

    // ===================================================================
    // STEP 3: ANALYZE PAGE OWNERSHIP
    // ===================================================================
    function analyzePageOwnership(productInfo, positions) {
        console.log("scrapers.js: Starting analyzePageOwnership.");
        const scoreMap = {
            'O': 1,    // Organic
            'SP': 1,   // Sponsored Product
            'OC': 1,   // Organic Carousel
            'SC': 1,   // Sponsored Carousel
            'SB': 1.5, // Sponsored Brand
            'BV': 2,   // Brand Video
            'PV': 4,   // Product Video
        };

        const asinScores = {};
        for (const asin in positions) {
            let score = 0;
            positions[asin].forEach(placement => {
                score += scoreMap[placement.type] || 0;
            });
            asinScores[asin] = score;
        }

        const totalPageScore = Object.values(asinScores).reduce((sum, score) => sum + score, 0);

        if (totalPageScore === 0) {
            console.warn("scrapers.js: No scorable ASINs found on page.");
            return { authorAnalysis: {}, asinAnalysis: {} };
        }

        const asinAnalysis = {};
        for (const asin in asinScores) {
            asinAnalysis[asin] = {
                title: productInfo[asin]?.title || 'N/A',
                score: asinScores[asin],
                ownershipPercentage: asinScores[asin] / totalPageScore,
                positions: positions[asin] || []
            };
        }

        const authorAnalysis = {};
        for (const asin in productInfo) {
            const product = productInfo[asin];
            if (!product.authors || product.authors.length === 0) continue;

            const asinScore = asinScores[asin] || 0;
            const placementCount = positions[asin] ? positions[asin].length : 0;

            product.authors.forEach(author => {
                if (!authorAnalysis[author]) {
                    authorAnalysis[author] = {
                        totalScore: 0,
                        ownershipPercentage: 0,
                        asinCount: 0,
                        placementCount: 0,
                        asins: {}
                    };
                }
                if (!authorAnalysis[author].asins[asin]) {
                    authorAnalysis[author].asins[asin] = {
                        title: product.title,
                        score: asinScore,
                        positions: positions[asin] || []
                    };
                    authorAnalysis[author].totalScore += asinScore;
                    authorAnalysis[author].asinCount += 1;
                    authorAnalysis[author].placementCount += placementCount;
                }
            });
        }

        for (const author in authorAnalysis) {
            authorAnalysis[author].ownershipPercentage = authorAnalysis[author].totalScore / totalPageScore;
        }

        console.log("scrapers.js: Finished analyzePageOwnership.");
        return { authorAnalysis, asinAnalysis };
    }

    // ===================================================================
    // EXECUTION
    // ===================================================================
    const productInfo = extractProductInfo();
    const { orderedResults, positions } = classifyAndMapPositions();
    const { authorAnalysis, asinAnalysis } = analyzePageOwnership(productInfo, positions);

    console.log(`NicheIntel Pro: Main search scraping completed successfully - Found ${Object.keys(productInfo).length} valid book products`);
    return { orderedResults, positions, productInfo, authorAnalysis, asinAnalysis };
}
