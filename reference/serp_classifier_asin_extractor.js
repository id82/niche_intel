/**
 * Amazon SERP Classifier & ASIN Extractor v2.6
 * This script performs a comprehensive analysis of an Amazon search results page.
 *
 * v2.4: Implemented a more robust, multi-selector approach for extracting review counts.
 * v2.5: Added author dominance and page ownership analysis.
 * v2.6: Converted scores to ownership percentage, added ASIN-level analysis, and updated scoring values.
 *
 * Designed to be run directly in the Chrome Developer Console.
 */
function runFullAmazonAnalysis() {
  console.log("--- Amazon Page Analysis v2.6 Initialized ---");

  // ===================================================================
  // STEP 1: EXTRACT DETAILED PRODUCT INFO FROM ALL CARDS (v2.4 LOGIC)
  // ===================================================================
  function extractProductInfo() {
    const productInfo = {};
    const productCards = document.querySelectorAll('div[data-component-type="s-search-result"]');

    console.log(`Found ${productCards.length} product cards to process for detailed info.`);

    productCards.forEach(card => {
      try {
        // Extract ASIN with validation
        const asin = card.dataset.asin;
        if (!asin || asin.length < 10 || productInfo[asin]) {
          return;
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
          const authorBlock = titleBlock.querySelector('div[class="a-row a-size-base a-color-secondary"]');
          if (authorBlock) {
            const authorSpans = authorBlock.querySelectorAll('span');
            authorSpans.forEach(span => {
              const text = span.textContent.trim();
              if (text.length > 3 && 
                  !text.toLowerCase().includes(' et al') && 
                  !text.toLowerCase().includes('book ') && 
                  !text.toLowerCase().includes('part of:')) {
                product.authors.push(text);
              }
            });
          }
        }
        if (product.authors.length === 0) {
          const authorElement = card.querySelector('.a-row.a-size-base.a-color-secondary');
          if (authorElement) {
            let authorText = authorElement.textContent.trim();
            if (authorText.toLowerCase().startsWith('by ')) {
              authorText = authorText.substring(3).trim();
              if (!authorText.toLowerCase().includes('book ') && !authorText.toLowerCase().includes('part of:')) {
                const cleanAuthor = authorText.split('|')[0].trim().replace(/\s\s+/g, ' ');
                if (cleanAuthor.length > 3) {
                  product.authors.push(cleanAuthor);
                }
              }
            }
          }
        }

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
        let priceBlock = card.querySelector('div[data-cy="price-recipe"]');
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
          prices.sort((a, b) => a - b);
          if (prices.length === 1) {
            product.currentPrice = prices[0];
            product.listPrice = prices[0];
          } else {
            product.currentPrice = prices[0];
            product.listPrice = prices[1];
            if (prices.length > 2) {
                console.warn(`Product ${asin}: Found ${prices.length} prices, using first two:`, prices);
            }
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

    console.log(`Extracted info for ${Object.keys(productInfo).length} unique products.`);
    return productInfo;
  }

  // ===================================================================
  // STEP 2: CLASSIFY PAGE BLOCKS AND BUILD POSITIONAL DATA (Unchanged)
  // ===================================================================
  function classifyAndMapPositions() {
    const containerSelector = 'span[data-component-type="s-search-results"] > div.s-main-slot.s-result-list';
    const searchResultsContainer = document.querySelector(containerSelector);
    if (!searchResultsContainer) {
      console.error("Error: Main search results container not found.");
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
    
    return { orderedResults, positions };
  }

  // ===================================================================
  // STEP 3: ANALYZE PAGE OWNERSHIP (NEW in v2.6)
  // ===================================================================
  function analyzePageOwnership(productInfo, positions) {
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
      console.warn("No scorable ASINs found on page. Cannot perform ownership analysis.");
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
    
    return { authorAnalysis, asinAnalysis };
  }

  // ===================================================================
  // EXECUTION AND OUTPUT
  // ===================================================================

  const productInfo = extractProductInfo();
  const { orderedResults, positions } = classifyAndMapPositions();
  const { authorAnalysis, asinAnalysis } = analyzePageOwnership(productInfo, positions);

  console.log("\n--- Final Ordered Classification (v2.6) ---");
  console.log("Each row represents a classified block from the search results page.");
  console.table(orderedResults);
  
  console.log("\n--- ASIN Positions Dictionary ---");
  console.log("A map of each ASIN to all its positions and types on the page.");
  console.log(positions);

  console.log("\n--- Product Info Dictionary ---");
  console.log("A map of each ASIN to its extracted product details.");
  console.log(productInfo);
  
  // --- Author Analysis Output ---
  console.log("\n--- Author Dominance Analysis (by Ownership %) ---");
  console.log("Authors ranked by their share of the page's total 'points'.");
  const sortedAuthors = Object.entries(authorAnalysis)
    .map(([name, data]) => ({
      'Author': name,
      'Ownership %': `${(data.ownershipPercentage * 100).toFixed(2)}%`,
      'Total Score': data.totalScore,
      'Unique ASINs': data.asinCount,
      'Total Placements': data.placementCount,
    }))
    .sort((a, b) => b['Total Score'] - a['Total Score']);

  if (sortedAuthors.length > 0) {
      console.table(sortedAuthors);
  } else {
      console.log("No authors were found to analyze.");
  }

  // --- ASIN Analysis Output ---
  console.log("\n--- ASIN Ownership Analysis (by Ownership %) ---");
  console.log("ASINs ranked by their share of the page's total 'points'.");
  const sortedAsins = Object.entries(asinAnalysis)
    .map(([asin, data]) => ({
      'ASIN': asin,
      'Title': data.title.substring(0, 50) + (data.title.length > 50 ? '...' : ''),
      'Ownership %': `${(data.ownershipPercentage * 100).toFixed(2)}%`,
      'Score': data.score,
      'Placements': data.positions.map(p => `${p.type} (Pos ${p.position})`).join(', '),
    }))
    .sort((a, b) => b.Score - a.Score);

  if (sortedAsins.length > 0) {
      console.table(sortedAsins);
  } else {
      console.log("No scorable ASINs were found to analyze.");
  }

  console.log("\n--- Detailed Ownership Breakdown (Raw Data) ---");
  console.log({ authorAnalysis, asinAnalysis });

  return { orderedResults, positions, productInfo, authorAnalysis, asinAnalysis };
}

// --- Run the full analysis ---
runFullAmazonAnalysis();