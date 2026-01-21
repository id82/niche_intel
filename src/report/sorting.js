/**
 * Sorting Module
 * Table sorting functionality
 */

import { getCellValue } from './utils.js';
import { getFocusedAsinRow } from './state.js';

let originalSortTableFn = null;

export function addSortingFunctionality() {
    const sortableHeaders = document.querySelectorAll('th.sortable');

    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const column = parseInt(header.dataset.column);
            const type = header.dataset.type;
            const currentSort = header.classList.contains('sort-asc') ? 'asc' :
                header.classList.contains('sort-desc') ? 'desc' : 'none';

            // Clear all other sort indicators
            sortableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

            // Determine new sort direction
            let newSort = 'asc';
            if (currentSort === 'asc') {
                newSort = 'desc';
            }

            // Special handling for specific columns where "good" values should be first
            if (type === 'bsr' && currentSort === 'none') {
                newSort = 'asc'; // Low BSR is good, so ascending first
            } else if (type === 'royalty' && currentSort === 'none') {
                newSort = 'desc'; // High royalty is good, so descending first
            }

            // Apply sort indicator
            header.classList.add(`sort-${newSort}`);

            // Sort the table
            sortTable(column, type, newSort);
        });
    });
}

export function sortTable(columnIndex, dataType, direction) {
    const focusedRow = getFocusedAsinRow();
    let focusedRowData = null;

    // Temporarily remove focused row from sorting
    if (focusedRow) {
        focusedRowData = {
            row: focusedRow,
            parent: focusedRow.parentNode
        };
        focusedRow.remove();
    }

    const table = document.querySelector('table tbody');
    const rows = Array.from(table.querySelectorAll('tr'));

    rows.sort((a, b) => {
        const aCell = a.children[columnIndex];
        const bCell = b.children[columnIndex];

        let aValue = getCellValue(aCell, dataType);
        let bValue = getCellValue(bCell, dataType);

        // Handle special cases
        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison = 0;
        if (dataType === 'number' || dataType === 'bsr' || dataType === 'royalty') {
            comparison = parseFloat(aValue) - parseFloat(bValue);
        } else {
            comparison = aValue.toString().localeCompare(bValue.toString(), undefined, { numeric: true });
        }

        return direction === 'asc' ? comparison : -comparison;
    });

    // Re-append sorted rows
    rows.forEach(row => table.appendChild(row));

    // Re-add focused row at top
    if (focusedRowData) {
        focusedRowData.parent.insertBefore(focusedRowData.row, focusedRowData.parent.firstChild);
    }
}
