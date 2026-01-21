/**
 * Filters Module
 * Row filtering functionality
 */

import { getAllData, getActiveFilters, setActiveFilters } from './state.js';
import { getCellValue, debounce } from './utils.js';
import { calculateAndDisplayTotals, calculateAndDisplayHighRoyaltyTotals } from './calculations.js';
import { setupScrollSynchronization, cleanupScrollSynchronization } from './scroll-sync.js';
import { setupColumnButtonListeners, loadHiddenColumns, showAllColumns } from './column-visibility.js';

export function setupFilterFunctionality() {
    const filterToggle = document.getElementById('filterToggle');
    const filterContainer = document.getElementById('filter-container');
    const clearFiltersButton = document.getElementById('clearFilters');

    filterToggle.addEventListener('change', function () {
        if (this.checked) {
            filterContainer.style.display = 'flex';
            setTimeout(() => {
                setupScrollSynchronization();
            }, 100);
        } else {
            filterContainer.style.display = 'none';
            cleanupScrollSynchronization();
            clearAllFilters();
        }
    });

    clearFiltersButton.addEventListener('click', function () {
        clearAllFilters();
    });

    const columnToggle = document.getElementById('columnToggle');
    const columnContainer = document.getElementById('column-visibility-container');
    const showAllColumnsButton = document.getElementById('showAllColumns');

    columnToggle.addEventListener('change', function () {
        if (this.checked) {
            columnContainer.style.display = 'flex';
            setTimeout(() => {
                setupScrollSynchronization();
            }, 100);
        } else {
            columnContainer.style.display = 'none';
            cleanupScrollSynchronization();
        }
    });

    showAllColumnsButton.addEventListener('click', function () {
        showAllColumns();
    });

    setupColumnButtonListeners();
    loadHiddenColumns();
    setupFilterInputListeners();
}

function setupFilterInputListeners() {
    const inputs = document.querySelectorAll('.filter-input');
    inputs.forEach(input => {
        input.addEventListener('input', debounce(applyFilters, 300));
    });

    const selects = document.querySelectorAll('.filter-select');
    selects.forEach(select => {
        select.addEventListener('change', applyFilters);
    });
}

export function applyFilters() {
    const tbody = document.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    const allData = getAllData();

    setActiveFilters(buildActiveFilters());
    const activeFilters = getActiveFilters();

    let filteredData = [];

    rows.forEach(row => {
        const asin = row.dataset.asin;
        const isFocusedRow = row.classList.contains('focused-asin-row');
        const isVisible = isFocusedRow || passesAllFilters(row, activeFilters);

        if (isVisible) {
            row.style.display = '';
            const rowData = allData.find(item => item.asin === asin);
            if (rowData) {
                filteredData.push(rowData);
            }
        } else {
            row.style.display = 'none';
        }
    });

    calculateAndDisplayTotals(filteredData);
    calculateAndDisplayHighRoyaltyTotals(filteredData);
}

function buildActiveFilters() {
    const filters = {};

    const titleAuthorValue = document.getElementById('titleAuthorFilter').value.trim();
    if (titleAuthorValue && titleAuthorValue.length >= 3) {
        filters.titleAuthor = titleAuthorValue.toLowerCase();
    }

    const priceMin = parseFloat(document.getElementById('priceMin').value);
    const priceMax = parseFloat(document.getElementById('priceMax').value);
    if (!isNaN(priceMin) || !isNaN(priceMax)) {
        filters.price = { min: priceMin, max: priceMax };
    }

    const reviewsMin = parseInt(document.getElementById('reviewsMin').value);
    const reviewsMax = parseInt(document.getElementById('reviewsMax').value);
    if (!isNaN(reviewsMin) || !isNaN(reviewsMax)) {
        filters.reviews = { min: reviewsMin, max: reviewsMax };
    }

    const ratingMin = parseFloat(document.getElementById('ratingMin').value);
    const ratingMax = parseFloat(document.getElementById('ratingMax').value);
    if (!isNaN(ratingMin) || !isNaN(ratingMax)) {
        filters.rating = { min: ratingMin, max: ratingMax };
    }

    const reviewImagesMin = parseInt(document.getElementById('reviewImagesMin').value);
    const reviewImagesMax = parseInt(document.getElementById('reviewImagesMax').value);
    if (!isNaN(reviewImagesMin) || !isNaN(reviewImagesMax)) {
        filters.reviewImages = { min: reviewImagesMin, max: reviewImagesMax };
    }

    const formatsMin = parseInt(document.getElementById('formatsMin').value);
    const formatsMax = parseInt(document.getElementById('formatsMax').value);
    if (!isNaN(formatsMin) || !isNaN(formatsMax)) {
        filters.formats = { min: formatsMin, max: formatsMax };
    }

    const bsrMin = parseInt(document.getElementById('bsrMin').value);
    const bsrMax = parseInt(document.getElementById('bsrMax').value);
    if (!isNaN(bsrMin) || !isNaN(bsrMax)) {
        filters.bsr = { min: bsrMin, max: bsrMax };
    }

    const daysMarketMin = parseInt(document.getElementById('daysMarketMin').value);
    const daysMarketMax = parseInt(document.getElementById('daysMarketMax').value);
    if (!isNaN(daysMarketMin) || !isNaN(daysMarketMax)) {
        filters.daysMarket = { min: daysMarketMin, max: daysMarketMax };
    }

    const lengthMin = parseInt(document.getElementById('lengthMin').value);
    const lengthMax = parseInt(document.getElementById('lengthMax').value);
    if (!isNaN(lengthMin) || !isNaN(lengthMax)) {
        filters.length = { min: lengthMin, max: lengthMax };
    }

    const royaltyBookMin = parseFloat(document.getElementById('royaltyBookMin').value);
    const royaltyBookMax = parseFloat(document.getElementById('royaltyBookMax').value);
    if (!isNaN(royaltyBookMin) || !isNaN(royaltyBookMax)) {
        filters.royaltyBook = { min: royaltyBookMin, max: royaltyBookMax };
    }

    const royaltyMonthMin = parseFloat(document.getElementById('royaltyMonthMin').value);
    const royaltyMonthMax = parseFloat(document.getElementById('royaltyMonthMax').value);
    if (!isNaN(royaltyMonthMin) || !isNaN(royaltyMonthMax)) {
        filters.royaltyMonth = { min: royaltyMonthMin, max: royaltyMonthMax };
    }

    const largeTrimValue = document.getElementById('largeTrimFilter').value;
    if (largeTrimValue) filters.largeTrim = largeTrimValue;

    const aModulesValue = document.getElementById('aModulesFilter').value;
    if (aModulesValue) filters.aModules = aModulesValue;

    const ugcVideosValue = document.getElementById('ugcVideosFilter').value;
    if (ugcVideosValue) filters.ugcVideos = ugcVideosValue;

    const editorialReviewsValue = document.getElementById('editorialReviewsFilter').value;
    if (editorialReviewsValue) filters.editorialReviews = editorialReviewsValue;

    return filters;
}

