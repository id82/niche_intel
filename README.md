# Amazon SERP Deep-Dive Chrome Extension

**Version:** 1.49  
**Status:** Production Ready - Enhanced  
**Last Updated:** January 2025

## Overview

A comprehensive Chrome extension for Amazon market research that analyzes search results pages (SERPs) and extracts detailed product information. Designed for book market analysis, the extension provides competitive intelligence including sales estimates, royalty calculations, and content analysis.

## Core Functionality

### 1. SERP Analysis
- **Product Classification**: Identifies organic vs sponsored placements (O, SP, OC, SC, SB, BV, PV)
- **Position Mapping**: Tracks product positions and placement types across search results
- **Page Ownership Analysis**: Calculates market share by author/brand using weighted scoring
- **Product Data Extraction**: Title, author, rating, review count, price, cover images

### 2. Deep-Dive Product Analysis
- **Product Details**: BSR, publication date, publisher info, dimensions, page count
- **Content Analysis**: A+ modules, editorial reviews, UGC videos, customer review images
- **Format Detection**: Paperback, hardcover, Kindle, audiobook with pricing
- **Badge Status**: Bestseller, new release, Amazon Charts detection
- **Author Information**: Biography, image, book count with fallback extraction

### 3. Financial Analysis
- **Sales Estimation**: BSR-based daily/monthly sales estimates across marketplaces
- **Royalty Calculation**: Printing costs, VAT, royalty rates for physical books
- **Market Intelligence**: Days on market, large trim detection, competitive analysis

## Technical Architecture

### File Structure
```
├── manifest.json          # Extension configuration (v1.49)
├── background.js          # Service worker - orchestrates analysis
├── popup.html/js          # Extension popup interface with start/stop controls
├── scrapers.js           # Combined SERP & product page extractors
├── report.html/js/css    # Analysis results display with export
├── icons/                # Extension icons (16px to 128px)
├── reference/            # Legacy extractor scripts (DO NOT MODIFY)
│   ├── book_detail_page_extractor.js
│   └── serp_classifier_asin_extractor.js
├── incognito_guidance.md # Incognito implementation guide
├── best_practices.md     # Chrome extension best practices (updated)
└── GEMINI.md            # Version increment reminder
```

### Key Technical Features
- **Incognito Support**: `"incognito": "split"` with proper window handling
- **Concurrent Processing**: 5 tabs processed simultaneously with staggered delays
- **Retry Mechanism**: Automatic retry for failed extractions with exponential backoff
- **Tab Management**: Monitored background tabs with cleanup on completion/error
- **Multi-Marketplace**: Supports 11+ Amazon domains with localized calculations
- **Stop/Resume Control**: User can stop analysis mid-process
- **Error Handling**: Comprehensive try-catch blocks with user feedback
- **Memory Management**: Storage cleanup prevents leaks
- **Rate Limiting**: 200ms staggered delays + 1s between batches

### Permissions
```json
{
  "permissions": ["activeTab", "scripting", "storage", "tabs", "windows"],
  "host_permissions": ["*://*.amazon.*/*"],
  "incognito": "split"
}
```

## Current Data Flow

1. **User Activation**: Click extension popup on Amazon SERP
2. **SERP Analysis**: Extract product info + classify placements
3. **Concurrent Processing**: Open 5 background tabs simultaneously (staggered)
4. **Data Extraction**: Scrape detailed product information per ASIN with retry logic
5. **Real-time Updates**: Report populates progressively as tabs complete
6. **Report Generation**: Aggregate data in interactive HTML report with progress bar
7. **Export/Cleanup**: CSV export available, tabs closed, storage cleared

## Report Features

### Table Columns
- **Basic**: Position, Type, Badge, ASIN (clickable), Cover, Title/Author
- **Metrics**: Reviews (avg), Rating (avg), Review Images (avg), Formats (avg)
- **Market Data**: BSR (avg), Days on Market (avg), Large Trim (%), A+ Modules (avg)
- **Content**: UGC Videos (avg), Editorial Reviews (%), Publisher
- **Financial**: Royalty/Book (avg), Royalty/Month (avg)

