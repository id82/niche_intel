/**
 * Calculations Module
 * Totals and statistics calculations
 */

import { getCurrentDomain } from './state.js';
import { getCurrencySymbol, get } from './utils.js';

export function clearTotalsRows() {
    const currencySymbol = getCurrencySymbol(getCurrentDomain());

    // Clear main totals row
    document.getElementById('avg-price').textContent = `${currencySymbol}0.00`;
    document.getElementById('total-reviews').textContent = '0';
    document.getElementById('avg-rating').textContent = '0.00';
    document.getElementById('total-review-images').textContent = '0';
    document.getElementById('avg-formats').textContent = '0.0';
    document.getElementById('avg-bsr').textContent = 'N/A';
    document.getElementById('avg-days').textContent = 'N/A';
    document.getElementById('avg-length').textContent = '0';
    document.getElementById('pct-large-trim').textContent = '0%';
    document.getElementById('avg-aplus').textContent = '0.0';
    document.getElementById('avg-ugc-videos').textContent = '0.0';
    document.getElementById('pct-editorial-reviews').textContent = '0%';
    document.getElementById('avg-royalty-unit').textContent = `${currencySymbol}0.00`;
    document.getElementById('total-royalty-month').textContent = `${currencySymbol}0`;

    // Clear high royalty totals row
    document.getElementById('high-royalty-count').textContent = '0';
    document.getElementById('high-avg-price').textContent = `${currencySymbol}0.00`;
    document.getElementById('high-total-reviews').textContent = '0';
    document.getElementById('high-avg-rating').textContent = '0.00';
    document.getElementById('high-total-review-images').textContent = '0';
    document.getElementById('high-avg-formats').textContent = '0.0';
    document.getElementById('high-avg-bsr').textContent = 'N/A';
    document.getElementById('high-avg-days').textContent = 'N/A';
    document.getElementById('high-avg-length').textContent = '0';
    document.getElementById('high-pct-large-trim').textContent = '0%';
    document.getElementById('high-avg-aplus').textContent = '0.0';
    document.getElementById('high-avg-ugc-videos').textContent = '0.0';
    document.getElementById('high-pct-editorial-reviews').textContent = '0%';
    document.getElementById('high-avg-royalty-unit').textContent = `${currencySymbol}0.00`;
    document.getElementById('high-total-royalty-month').textContent = `${currencySymbol}0`;
}

