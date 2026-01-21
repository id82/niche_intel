/**
 * Scroll Synchronization Module
 * Syncs horizontal scrolling between filter/column containers and table
 */

import {
    isScrollSyncInitialized, setScrollSyncInitialized,
    getScrollSyncListeners, addScrollSyncListener, clearScrollSyncListeners
} from './state.js';

export function setupScrollSynchronization() {
    cleanupScrollSynchronization();

    const filterContainer = document.getElementById('filter-container');
    const columnContainer = document.getElementById('column-visibility-container');
    const tableContainer = document.getElementById('table-container');

    if (!tableContainer) {
        console.warn("report.js: Could not find table container for scroll sync.");
        return;
    }

    const scrollableTableElement = tableContainer;
    let isContainerScrolling = false;
    let isTableScrolling = false;

    const visibleContainers = [];
    if (filterContainer && filterContainer.style.display !== 'none') {
        visibleContainers.push(filterContainer);
    }
    if (columnContainer && columnContainer.style.display !== 'none') {
        visibleContainers.push(columnContainer);
    }

    if (visibleContainers.length === 0) {
        console.log("report.js: No visible containers for scroll sync.");
        return;
    }

    const containerScrollHandler = function () {
        if (!isTableScrolling) {
            isContainerScrolling = true;
            scrollableTableElement.scrollLeft = this.scrollLeft;

            visibleContainers.forEach(container => {
                if (container !== this) {
                    container.scrollLeft = this.scrollLeft;
                }
            });

            requestAnimationFrame(() => {
                isContainerScrolling = false;
            });
        }
    };

    const tableScrollHandler = function () {
        if (!isContainerScrolling) {
            isTableScrolling = true;
            visibleContainers.forEach(container => {
                container.scrollLeft = this.scrollLeft;
            });
            requestAnimationFrame(() => {
                isTableScrolling = false;
            });
        }
    };

    visibleContainers.forEach(container => {
        container.addEventListener('scroll', containerScrollHandler);
        addScrollSyncListener({ element: container, event: 'scroll', handler: containerScrollHandler });
    });

    scrollableTableElement.addEventListener('scroll', tableScrollHandler);
    addScrollSyncListener({ element: scrollableTableElement, event: 'scroll', handler: tableScrollHandler });

    setScrollSyncInitialized(true);
    console.log('report.js: Scroll synchronization setup complete for', visibleContainers.length, 'containers');
}

export function cleanupScrollSynchronization() {
    const listeners = getScrollSyncListeners();
    listeners.forEach(({ element, event, handler }) => {
        if (element && handler) {
            element.removeEventListener(event, handler);
        }
    });
    clearScrollSyncListeners();
    setScrollSyncInitialized(false);
    console.log('report.js: Scroll synchronization cleaned up');
}