### Badge Acronyms
- `BS` = Bestseller
- `NR` = New Release  
- `AC` = Amazon Charts
- `unknown/absent` = Empty

### Formatting
- **Right-aligned**: All numeric columns (Reviews onwards) + totals row
- **Comma formatting**: Large numbers (reviews, days, BSR)
- **Percentages**: 0 decimal places (15% not 15.00%)
- **Currency**: $X.XX format with proper rounding
- **Progress Bar**: Visual percentage indicator during processing
- **Export Button**: CSV download appears after completion

## Known Limitations

1. **Processing Limit**: Currently processes first 10 products only
2. **Book Focus**: Optimized for book products (filters non-books)
3. **Physical Books Only**: Royalty calculations limited to paperback/hardcover
4. **Single SERP**: One search results page per analysis
5. **Batch Processing**: 5 tabs max concurrency to respect server limits

## Development Notes

### Recent Improvements (v1.46-1.49)
- ✅ **Concurrent Processing**: 5 tabs simultaneously with staggered delays
- ✅ **Retry Mechanism**: Auto-retry failed extractions (max 3 attempts)
- ✅ **Stop/Start Control**: User can stop analysis mid-process
- ✅ **Progress Indicators**: Visual progress bar and enhanced status
- ✅ **Data Export**: CSV download functionality
- ✅ **Rate Limiting**: 200ms staggered delays prevent server overload
- ✅ **UI Enhancements**: Start/stop buttons, better alignment
- ✅ **Best Practices**: Applied Chrome extension development standards

### Code Quality
- **Error Handling**: Try-catch blocks with retry logic and detailed logging
- **Resource Management**: Smart tab cleanup and storage management
- **State Management**: Proper analysis state tracking and user control
- **Best Practices**: Follows Chrome extension development guidelines
- **Performance**: Concurrent processing with rate limiting and progress feedback

### Debugging
- Background script: `chrome://extensions` → "Inspect views: Service Worker"
- Content scripts: Regular DevTools on Amazon pages
- Report page: Regular DevTools on report.html tab
- Storage: Application tab → Storage → Extension

## Future Development Ideas

### Potential Enhancements
1. **Bulk Processing**: Handle multiple SERP pages
2. **Data Export**: CSV/Excel export functionality  
3. **Historical Tracking**: Store and compare analysis over time
4. **Advanced Filters**: Filter by price range, rating, review count
5. **Keyword Analysis**: Extract and analyze search terms
6. **Competitor Tracking**: Track specific authors/publishers
7. **Market Trends**: Analyze BSR movement over time
8. **eBook Analysis**: Extend royalty calculations to Kindle books

### Technical Improvements
1. **Parallel Processing**: Batch tab opening with rate limiting
2. **Caching**: Cache product data to avoid re-scraping
3. **API Integration**: Amazon Product Advertising API integration
4. **Database**: Local storage replacement with IndexedDB
5. **Visualization**: Charts and graphs for market analysis
6. **Notifications**: Progress notifications and completion alerts

## Installation & Usage

1. **Load Extension**: `chrome://extensions` → "Load unpacked" → Select folder
2. **Enable Incognito**: Toggle "Allow in Incognito" in extension details
3. **Navigate**: Go to Amazon search results page with book products
4. **Start Analysis**: Click extension icon → "Start Analysis"
5. **Monitor Progress**: Watch progress bar and real-time table updates
6. **Stop if Needed**: Click "Stop Analysis" to terminate early
7. **Export Data**: Click "Export Data (CSV)" when analysis completes

## Troubleshooting

- **No data extracted**: Ensure on Amazon search results page with book products
- **Incognito issues**: Verify "Allow in Incognito" is enabled
- **Analysis stuck**: Use "Stop Analysis" button to terminate and restart
- **Tab not closing**: Background tabs auto-close after data extraction
- **Missing authors**: Extension retries and updates from individual pages
- **Failed extractions**: Automatic retry mechanism attempts up to 3 times
- **Storage errors**: Extension cleans up automatically after analysis

---

**⚠️ Important**: Always increment `manifest.json` version when making changes (per GEMINI.md)

**🔒 Security**: Extension only accesses Amazon domains and internal resources. No external API calls or data transmission.