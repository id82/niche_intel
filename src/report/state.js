/**
 * State Management Module
 * Centralized state for report data management
 */

// Global state object
export const state = {
    allData: [],
    uniqueAsins: new Set(),
    processedCount: 0,
    totalToProcess: 0,
    searchKeyword: '',
    currentDomain: '',
    activeFilters: {},
    focusedAsinRow: null,
    originalRowPosition: null,
    scrollSyncInitialized: false,
    scrollSyncListeners: [],
    hoverTimeout: null
};

// State accessors
export function getAllData() {
    return state.allData;
}

export function setAllData(data) {
    state.allData = data;
}

export function addToAllData(item) {
    state.allData.push(item);
}

export function updateDataItem(asin, data) {
    const existingIndex = state.allData.findIndex(item => item.asin === asin);
    if (existingIndex !== -1) {
        state.allData[existingIndex] = data;
    }
}

export function getUniqueAsins() {
    return state.uniqueAsins;
}

export function hasAsin(asin) {
    return state.uniqueAsins.has(asin);
}

export function addAsin(asin) {
    state.uniqueAsins.add(asin);
}

export function getProcessedCount() {
    return state.processedCount;
}

export function incrementProcessedCount() {
    state.processedCount++;
    return state.processedCount;
}

export function setProcessedCount(count) {
    state.processedCount = count;
}

export function getTotalToProcess() {
    return state.totalToProcess;
}

export function setTotalToProcess(total) {
    state.totalToProcess = total;
}

export function getSearchKeyword() {
    return state.searchKeyword;
}

export function setSearchKeyword(keyword) {
    state.searchKeyword = keyword;
}

export function getCurrentDomain() {
    return state.currentDomain;
}

export function setCurrentDomain(domain) {
    state.currentDomain = domain;
}

export function getActiveFilters() {
    return state.activeFilters;
}

export function setActiveFilters(filters) {
    state.activeFilters = filters;
}

export function getFocusedAsinRow() {
    return state.focusedAsinRow;
}

export function setFocusedAsinRow(row) {
    state.focusedAsinRow = row;
}

export function getOriginalRowPosition() {
    return state.originalRowPosition;
}

export function setOriginalRowPosition(position) {
    state.originalRowPosition = position;
}

export function isScrollSyncInitialized() {
    return state.scrollSyncInitialized;
}

export function setScrollSyncInitialized(value) {
    state.scrollSyncInitialized = value;
}

export function getScrollSyncListeners() {
    return state.scrollSyncListeners;
}

export function addScrollSyncListener(listener) {
    state.scrollSyncListeners.push(listener);
}

export function clearScrollSyncListeners() {
    state.scrollSyncListeners = [];
}

export function getHoverTimeout() {
    return state.hoverTimeout;
}

export function setHoverTimeout(timeout) {
    state.hoverTimeout = timeout;
}

// Reset state
export function resetState() {
    state.allData = [];
    state.uniqueAsins = new Set();
    state.processedCount = 0;
    state.totalToProcess = 0;
    state.activeFilters = {};
}