export function calculateAndDisplayTotals(allData) {
    const totals = {
        reviewsSum: 0, reviewsCount: 0,
        ratingSum: 0, ratingCount: 0,
        reviewImagesSum: 0, reviewImagesCount: 0,
        bsrSum: 0, bsrCount: 0,
        daysSum: 0, daysCount: 0,
        lengthSum: 0, lengthCount: 0,
        aplusSum: 0, aplusCount: 0,
        ugcVideos: 0, ugcCount: 0,
        royaltyUnitSum: 0, royaltyUnitCount: 0,
        royaltyMonthSum: 0, royaltyMonthCount: 0,
        formatSum: 0, formatCount: 0,
        priceSum: 0, priceCount: 0,
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

    const currencySymbol = getCurrencySymbol(getCurrentDomain());
    document.getElementById('avg-price').textContent = (totals.priceCount > 0 ? `${currencySymbol}${(totals.priceSum / totals.priceCount).toFixed(2)}` : `${currencySymbol}0.00`);
    document.getElementById('total-reviews').textContent = (totals.reviewsCount > 0 ? Math.round(totals.reviewsSum / totals.reviewsCount).toLocaleString() : '0');
    document.getElementById('avg-rating').textContent = (totals.ratingCount > 0 ? (totals.ratingSum / totals.ratingCount).toFixed(2) : '0.00');
    document.getElementById('total-review-images').textContent = (totals.reviewImagesCount > 0 ? Math.round(totals.reviewImagesSum / totals.reviewImagesCount).toLocaleString() : '0');
    document.getElementById('avg-bsr').textContent = (totals.bsrCount > 0 ? Math.round(totals.bsrSum / totals.bsrCount).toLocaleString() : 'N/A');
    document.getElementById('avg-days').textContent = (totals.daysCount > 0 ? Math.round(totals.daysSum / totals.daysCount).toLocaleString() : 'N/A');
    document.getElementById('avg-length').textContent = (totals.lengthCount > 0 ? Math.round(totals.lengthSum / totals.lengthCount).toLocaleString() : 'N/A');
    document.getElementById('avg-aplus').textContent = (totals.aplusCount > 0 ? (totals.aplusSum / totals.aplusCount).toFixed(1) : '0.0');
    document.getElementById('avg-ugc-videos').textContent = (totals.ugcCount > 0 ? (totals.ugcVideos / totals.ugcCount).toFixed(1) : '0.0');
    document.getElementById('avg-royalty-unit').textContent = (totals.royaltyUnitCount > 0 ? `${currencySymbol}${(totals.royaltyUnitSum / totals.royaltyUnitCount).toFixed(2)}` : `${currencySymbol}0.00`);
    document.getElementById('total-royalty-month').textContent = (totals.royaltyMonthCount > 0 ? `${currencySymbol}${Math.round(totals.royaltyMonthSum / totals.royaltyMonthCount).toLocaleString()}` : `${currencySymbol}0`);

    const avgFormats = totals.formatCount > 0 ? (totals.formatSum / totals.formatCount).toFixed(1) : '0.0';
    document.getElementById('avg-formats').textContent = avgFormats;

    const pctLargeTrim = totals.totalProducts > 0 ? Math.round((totals.largeTrimYesCount / totals.totalProducts) * 100) + '%' : '0%';
    document.getElementById('pct-large-trim').textContent = pctLargeTrim;

    const pctEditorialReviews = totals.totalProducts > 0 ? Math.round((totals.editorialReviewsYesCount / totals.totalProducts) * 100) + '%' : '0%';
    document.getElementById('pct-editorial-reviews').textContent = pctEditorialReviews;
}

export function calculateAndDisplayHighRoyaltyTotals(allData) {
    console.log("report.js: Starting calculateAndDisplayHighRoyaltyTotals with data:", allData.length, "products");

    // Filter for books with monthly royalty >= $500
    const highRoyaltyBooks = allData.filter(data => {
        if (!data || !data.royalties) return false;

        const royaltyMonth = get(['royalties', 'monthly_royalty'], data);

        if (data.royalties.error && (royaltyMonth === null || royaltyMonth === undefined)) {
            return false;
        }

        return royaltyMonth !== null && royaltyMonth !== undefined && royaltyMonth >= 500;
    });

    console.log(`report.js: Found ${highRoyaltyBooks.length} high royalty books (>=$500/month)`);

    const highTotals = {
        reviewsSum: 0, reviewsCount: 0,
        ratingSum: 0, ratingCount: 0,
        reviewImagesSum: 0, reviewImagesCount: 0,
        bsrSum: 0, bsrCount: 0,
        daysSum: 0, daysCount: 0,
        lengthSum: 0, lengthCount: 0,
        aplusSum: 0, aplusCount: 0,
        ugcVideos: 0, ugcCount: 0,
        royaltyUnitSum: 0, royaltyUnitCount: 0,
        royaltyMonthSum: 0, royaltyMonthCount: 0,
        formatSum: 0, formatCount: 0,
        priceSum: 0, priceCount: 0,
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

        const formats = get(['formats'], data);
        let price = null;
        if (formats && formats.length > 0) {
            const currentFormat = formats.find(f => f.isSelected) || formats.find(f => f.formatName.toLowerCase() === 'paperback') || formats[0];
            if (currentFormat && currentFormat.prices && currentFormat.prices.length > 0) {
                const listPrice = currentFormat.prices.find(p => p.type === 'list_price')?.price;
                price = listPrice || Math.max(...currentFormat.prices.map(p => p.price));
            }
        }

        if (reviewCount !== null && reviewCount !== undefined) { highTotals.reviewsSum += reviewCount; highTotals.reviewsCount++; }
        if (avgRating) { highTotals.ratingSum += avgRating; highTotals.ratingCount++; }
        if (reviewImages !== null && reviewImages !== undefined) { highTotals.reviewImagesSum += reviewImages; highTotals.reviewImagesCount++; }
        if (bsr) { highTotals.bsrSum += bsr; highTotals.bsrCount++; }
        if (days) { highTotals.daysSum += days; highTotals.daysCount++; }
        if (pageCount) { highTotals.lengthSum += pageCount; highTotals.lengthCount++; }
        if (aplus) { highTotals.aplusSum += aplus; highTotals.aplusCount++; }
        if (ugc !== null && ugc !== undefined) { highTotals.ugcVideos += ugc; highTotals.ugcCount++; }
        if (royaltyUnit) { highTotals.royaltyUnitSum += royaltyUnit; highTotals.royaltyUnitCount++; }
        if (royaltyMonth !== null && royaltyMonth !== undefined) { highTotals.royaltyMonthSum += royaltyMonth; highTotals.royaltyMonthCount++; }
        if (formatCount) { highTotals.formatSum += formatCount; highTotals.formatCount++; }
        if (price !== null && price !== undefined) { highTotals.priceSum += price; highTotals.priceCount++; }
        if (largeTrim) { highTotals.largeTrimYesCount++; }
        if (editorialReviews && Object.keys(editorialReviews).length > 0) { highTotals.editorialReviewsYesCount++; }
        highTotals.totalProducts++;
    }

    // Count books published in the last 90 days
    const recentBooksCount = highRoyaltyBooks.filter(data => {
        const daysOnMarket = get(['product_details', 'days_on_market'], data);
        return daysOnMarket !== null && daysOnMarket !== undefined && daysOnMarket <= 90;
    }).length;

    const totalBooks = allData.length;
    const countText = highTotals.totalProducts > 0
        ? `${highTotals.totalProducts}/${totalBooks} books (${recentBooksCount} with <90 days on market)`
        : `0/${totalBooks} books`;
    document.getElementById('high-royalty-count').textContent = countText;

    const currencySymbol = getCurrencySymbol(getCurrentDomain());
    document.getElementById('high-avg-price').textContent = highTotals.priceCount > 0 ? `${currencySymbol}${(highTotals.priceSum / highTotals.priceCount).toFixed(2)}` : `${currencySymbol}0.00`;
    document.getElementById('high-total-reviews').textContent = highTotals.reviewsCount > 0 ? Math.round(highTotals.reviewsSum / highTotals.reviewsCount).toLocaleString() : '0';
    document.getElementById('high-avg-rating').textContent = highTotals.ratingCount > 0 ? (highTotals.ratingSum / highTotals.ratingCount).toFixed(2) : '0.00';
    document.getElementById('high-total-review-images').textContent = highTotals.reviewImagesCount > 0 ? Math.round(highTotals.reviewImagesSum / highTotals.reviewImagesCount).toLocaleString() : '0';
    document.getElementById('high-avg-bsr').textContent = highTotals.bsrCount > 0 ? Math.round(highTotals.bsrSum / highTotals.bsrCount).toLocaleString() : 'N/A';
    document.getElementById('high-avg-days').textContent = highTotals.daysCount > 0 ? Math.round(highTotals.daysSum / highTotals.daysCount).toLocaleString() : 'N/A';
    document.getElementById('high-avg-length').textContent = highTotals.lengthCount > 0 ? Math.round(highTotals.lengthSum / highTotals.lengthCount).toLocaleString() : 'N/A';
    document.getElementById('high-avg-aplus').textContent = highTotals.aplusCount > 0 ? (highTotals.aplusSum / highTotals.aplusCount).toFixed(1) : '0.0';
    document.getElementById('high-avg-ugc-videos').textContent = highTotals.ugcCount > 0 ? (highTotals.ugcVideos / highTotals.ugcCount).toFixed(1) : '0.0';
    document.getElementById('high-avg-royalty-unit').textContent = highTotals.royaltyUnitCount > 0 ? `${currencySymbol}${(highTotals.royaltyUnitSum / highTotals.royaltyUnitCount).toFixed(2)}` : `${currencySymbol}0.00`;
    document.getElementById('high-total-royalty-month').textContent = highTotals.royaltyMonthCount > 0 ? `${currencySymbol}${Math.round(highTotals.royaltyMonthSum / highTotals.royaltyMonthCount).toLocaleString()}` : `${currencySymbol}0`;

    document.getElementById('high-avg-formats').textContent = highTotals.formatCount > 0 ? (highTotals.formatSum / highTotals.formatCount).toFixed(1) : '0.0';
    document.getElementById('high-pct-large-trim').textContent = highTotals.totalProducts > 0 ? Math.round((highTotals.largeTrimYesCount / highTotals.totalProducts) * 100) + '%' : '0%';
    document.getElementById('high-pct-editorial-reviews').textContent = highTotals.totalProducts > 0 ? Math.round((highTotals.editorialReviewsYesCount / highTotals.totalProducts) * 100) + '%' : '0%';
}