function passesAllFilters(row, activeFilters) {
    if (activeFilters.titleAuthor && !passesTitleAuthorFilter(row, activeFilters.titleAuthor)) return false;

    if (activeFilters.price && !passesNumericalFilter(row, 5, activeFilters.price)) return false;
    if (activeFilters.reviews && !passesNumericalFilter(row, 6, activeFilters.reviews)) return false;
    if (activeFilters.rating && !passesNumericalFilter(row, 7, activeFilters.rating)) return false;
    if (activeFilters.reviewImages && !passesNumericalFilter(row, 8, activeFilters.reviewImages)) return false;
    if (activeFilters.formats && !passesNumericalFilter(row, 9, activeFilters.formats)) return false;
    if (activeFilters.bsr && !passesNumericalFilter(row, 10, activeFilters.bsr)) return false;
    if (activeFilters.daysMarket && !passesNumericalFilter(row, 11, activeFilters.daysMarket)) return false;
    if (activeFilters.length && !passesNumericalFilter(row, 12, activeFilters.length)) return false;
    if (activeFilters.royaltyBook && !passesNumericalFilter(row, 17, activeFilters.royaltyBook)) return false;
    if (activeFilters.royaltyMonth && !passesNumericalFilter(row, 18, activeFilters.royaltyMonth)) return false;

    if (activeFilters.largeTrim && !passesBooleanFilter(row, 13, activeFilters.largeTrim)) return false;
    if (activeFilters.aModules && !passesBooleanFilter(row, 14, activeFilters.aModules)) return false;
    if (activeFilters.ugcVideos && !passesBooleanFilter(row, 15, activeFilters.ugcVideos)) return false;
    if (activeFilters.editorialReviews && !passesBooleanFilter(row, 16, activeFilters.editorialReviews)) return false;

    return true;
}

function passesNumericalFilter(row, columnIndex, filter) {
    const cell = row.children[columnIndex];
    if (!cell) return true;

    const value = parseFloat(getCellValue(cell, 'number'));
    if (isNaN(value)) return true;

    if (!isNaN(filter.min) && value < filter.min) return false;
    if (!isNaN(filter.max) && value > filter.max) return false;

    return true;
}

function passesBooleanFilter(row, columnIndex, filterValue) {
    const cell = row.children[columnIndex];
    if (!cell) return true;

    return cell.textContent.trim() === filterValue;
}

function passesTitleAuthorFilter(row, filterValue) {
    const cell = row.children[4];
    if (!cell) return true;

    return cell.textContent.trim().toLowerCase().includes(filterValue);
}

export function clearAllFilters() {
    const inputs = document.querySelectorAll('.filter-input');
    inputs.forEach(input => input.value = '');

    const selects = document.querySelectorAll('.filter-select');
    selects.forEach(select => select.selectedIndex = 0);

    setActiveFilters({});

    const tbody = document.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => row.style.display = '');

    const allData = getAllData();
    calculateAndDisplayTotals(allData);
    calculateAndDisplayHighRoyaltyTotals(allData);
}
