// ===================================================================================
// START OF SCRIPT: serp_classifier_asin_extractor.js
// ===================================================================================
function runFullAmazonAnalysis() {
  console.log("scrapers.js: Starting runFullAmazonAnalysis.");

  // ===================================================================
  // STEP 1: EXTRACT DETAILED PRODUCT INFO FROM ALL CARDS (v2.4 LOGIC)
  // ===================================================================
  function extractProductInfo() {
    console.log("scrapers.js: Starting extractProductInfo.");
    const productInfo = {};
    const productCards = document.querySelectorAll('div[data-component-type="s-search-result"]');
    console.log(`scrapers.js: Found ${productCards.length} product cards.`);

    productCards.forEach(card => {
      try {
        // Extract ASIN with validation
        const asin = card.dataset.asin;
        if (!asin || asin.length < 10 || productInfo[asin]) {
          return;
        }

        let priceBlock = card.querySelector('div[data-cy="price-recipe"]');
        if (priceBlock) {
            const formatLink = priceBlock.querySelector('a.a-link-normal');
            if (formatLink) {
                const formatText = formatLink.textContent.trim();
                if (!formatText.includes('Paperback') && !formatText.includes('Kindle') && !formatText.includes('Hardcover')) {
                    return; // Not a book, skip this product
                }
            }
        }

        const product = {};

        // === TITLE EXTRACTION (Enhanced with fallbacks) ===
        let titleElement = card.querySelector('h2 a span.a-text-normal');
        if (!titleElement) {
          titleElement = card.querySelector('.s-title-instructions-style h2.a-size-base-plus');
        }
        if (!titleElement) {
          const titleBlock = card.querySelector('div[data-cy="title-recipe"]');
          if (titleBlock) {
            titleElement = titleBlock.querySelector('h2');
          }
        }
        product.title = titleElement ? titleElement.textContent.trim() : null;
        if (!product.title) return;

        // === AUTHOR EXTRACTION (Enhanced logic) ===
        product.authors = [];
        const titleBlock = card.querySelector('div[data-cy="title-recipe"]');
        if (titleBlock) {
            const authorBlock = titleBlock.querySelector('div.a-row.a-size-base.a-color-secondary');
            if (authorBlock) {
                // Find all potential author-related spans, but exclude those clearly indicating a series.
                const authorSpans = authorBlock.querySelectorAll('span.a-size-base');
                authorSpans.forEach(span => {
                    const text = span.textContent.trim();
                    const parentDiv = span.closest('div.a-row');
                    const isSeries = parentDiv && (parentDiv.textContent.toLowerCase().includes('part of') || parentDiv.textContent.toLowerCase().includes('book '));
                    
                    if (text.length > 3 && !isSeries && !/^\d+$/.test(text) && !text.toLowerCase().includes('et al')) {
                        product.authors.push(text);
                    }
                });

                // Fallback for the simple "by Author" case if the above fails
                if (product.authors.length === 0) {
                    const byline = authorBlock.textContent.trim();
                    if (byline.toLowerCase().startsWith('by ')) {
                        const authorText = byline.substring(3).split('|')[0].trim();
                        if (authorText.length > 3) {
                            product.authors.push(authorText);
                        }
                    }
                }
            }
        }
        // Final cleanup to remove duplicates
        product.authors = [...new Set(product.authors)];
        // Final cleanup to remove duplicates
        product.authors = [...new Set(product.authors)];

        // === RATING EXTRACTION (Enhanced with fallbacks) ===
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

        // === REVIEW COUNT EXTRACTION (Enhanced logic) ===
        product.reviewCount = null;
        if (reviewsBlock) {
          const reviewCountBlock = reviewsBlock.querySelector('[data-csa-c-content-id*="ratings-count"]');
          if (reviewCountBlock) {
            const reviewSpan = reviewCountBlock.querySelector('span');
            if (reviewSpan) {
              const reviewText = reviewSpan.textContent.trim().replace(/,/g, '');
              product.reviewCount = parseInt(reviewText) || null;
            }
          }
        }
        if (product.reviewCount === null) {
          const reviewElement = card.querySelector('a[aria-label*="ratings"]');
          if (reviewElement) {
            const reviewSpan = reviewElement.querySelector('span.s-underline-text');
            if (reviewSpan) {
              product.reviewCount = parseInt(reviewSpan.textContent.trim().replace(/,/g, '')) || null;
            }
          }
        }
        if (product.reviewCount === null) {
          const genericReviewElement = card.querySelector('.a-size-base.s-underline-text');
          if (genericReviewElement) {
            product.reviewCount = parseInt(genericReviewElement.textContent.trim().replace(/,/g, '')) || null;
          }
        }

        // === PRICE EXTRACTION (Enhanced logic) ===
        product.currentPrice = null;
        product.listPrice = null;
        let priceSpans = [];
        if (priceBlock) {
          priceSpans = Array.from(priceBlock.querySelectorAll('span[class*="a-price"]'));
        }
        if (priceSpans.length === 0) {
          const priceSection = card.querySelector('.s-price-instructions-style, .a-spacing-none > .a-row.a-color-base');
          if (priceSection) {
            priceSpans = Array.from(priceSection.querySelectorAll('.a-price'));
          }
        }
        const prices = [];
        priceSpans.forEach(span => {
          const offscreenElement = span.querySelector('span[class="a-offscreen"]');
          if (offscreenElement) {
            const cleanPrice = offscreenElement.textContent.replace(/[$,€£¥]/g, '');
            const numericPrice = parseFloat(cleanPrice);
            if (!isNaN(numericPrice) && numericPrice > 0) {
              prices.push(numericPrice);
            }
          }
        });
        if (prices.length > 0) {
          prices.sort((a, b) => a - b); // Sort ascending
          product.currentPrice = prices[0]; // Lowest price is the current price
          product.listPrice = prices[prices.length - 1]; // Highest price is the list price
          if (prices.length > 2) {
              console.warn(`Product ${asin}: Found ${prices.length} prices, using lowest for current and highest for list:`, prices);
          }
        }

        // === IMAGE URL EXTRACTION ===
        const imageElement = card.querySelector('img.s-image') || card.querySelector('img');
        product.coverUrl = imageElement ? imageElement.src : '';

        // === ADDITIONAL METADATA ===
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
  // STEP 2: CLASSIFY PAGE BLOCKS AND BUILD POSITIONAL DATA (Unchanged)
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
        div.querySelectorAll('[data-asin]').forEach(el => { if (el.dataset.asin && el.dataset.asin.length >= 10 && !asinsFound.includes(el.dataset.asin)) asinsFound.push(el.dataset.asin); });
        if (asinsFound.length === 0 && type === 'SB') {
          div.querySelectorAll('a[href*="lp_asins="]').forEach(link => {
            const match = link.href.match(/lp_asins=([^&]+)/);
            if (match && match[1]) decodeURIComponent(match[1]).split(',').forEach(a => { if(a && !asinsFound.includes(a)) asinsFound.push(a); });
          });
          if (asinsFound.length === 0) {
            const adCreativeMatches = div.innerHTML.match(/adCreativeId[^-]*-(\d{10})%/g) || [];
            adCreativeMatches.map(m => m.match(/-(\d{10})%/)[1]).forEach(a => { if(a && !asinsFound.includes(a)) asinsFound.push(a); });
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
          validAsinElements.forEach(el => { if (!asinsFound.includes(el.dataset.asin)) asinsFound.push(el.dataset.asin); });
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
  // STEP 3: ANALYZE PAGE OWNERSHIP (NEW in v2.6)
  // ===================================================================
  function analyzePageOwnership(productInfo, positions) {
    console.log("scrapers.js: Starting analyzePageOwnership.");
    const scoreMap = {
      'O': 1,    // Organic
      'SP': 1,   // Sponsored Product
      'OC': 1,   // Organic Carousel
      'SC': 1,   // Sponsored Carousel
      'SB': 1.5, // Sponsored Brand
      'BV': 2,   // Brand Video (Updated)
      'PV': 4,   // Product Video
    };

    // 1. Calculate the score for each individual ASIN based on its placements
    const asinScores = {};
    for (const asin in positions) {
      let score = 0;
      positions[asin].forEach(placement => {
        score += scoreMap[placement.type] || 0;
      });
      asinScores[asin] = score;
    }

    // 2. Calculate the total score for the entire page
    const totalPageScore = Object.values(asinScores).reduce((sum, score) => sum + score, 0);

    if (totalPageScore === 0) {
      console.warn("scrapers.js: No scorable ASINs found on page.");
      return { authorAnalysis: {}, asinAnalysis: {} };
    }

    // 3. Create ASIN-level analysis with ownership percentage
    const asinAnalysis = {};
    for (const asin in asinScores) {
        asinAnalysis[asin] = {
            title: productInfo[asin]?.title || 'N/A',
            score: asinScores[asin],
            ownershipPercentage: asinScores[asin] / totalPageScore,
            positions: positions[asin] || []
        };
    }

    // 4. Aggregate scores by author
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

    // 5. Calculate ownership percentage for each author
    for (const author in authorAnalysis) {
        authorAnalysis[author].ownershipPercentage = authorAnalysis[author].totalScore / totalPageScore;
    }
    
    console.log("scrapers.js: Finished analyzePageOwnership.");
    return { authorAnalysis, asinAnalysis };
  }

  // ===================================================================
  // EXECUTION AND OUTPUT
  // ===================================================================

  const productInfo = extractProductInfo();
  const { orderedResults, positions } = classifyAndMapPositions();
  const { authorAnalysis, asinAnalysis } = analyzePageOwnership(productInfo, positions);

  console.log("scrapers.js: Finished runFullAmazonAnalysis.");
  return { orderedResults, positions, productInfo, authorAnalysis, asinAnalysis };
}
// ===================================================================================
// END OF SCRIPT: serp_classifier_asin_extractor.js
// ===================================================================================



// ===================================================================================
// START OF SCRIPT: book_detail_page_extractor.js
// ===================================================================================
function runFullProductPageExtraction() {
    console.log("scrapers.js: Starting runFullProductPageExtraction.");

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
                    el => el.textContent.trim().startsWith(label)
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

            const publisherText = findDetailValue("Publisher");
            if (publisherText) {
                const publisherName = publisherText.split('(')[0].trim();
                details.publisher = publisherName;
                details.self_published = publisherName.toLowerCase() === 'independently published';
                console.log("scrapers.js: Extracted Publisher:", details.publisher, "Self-published:", details.self_published);
            }

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
            
            const printLengthText = findDetailValue("Print length");
            if (printLengthText) {
                details.print_length = parseInt(printLengthText.match(/\d+/)[0], 10);
                console.log("scrapers.js: Extracted Print Length:", details.print_length);
            }
        }
        
        console.log("scrapers.js: Attempting BSR extraction.");
        try {
            let aElement = document.querySelector('div[id="detailBulletsWrapper_feature_div"] a[href*="gp/bestseller"]');
            if (!aElement) {
                const parentDiv = document.getElementById('detailBulletsWrapper_feature_div');
                if (parentDiv) {
                    const childDiv = parentDiv.querySelector('#detailBullets_feature_div');
                    if (childDiv) {
                        const siblingUl = childDiv.nextElementSibling;
                        if (siblingUl) {
                            aElement = siblingUl.querySelector('a');
                        }
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

        console.log(`scrapers.js: Finished extractAplusContent. Found ${modules.length} modules.`);
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
        console.log("scrapers.js: Starting extractAuthorInfo extraction");
        
        // This selector for byline authors is stable and does not need changes.
        const bylineAuthors = [...document.querySelectorAll('#bylineInfo .author a.a-link-normal')]
            .map(a => cleanText(a.textContent))
            .filter(Boolean);
        console.log("scrapers.js: Byline authors found:", bylineAuthors);

        // Use a more robust selector for the main author card container.
        // It combines a stable part of the ID with a stable part of the class name.
        const authorCard = document.querySelector('div[id^="CardInstance"][class*="_about-the-author-card_style_cardParentDiv"]');
        console.log("scrapers.js: Author card found:", !!authorCard);
        
        let biography = null, imageUrl = null, cardAuthorName = null;

        if (authorCard) {
            // Extract biography using a selector that ignores the unique hash.
            biography = getText(authorCard, 'div[class*="_peekableContent"]');
            console.log("scrapers.js: Biography extracted:", biography ? "Found" : "Not found");
            if (biography?.includes("Discover more of the author's books")) {
                biography = null;
                console.log("scrapers.js: Biography cleared (generic message detected)");
            }
            
            // Extract image URL using a stable class selector.
            imageUrl = getAttr(authorCard, 'img[class*="_authorImage"]', 'src');
            console.log("scrapers.js: Image URL extracted:", imageUrl ? "Found" : "Not found");

            // Extract the author's name using a more specific and stable selector, avoiding generic tags like 'h2'.
            cardAuthorName = getText(authorCard, 'div[class*="_authorName"] a');
            console.log("scrapers.js: Card author name extracted:", cardAuthorName);
        }
        
        // Prioritize byline authors if they exist, otherwise use the name from the card.
        const authorName = bylineAuthors.length > 0 ? bylineAuthors.join(', ') : cardAuthorName;
        console.log("scrapers.js: Final author name:", authorName);
        
        if (!authorName) {
            console.warn("scrapers.js: No author name found, returning null");
            return null;
        }
        
        // Check if the image is the default placeholder.
        const validImage = imageUrl && imageUrl !== "https://m.media-amazon.com/images/I/01Kv-W2ysOL._SY600_.png";
        
        // Count words in the biography.
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
        console.log("scrapers.js: Starting extractAmazonBookFormats.");
        const results = [];
        const pageAsin = window.location.href.match(/\/dp\/([A-Z0-9]{10})/)[1];
        
        const cleanPrice = (text) => {
            if (!text) return null;
            const match = text.match(/(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2}|\d+)/);
            if (!match) return null;
    
            let priceStr = match[0].replace(/[$,€£¥]/g, ''); // Remove currency symbols
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

        // Attempt to find the strikethrough list price and add it to the selected format
        const listPriceEl = document.querySelector('div[id*="corePriceDisplay"] span[class="a-price a-text-price"] span');
        if (listPriceEl) {
            const listPriceText = listPriceEl.textContent;
            const listPrice = cleanPrice(listPriceText);
            if (listPrice) {
                const selectedFormat = results.find(r => r.isSelected);
                if (selectedFormat) {
                    if (!selectedFormat.prices.some(p => p.price === listPrice)) {
                        selectedFormat.prices.push({ price: listPrice, type: 'price' });
                    }
                }
            }
        }
        
        // Final processing of prices for each format
        for (const format of results) {
            if (!format.prices || format.prices.length < 1) {
                continue;
            }

            const nonKuPrices = format.prices.filter(p => p.type !== 'ku_price');
            if (nonKuPrices.length === 0) {
                continue;
            }

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

    // Simplified fallback calculation that mirrors the working mini table logic
    function calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo) {
        console.log("scrapers.js: Using simplified fallback royalty calculation");
        
        // Extract available data with fallbacks
        const prices = format.prices || [];
        let price = null;
        
        if (prices.length > 0) {
            // Use the same logic as mini table: highest price as list price
            const validPrices = prices.filter(p => p.price && p.price > 0).map(p => p.price);
            if (validPrices.length > 0) {
                price = Math.max(...validPrices);
            }
        }
        
        const bsr = productDetails.bsr || null;
        const pageCount = productDetails.print_length || 100; // Fallback to reasonable default
        const market_code = marketplaceInfo.code || 'USD';
        
        if (!price) {
            console.warn("scrapers.js: No valid price found for simplified calculation");
            return { error: "No valid price found" };
        }
        
        // Calculate sales using existing logic if BSR is available
        let monthly_sales = 0;
        if (bsr) {
            const book_type = format.formatName.toLowerCase();
            const daily_sales = estimateSales(bsr, book_type, market_code);
            monthly_sales = Math.round(daily_sales * 30);
        } else {
            // Provide a reasonable estimate if BSR is missing
            monthly_sales = 10; // Conservative fallback
            console.warn("scrapers.js: No BSR available, using fallback monthly sales estimate");
        }
        
        // Simplified royalty calculation (mirrors mini table logic)
        let royaltyPerUnit = 0;
        const book_type = format.formatName.toLowerCase();
        console.log(`scrapers.js: Simplified calculation for book type: "${book_type}" with price: $${price}`);
        
        if (book_type.includes('kindle') || book_type.includes('ebook')) {
            // Simplified Kindle royalty calculation
            if (price >= 2.99 && price <= 9.99) {
                royaltyPerUnit = price * 0.7; // 70% royalty
                console.log(`scrapers.js: Kindle 70% royalty applied: $${royaltyPerUnit.toFixed(2)}`);
            } else {
                royaltyPerUnit = price * 0.35; // 35% royalty
                console.log(`scrapers.js: Kindle 35% royalty applied: $${royaltyPerUnit.toFixed(2)}`);
            }
        } else if (book_type.includes('hardcover')) {
            // Simplified hardcover royalty calculation
            const printingCost = 5.65 + (pageCount * 0.012); // Simplified printing cost for hardcover
            const royaltyRate = price < 10 ? 0.5 : 0.6; // Simplified royalty rate
            royaltyPerUnit = Math.max(0, (price * royaltyRate) - printingCost);
            console.log(`scrapers.js: Hardcover royalty: ($${price} * ${royaltyRate}) - $${printingCost.toFixed(2)} = $${royaltyPerUnit.toFixed(2)}`);
        } else {
            // Simplified paperback royalty calculation (now the default fallback)
            const printingCost = 0.85 + (pageCount * 0.012); // Simplified printing cost for paperback
            const royaltyRate = price < 10 ? 0.5 : 0.6; // Simplified royalty rate
            royaltyPerUnit = Math.max(0, (price * royaltyRate) - printingCost);
            console.log(`scrapers.js: Paperback royalty: ($${price} * ${royaltyRate}) - $${printingCost.toFixed(2)} = $${royaltyPerUnit.toFixed(2)}`);
        }
        
        const monthly_royalty = Math.round(royaltyPerUnit * monthly_sales);
        
        console.log("scrapers.js: Simplified calculation result:", {
            royalty_per_unit: royaltyPerUnit.toFixed(2),
            monthly_sales,
            monthly_royalty
        });
        
        return {
            royalty_per_unit: parseFloat(royaltyPerUnit.toFixed(2)),
            monthly_sales: monthly_sales,
            monthly_royalty: monthly_royalty,
            calculation_assumptions: {
                simplified: true,
                price_used: price,
                page_count_used: pageCount,
                bsr_used: bsr,
                book_type: book_type
            }
        };
    }

    function calculateRoyaltyAndSales(format, productDetails, marketplaceInfo) {
        console.log("scrapers.js: Starting calculateRoyaltyAndSales for format:", format.formatName);
        const book_type = format.formatName.toLowerCase();
        if (!format.prices || format.prices.length === 0) {
            console.error("scrapers.js: No price found for this format.");
            return { error: "No price found for this format." };
        }
        
        // Find the list price we identified in the previous step.
        const listPriceObject = format.prices.find(p => p.type === 'list_price');

        // If not found, fall back to the highest available price as a safety measure.
        const list_price = listPriceObject ? listPriceObject.price : Math.max(...format.prices.filter(p => p.type !== 'ku_price').map(p => p.price));
        console.log(`scrapers.js: Using list price: ${list_price}`);
        
        const page_count = productDetails.print_length;
        const bsr = productDetails.bsr;
        
        // If essential data is missing, try simplified fallback calculation (like mini table)
        if (!list_price || !page_count || !bsr) {
            console.warn("scrapers.js: Missing essential data for complex calculation, attempting simplified fallback.", { list_price, page_count, bsr });
            return calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo);
        }

        const market_code = marketplaceInfo.code;
        const trim_size = productDetails.large_trim ? 'large' : 'regular';
        const interior_type = 'Black Ink'; // Assumption
        const eu_market_codes = ['DE', 'FR', 'IT', 'ES', 'NL'];
        const marketKey = eu_market_codes.includes(market_code) ? 'EU' : market_code;
        console.log("scrapers.js: Calculation parameters:", { book_type, market_code, trim_size, page_count, bsr });

        let printing_cost = 0;
        let is_supported = true;

        // Use .includes() for more flexible matching (e.g., "Mass Market Paperback")
        if (book_type.includes('paperback')) {
            if (page_count >= 24 && page_count < 110) {
                const costs = { USD: 2.30, CAD: 2.99, YEN: 422, GBP: 1.93, AUD: 4.74, EU: 2.05, PL: 9.58, SE: 22.84 };
                const largeCosts = { USD: 2.84, CAD: 3.53, YEN: 530, GBP: 2.15, AUD: 5.28, EU: 2.48, PL: 11.61, SE: 27.67 };
                printing_cost = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
            } else if (page_count >= 110 && page_count <= 828) {
                const costs = { USD: [1.00, 0.012], CAD: [1.26, 0.016], YEN: [206, 2], GBP: [0.85, 0.010], AUD: [2.42, 0.022], EU: [0.75, 0.012], PL: [3.51, 0.056], SE: [8.37, 0.134] };
                const largeCosts = { USD: [1.00, 0.017], CAD: [1.26, 0.021], YEN: [206, 3], GBP: [0.85, 0.012], AUD: [2.42, 0.027], EU: [0.75, 0.016], PL: [3.51, 0.075], SE: [8.37, 0.179] };
                const [fixed, perPage] = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                printing_cost = fixed + (page_count * perPage);
            } else { is_supported = false; }
        } else if (book_type.includes('hardcover')) {
            if (page_count >= 75 && page_count <= 108) {
                const costs = { USD: 6.80, GBP: 5.23, EU: 5.95, PL: 27.85, SE: 66.38 };
                const largeCosts = { USD: 7.49, GBP: 5.45, EU: 6.35, PL: 29.87, SE: 71.21 };
                if (costs[marketKey]) { printing_cost = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey]; } else { is_supported = false; }
            } else if (page_count >= 110 && page_count <= 550) {
                const costs = { USD: [5.65, 0.012], GBP: [4.15, 0.010], EU: [4.65, 0.012], PL: [20.34, 0.056], SE: [48.49, 0.134] };
                const largeCosts = { USD: [5.65, 0.017], GBP: [4.15, 0.012], EU: [4.65, 0.016], PL: [20.34, 0.075], SE: [48.49, 0.179] };
                if (costs[marketKey]) { const [fixed, perPage] = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey]; printing_cost = fixed + (page_count * perPage); } else { is_supported = false; }
            } else { is_supported = false; }
        } else { 
            is_supported = false; 
        }

        if (!is_supported || !printing_cost) {
            console.warn(`scrapers.js: Combination not supported (Type: ${book_type}, Pages: ${page_count}), falling back to simplified calculation`);
            return calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo);
        }
        printing_cost = parseFloat(printing_cost.toFixed(2));
        console.log(`scrapers.js: Calculated printing cost: ${printing_cost}`);

        let royalty_rate = 0.6;
        const threshold = royaltyThresholds_by_code[market_code];
        if (threshold && list_price < threshold) {
            royalty_rate = 0.5;
            console.log(`scrapers.js: Price is below threshold. Using royalty rate: ${royalty_rate}`);
        } else {
            console.log(`scrapers.js: Using default royalty rate: ${royalty_rate}`);
        }

        let VAT = 0, price_after_vat = list_price;
        if (eu_market_codes.includes(market_code)) {
            let vat_rate = 0.07; // DE, NL
            if (market_code === "FR") vat_rate = 0.055;
            if (["IT", "ES"].includes(market_code)) vat_rate = 0.04;
            VAT = list_price * vat_rate;
            price_after_vat = list_price - VAT;
            console.log(`scrapers.js: Applied VAT: ${VAT.toFixed(2)}. Price after VAT: ${price_after_vat.toFixed(2)}`);
        }
        
        const calculated_royalty = price_after_vat * royalty_rate - printing_cost;
        const royalty_amount = Math.max(0, parseFloat(calculated_royalty.toFixed(2))); // Ensure non-negative royalty
        const daily_sales = estimateSales(bsr, book_type, market_code);
        const monthly_sales = Math.round(daily_sales * 30);
        function customRoundRoyalty(value) {
            if (value >= 50) { // Threshold for rounding to nearest 100
                return Math.round(value / 100) * 100;
            } else { // Round to nearest 10 for smaller values
                return Math.round(value / 10) * 10;
            }
        }

        const monthly_royalty_unrounded = (royalty_amount > 0 ? royalty_amount * monthly_sales : 0);
        const monthly_royalty = customRoundRoyalty(monthly_royalty_unrounded);

        return {
            royalty_per_unit: royalty_amount,
            monthly_sales: monthly_sales,
            monthly_royalty: monthly_royalty,
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
        
        // Calculate for supported book formats
        const formatNameLower = currentFormat.formatName.toLowerCase();
        console.log(`scrapers.js: Format name (lowercase): "${formatNameLower}"`);
        
        if (formatNameLower.includes('paperback') || formatNameLower.includes('hardcover') || 
            formatNameLower.includes('kindle') || formatNameLower.includes('ebook')) {
            console.log(`scrapers.js: Calculating royalties for ${formatNameLower} format`);
            fullProductData.royalties = calculateRoyaltyAndSales(
                currentFormat,
                fullProductData.product_details,
                marketplaceInfo
            );
            console.log(`scrapers.js: Royalty calculation result:`, fullProductData.royalties);
        } else {
             console.log(`scrapers.js: Profitability calculation skipped for non-supported format: "${currentFormat.formatName}"`);
        }
    } else {
        console.warn("scrapers.js: Could not determine the currently selected format on the page.");
        console.log("scrapers.js: Available formats:", fullProductData.formats);
        
        // Fallback: try to use the first available format if any exist
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
                    getMarketplaceInfo()
                );
                console.log(`scrapers.js: Fallback royalty calculation result:`, fullProductData.royalties);
            } else {
                console.log(`scrapers.js: Fallback format also not supported: "${fallbackFormat.formatName}"`);
            }
        } else {
            console.error("scrapers.js: No formats found at all for this product");
        }
    }
    
    console.log("✅ Extraction Complete!");
    return fullProductData;
}
// ===================================================================================
// END OF SCRIPT: book_detail_page_extractor.js
// ===================================================================================


// This is the function that will be called from the background script.
// It doesn't need to be modified. It just runs the correct extractor.
function runExtractor() {
    console.log("scrapers.js: Running extractor.");
    if (document.querySelector('div[data-component-type="s-search-result"]')) {
        console.log("scrapers.js: SERP page detected. Running SERP analysis.");
        return runFullAmazonAnalysis();
    } else if (document.querySelector('span[id="productTitle"]')) {
        console.log("scrapers.js: Product detail page detected. Running deep-dive extraction.");
        return runFullProductPageExtraction();
    } else {
        console.error("scrapers.js: Unknown page type. Cannot run any extractor.");
        return { error: "Unknown page type." };
    }
}

/**
 * ===================================================================================
 * START OF SCRIPT: In-Memory HTML Parser for Offscreen Document
 * This function takes raw HTML and a URL, parses it, and extracts data without
 * needing a live browser tab.
 * ===================================================================================
 */
function parseProductPageFromHTML(htmlString, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // Helper function to query the in-memory document
    const find = (selector) => doc.querySelector(selector);
    const findAll = (selector) => doc.querySelectorAll(selector);

    // --- Adapt Helper Functions to use the 'doc' object ---
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
    
    // --- Adapted Extraction Logic ---
    function _extractProductDetails(doc) {
        // This is an adapted version of the original function
        const details = { bsr: null, print_length: null, publication_date: null, publisher: null, days_on_market: null, large_trim: false };
        const detailContainer = doc.querySelector("#detailBullets_feature_div, #productDetails_feature_div");

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
                details.publisher = publisherText.split('(')[0].trim();
                let pubDateText = findDetailValue("Publication date") || publisherText.match(/\(([^)]+)\)/)?.[1];
                details.publication_date = normalizeDate(pubDateText);
                if (details.publication_date) {
                    const timeDiff = new Date().getTime() - new Date(details.publication_date).getTime();
                    details.days_on_market = Math.floor(timeDiff / (1000 * 3600 * 24));
                }
            }
            
            const printLengthText = findDetailValue("Print length");
            if (printLengthText) {
                details.print_length = parseInt(printLengthText.match(/\d+/)[0], 10);
            }
            
            const dimensionsText = findDetailValue("Dimensions");
            if (dimensionsText) {
                const numbers = dimensionsText.match(/(\d+\.?\d*)/g);
                if (numbers && numbers.length === 3) {
                    const sortedDims = numbers.map(parseFloat).sort((a,b) => b-a);
                    const [height, width] = sortedDims;
                    const unitMatch = dimensionsText.match(/inches|cm/i);
                    const unit = unitMatch ? unitMatch[0].toLowerCase() : null;
                    if (unit === 'inches') details.large_trim = width > 6.12 || height > 9;
                    else if (unit === 'cm') details.large_trim = width > 15.54 || height > 22.86;
                }
            }
        }
        
        // BSR Extraction - Enhanced version based on runFullProductPageExtraction logic
        console.log("scrapers.js: [OFFSCREEN] Starting BSR extraction for URL:", url);
        try {
            let aElement = doc.querySelector('div[id="detailBulletsWrapper_feature_div"] a[href*="gp/bestseller"]');
            console.log("scrapers.js: [OFFSCREEN] Initial BSR aElement found:", !!aElement);
            
            if (!aElement) {
                const parentDiv = doc.getElementById('detailBulletsWrapper_feature_div');
                console.log("scrapers.js: [OFFSCREEN] Parent wrapper found:", !!parentDiv);
                if (parentDiv) {
                    const childDiv = parentDiv.querySelector('#detailBullets_feature_div');
                    console.log("scrapers.js: [OFFSCREEN] Child div found:", !!childDiv);
                    if (childDiv) {
                        const siblingUl = childDiv.nextElementSibling;
                        console.log("scrapers.js: [OFFSCREEN] Sibling UL found:", !!siblingUl);
                        if (siblingUl) {
                            aElement = siblingUl.querySelector('a');
                            console.log("scrapers.js: [OFFSCREEN] Alternative aElement found:", !!aElement);
                        }
                    }
                }
            }
            
            if (aElement) {
                const mainText = aElement.previousSibling;
                console.log("scrapers.js: [OFFSCREEN] BSR mainText found:", !!mainText);
                if (mainText) {
                    console.log("scrapers.js: [OFFSCREEN] BSR mainText content:", mainText.textContent);
                    const bsrMatch = mainText.textContent.match(/\d*,?\d+,?\d*/);
                    if (bsrMatch) {
                        details.bsr = parseInt(bsrMatch[0].replace(/,/g, ''), 10);
                        console.log("scrapers.js: [OFFSCREEN] Extracted BSR:", details.bsr);
                    } else {
                        console.log("scrapers.js: [OFFSCREEN] No BSR number match found in text");
                    }
                } else {
                    console.log("scrapers.js: [OFFSCREEN] No mainText found for BSR");
                }
            } else {
                console.log("scrapers.js: [OFFSCREEN] No BSR aElement found, trying fallback method");
                // Fallback to original simple method
                const bsrTextElement = [...findAll('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr')]
                    .find(el => el.textContent.includes('Best Sellers Rank'));
                console.log("scrapers.js: [OFFSCREEN] Fallback BSR element found:", !!bsrTextElement);
                if (bsrTextElement) {
                    console.log("scrapers.js: [OFFSCREEN] Fallback BSR element content:", bsrTextElement.textContent);
                    const bsrMatch = bsrTextElement.textContent.match(/#([\d,]+)/);
                    if(bsrMatch) {
                        details.bsr = parseInt(bsrMatch[1].replace(/,/g, ''), 10);
                        console.log("scrapers.js: [OFFSCREEN] Fallback extracted BSR:", details.bsr);
                    }
                }
            }
        } catch (e) {
            console.warn("scrapers.js: [OFFSCREEN] BSR extraction failed gracefully.", e.message);
        }
        
        console.log("scrapers.js: [OFFSCREEN] Final BSR value:", details.bsr);

        return details;
    }
    
    // --- Adapted Helper Functions ---
    const cleanPrice = (text) => {
        if (!text) return null;
        const match = text.match(/(\d{1,3}(?:[.,]\d{3})*[,.]\d{2}|\d+[,.]\d{2}|\d+)/);
        if (!match) return null;

        let priceStr = match[0].replace(/[$,€£¥]/g, ''); // Remove currency symbols
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

    function _getMarketplaceInfoFromURL(url) {
        const tldMap = {
            'amazon.com': { code: 'USD' }, 'amazon.ca': { code: 'CAD' }, 'amazon.co.uk': { code: 'GBP' },
            'amazon.de': { code: 'DE' }, 'amazon.fr': { code: 'FR' }, 'amazon.it': { code: 'IT' },
            'amazon.es': { code: 'ES' }, 'amazon.nl': { code: 'NL' }, 'amazon.com.au': { code: 'AUD' },
            'amazon.co.jp': { code: 'YEN' }, 'amazon.pl': { code: 'PL' }, 'amazon.se': { code: 'SE' }
        };
        for (const key in tldMap) {
            if (url.includes(key)) return tldMap[key];
        }
        return { code: 'USD' }; // Default fallback
    }

    // Sales estimation functions adapted for offscreen parsing
    const multipliers = {
      ebook: { USD: 1, GBP: 0.31, DE: 0.36, FR: 0.11, ES: 0.093, IT: 0.10, NL: 0.023, YEN: 0.22, IN: 0.021, CAD: 0.17, MEX: 0.044, AUD: 0.022, SE: 1, PL: 1 },
      paperback: { USD: 1, GBP: 0.16, DE: 0.19, FR: 0.055, ES: 0.048, IT: 0.053, NL: 0.012, YEN: 0.12, IN: 0.011, CAD: 0.089, MEX: 0.023, AUD: 0.011, SE: 1, PL: 1 },
      hardcover: { USD: 1, GBP: 0.16, DE: 0.19, FR: 0.055, ES: 0.048, IT: 0.053, NL: 0.012, YEN: 0.12, IN: 0.011, CAD: 0.089, MEX: 0.023, AUD: 0.011, SE: 1, PL: 1 }
    };
    const A = 3.35038, B = -0.29193, C = -0.070538;
    function _coreUnits(bsr) {
      if (bsr <= 100000) {
        const t = Math.log10(bsr);
        return 10 ** (A + B * t + C * t * t);
      }
      return 100000 / (100000 + (bsr - 100000) * 8);
    }
    function _getMultiplier(type, market) { return multipliers[type]?.[market] ?? 1; }
    function _estimateSales(bsr, bookType, market) {
      if (!Number.isFinite(bsr) || bsr < 1) return 0;
      return Math.max(0, 1.37 * _coreUnits(bsr) * _getMultiplier(bookType, market));
    }

    const royaltyThresholds_by_code = { USD: 9.99, DE: 9.99, FR: 9.99, IT: 9.99, ES: 9.99, NL: 9.99, GBP: 7.99, CAD: 13.99, AUD: 13.99, YEN: 1000, PL: 40, SE: 99 };

    // --- Adapted Format Extraction Logic ---
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
                isKindleUnlimited: isKU,
                isSelected
            });
        });

        return formats;
    }

    // --- Adapted Editorial Reviews Extraction ---
    function _extractEditorialReviews(doc) {
        const editorialContainer = doc.querySelector('#editorialReviews_feature_div');
        if (!editorialContainer) return null;

        const reviews = {};
        
        // Try primary structure first
        const expanderContainers = editorialContainer.querySelectorAll('.a-row.a-expander-container.a-expander-extend-container');
        
        if (expanderContainers.length > 0) {
            expanderContainers.forEach(container => {
                const titleElement = container.querySelector('h3');
                const contentElement = container.querySelector('.a-expander-content');
                
                if (titleElement && contentElement) {
                    const title = cleanText(titleElement.textContent);
                    const content = cleanText(contentElement.textContent);
                    if (title && content) {
                        reviews[title] = content;
                    }
                }
            });
        } else {
            // Fallback to alternative structure
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
                    
                    if (title && content) {
                        reviews[title] = content;
                    }
                }
            });
        }

        return Object.keys(reviews).length > 0 ? reviews : null;
    }

    // --- Adapted Author Info Extraction ---
    function _extractAuthorInfo(doc) {
        console.log("Offscreen: Starting extractAuthorInfo extraction");
        
        // This selector for byline authors is stable and does not need changes.
        const bylineAuthors = [...doc.querySelectorAll('#bylineInfo .author a.a-link-normal')]
            .map(a => cleanText(a.textContent))
            .filter(Boolean);
        console.log("Offscreen: Byline authors found:", bylineAuthors);

        // Use a more robust selector for the main author card container.
        // It combines a stable part of the ID with a stable part of the class name.
        const authorCard = doc.querySelector('div[id^="CardInstance"][class*="_about-the-author-card_style_cardParentDiv"]');
        console.log("Offscreen: Author card found:", !!authorCard);
        
        let biography = null, imageUrl = null, cardAuthorName = null;

        if (authorCard) {
            // Extract biography using a selector that ignores the unique hash.
            biography = getText(authorCard, 'div[class*="_peekableContent"]');
            console.log("Offscreen: Biography extracted:", biography ? "Found" : "Not found");
            if (biography?.includes("Discover more of the author's books")) {
                biography = null;
                console.log("Offscreen: Biography cleared (generic message detected)");
            }
            
            // Extract image URL using a stable class selector.
            imageUrl = getAttr(authorCard, 'img[class*="_authorImage"]', 'src');
            console.log("Offscreen: Image URL extracted:", imageUrl ? "Found" : "Not found");

            // Extract the author's name using a more specific and stable selector, avoiding generic tags like 'h2'.
            cardAuthorName = getText(authorCard, 'div[class*="_authorName"] a');
            console.log("Offscreen: Card author name extracted:", cardAuthorName);
        }
        
        // Prioritize byline authors if they exist, otherwise use the name from the card.
        const authorName = bylineAuthors.length > 0 ? bylineAuthors.join(', ') : cardAuthorName;
        console.log("Offscreen: Final author name:", authorName);
        
        if (!authorName) {
            console.warn("Offscreen: No author name found, returning null");
            return null;
        }
        
        // Check if the image is the default placeholder.
        const validImage = imageUrl && imageUrl !== "https://m.media-amazon.com/images/I/01Kv-W2ysOL._SY600_.png";
        
        // Count words in the biography.
        const bioWordCount = biography ? biography.trim().split(/\s+/).length : 0;
        
        const result = { 
            name: authorName, 
            biography, 
            imageUrl, 
            validImage, 
            bioWordCount 
        };
        console.log("Offscreen: Final author info result:", result);
        return result;
    }

    // Simplified fallback calculation for offscreen parser
    function _calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo) {
        console.log("Offscreen: Using simplified fallback royalty calculation");
        
        // Extract available data with fallbacks
        const prices = format.prices || [];
        let price = null;
        
        if (prices.length > 0) {
            // Use the same logic as mini table: highest price as list price
            const validPrices = prices.filter(p => p.price && p.price > 0).map(p => p.price);
            if (validPrices.length > 0) {
                price = Math.max(...validPrices);
            }
        }
        
        const bsr = productDetails.bsr || null;
        const pageCount = productDetails.print_length || 100; // Fallback to reasonable default
        const market_code = marketplaceInfo.code || 'USD';
        
        if (!price) {
            console.warn("Offscreen: No valid price found for simplified calculation");
            return { error: "No valid price found" };
        }
        
        // Calculate sales using existing logic if BSR is available
        let monthly_sales = 0;
        if (bsr) {
            const book_type = format.formatName.toLowerCase();
            const daily_sales = _estimateSales(bsr, book_type, market_code);
            monthly_sales = Math.round(daily_sales * 30);
        } else {
            // Provide a reasonable estimate if BSR is missing
            monthly_sales = 10; // Conservative fallback
            console.warn("Offscreen: No BSR available, using fallback monthly sales estimate");
        }
        
        // Simplified royalty calculation (mirrors mini table logic)
        let royaltyPerUnit = 0;
        const book_type = format.formatName.toLowerCase();
        
        if (book_type.includes('kindle') || book_type.includes('ebook')) {
            // Simplified Kindle royalty calculation
            if (price >= 2.99 && price <= 9.99) {
                royaltyPerUnit = price * 0.7; // 70% royalty
            } else {
                royaltyPerUnit = price * 0.35; // 35% royalty
            }
        } else if (book_type.includes('hardcover')) {
            // Simplified hardcover royalty calculation
            const printingCost = 5.65 + (pageCount * 0.012); // Simplified printing cost for hardcover
            const royaltyRate = price < 10 ? 0.5 : 0.6; // Simplified royalty rate
            royaltyPerUnit = Math.max(0, (price * royaltyRate) - printingCost);
        } else {
            // Simplified paperback royalty calculation (now the default fallback)
            const printingCost = 0.85 + (pageCount * 0.012); // Simplified printing cost for paperback
            const royaltyRate = price < 10 ? 0.5 : 0.6; // Simplified royalty rate
            royaltyPerUnit = Math.max(0, (price * royaltyRate) - printingCost);
        }
        
        const monthly_royalty = Math.round(royaltyPerUnit * monthly_sales);
        
        console.log("Offscreen: Simplified calculation result:", {
            royalty_per_unit: royaltyPerUnit.toFixed(2),
            monthly_sales,
            monthly_royalty
        });
        
        return {
            royalty_per_unit: parseFloat(royaltyPerUnit.toFixed(2)),
            monthly_sales: monthly_sales,
            monthly_royalty: monthly_royalty,
            calculation_assumptions: {
                simplified: true,
                price_used: price,
                page_count_used: pageCount,
                bsr_used: bsr,
                book_type: book_type
            }
        };
    }

    // --- Adapted Royalty Calculation ---
    function _calculateRoyaltyAndSales(format, productDetails, marketplaceInfo) {
        const book_type = format.formatName.toLowerCase();
        if (!format.prices || format.prices.length === 0) {
            return { error: "No price found for this format." };
        }
        
        // Find the list price we identified in the previous step.
        const listPriceObject = format.prices.find(p => p.type === 'list_price');

        // If not found, fall back to the highest available price as a safety measure.
        const list_price = listPriceObject ? listPriceObject.price : Math.max(...format.prices.filter(p => p.type !== 'ku_price').map(p => p.price));
        const page_count = productDetails.print_length;
        const bsr = productDetails.bsr;
        
        // If essential data is missing, try simplified fallback calculation
        if (!list_price || !page_count || !bsr) {
            console.warn("Offscreen: Missing essential data for complex calculation, attempting simplified fallback.", { list_price, page_count, bsr });
            return _calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo);
        }

        const market_code = marketplaceInfo.code;
        const trim_size = productDetails.large_trim ? 'large' : 'regular';
        const eu_market_codes = ['DE', 'FR', 'IT', 'ES', 'NL'];
        const marketKey = eu_market_codes.includes(market_code) ? 'EU' : market_code;

        let printing_cost = 0;
        let is_supported = true;

        // Use .includes() for more flexible matching
        if (book_type.includes('paperback')) {
            if (page_count >= 24 && page_count < 110) {
                const costs = { USD: 2.30, CAD: 2.99, YEN: 422, GBP: 1.93, AUD: 4.74, EU: 2.05, PL: 9.58, SE: 22.84 };
                const largeCosts = { USD: 2.84, CAD: 3.53, YEN: 530, GBP: 2.15, AUD: 5.28, EU: 2.48, PL: 11.61, SE: 27.67 };
                printing_cost = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
            } else if (page_count >= 110 && page_count <= 828) {
                const costs = { USD: [1.00, 0.012], CAD: [1.26, 0.016], YEN: [206, 2], GBP: [0.85, 0.010], AUD: [2.42, 0.022], EU: [0.75, 0.012], PL: [3.51, 0.056], SE: [8.37, 0.134] };
                const largeCosts = { USD: [1.00, 0.017], CAD: [1.26, 0.021], YEN: [206, 3], GBP: [0.85, 0.012], AUD: [2.42, 0.027], EU: [0.75, 0.016], PL: [3.51, 0.075], SE: [8.37, 0.179] };
                const [fixed, perPage] = trim_size === 'regular' ? costs[marketKey] : largeCosts[marketKey];
                printing_cost = fixed + (page_count * perPage);
            } else { is_supported = false; }
        } else if (book_type.includes('hardcover')) {
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

        if (!is_supported || !printing_cost) {
            console.warn(`Offscreen: Combination not supported (Type: ${book_type}, Pages: ${page_count}), falling back to simplified calculation`);
            return _calculateSimplifiedRoyalty(format, productDetails, marketplaceInfo);
        }
        printing_cost = parseFloat(printing_cost.toFixed(2));

        let royalty_rate = 0.6;
        const threshold = royaltyThresholds_by_code[market_code];
        if (threshold && list_price < threshold) {
            royalty_rate = 0.5;
        }

        let VAT = 0, price_after_vat = list_price;
        if (eu_market_codes.includes(market_code)) {
            let vat_rate = 0.07; // DE, NL
            if (market_code === "FR") vat_rate = 0.055;
            if (["IT", "ES"].includes(market_code)) vat_rate = 0.04;
            VAT = list_price * vat_rate;
            price_after_vat = list_price - VAT;
        }
        
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

        return {
            royalty_per_unit: royalty_amount,
            monthly_sales: monthly_sales,
            monthly_royalty: monthly_royalty,
            calculation_assumptions: {
                interior_type: 'Black Ink', list_price_used: list_price,
                royalty_rate_used: royalty_rate, printing_cost: printing_cost,
                bsr_used: bsr, vat_applied: parseFloat(VAT.toFixed(2))
            }
        };
    }
    
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    const fullProductData = {
        asin: asinMatch ? asinMatch[1] : null,
        title: find('span#productTitle')?.textContent.trim() || null,
        cover_url: find('img#landingImage')?.src || null,
        product_details: _extractProductDetails(doc),
        formats: _extractAmazonBookFormats(doc, url),
        customer_reviews: {
            average_rating: parseFloat(find('div#averageCustomerReviews a span.a-icon-alt')?.textContent),
            review_count: parseInt(find('span#acrCustomerReviewText')?.textContent.replace(/,/g, '')),
            review_image_count: doc.querySelectorAll('#cm_cr_carousel_images_section .a-carousel-card').length
        },
        aplus_content: { modulesCount: findAll('[data-aplus-module], .aplus-module').length },
        ugc_videos: { video_count: findAll('[data-video-url], .video-block').length },
        editorial_reviews: _extractEditorialReviews(doc),
        author_info: _extractAuthorInfo(doc),
        royalties: null // Will be calculated below
    };

    // --- INTEGRATE ROYALTY CALCULATION ---
    const marketplaceInfo = _getMarketplaceInfoFromURL(url);
    const currentFormat = fullProductData.formats.find(f => f.isSelected);
    console.log(`Offscreen: Current format detected:`, currentFormat?.formatName, `- Selected:`, currentFormat?.isSelected);
    console.log(`Offscreen: All formats available:`, fullProductData.formats.map(f => ({name: f.formatName, selected: f.isSelected})));
    
    if (currentFormat) {
        const formatNameLower = currentFormat.formatName.toLowerCase();
        console.log(`Offscreen: Format name (lowercase): "${formatNameLower}"`);
        
        // Expand format checking to include more book types
        if (formatNameLower.includes('paperback') || formatNameLower.includes('hardcover') || 
            formatNameLower.includes('kindle') || formatNameLower.includes('ebook')) {
            console.log(`Offscreen: Calculating royalties for ${formatNameLower} format`);
            fullProductData.royalties = _calculateRoyaltyAndSales(
                currentFormat,
                fullProductData.product_details,
                marketplaceInfo
            );
            console.log(`Offscreen: Royalty calculation result:`, fullProductData.royalties);
        } else {
            console.log(`Offscreen: Profitability calculation skipped for non-supported format: "${currentFormat.formatName}"`);
        }
    } else {
        console.warn("Offscreen: Could not determine the currently selected format on the page.");
        console.log("Offscreen: Available formats:", fullProductData.formats);
        
        // Fallback: try to use the first available format if any exist
        if (fullProductData.formats && fullProductData.formats.length > 0) {
            const fallbackFormat = fullProductData.formats[0];
            const formatNameLower = fallbackFormat.formatName.toLowerCase();
            console.log(`Offscreen: Using fallback format: "${fallbackFormat.formatName}"`);
            
            if (formatNameLower.includes('paperback') || formatNameLower.includes('hardcover') || 
                formatNameLower.includes('kindle') || formatNameLower.includes('ebook')) {
                console.log(`Offscreen: Calculating royalties for fallback ${formatNameLower} format`);
                fullProductData.royalties = _calculateRoyaltyAndSales(
                    fallbackFormat,
                    fullProductData.product_details,
                    marketplaceInfo
                );
                console.log(`Offscreen: Fallback royalty calculation result:`, fullProductData.royalties);
            } else {
                console.log(`Offscreen: Fallback format also not supported: "${fallbackFormat.formatName}"`);
            }
        } else {
            console.error("Offscreen: No formats found at all for this product");
        }
    }

    console.log(`scrapers.js: [OFFSCREEN] Successfully parsed ${url}`);
    console.log(`scrapers.js: [OFFSCREEN] Returning full product data:`, {
        hasProductDetails: !!(fullProductData && fullProductData.product_details),
        bsrValue: fullProductData?.product_details?.bsr,
        fullProductDetailsKeys: fullProductData?.product_details ? Object.keys(fullProductData.product_details) : 'no product_details',
        fullDataKeys: fullProductData ? Object.keys(fullProductData) : 'no data'
    });
    return fullProductData;
}