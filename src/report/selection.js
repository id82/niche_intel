/**
 * Selection Module
 * Checkbox and row selection functionality
 */

import { getAllData, getCurrentDomain } from './state.js';
import { calculateAndDisplayTotals, calculateAndDisplayHighRoyaltyTotals, clearTotalsRows } from './calculations.js';

export function addCheckboxFunctionality() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');

    // Handle select all checkbox
    selectAllCheckbox.addEventListener('change', function () {
        const isChecked = this.checked;
        rowCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        updateTotalsCalculations();
    });

    // Handle individual row checkboxes
    rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            updateSelectAllState();
            updateTotalsCalculations();
        });
    });

    // Initial calculation with all rows selected
    updateTotalsCalculations();
}

export function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');

    if (checkedBoxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedBoxes.length === rowCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
    }
}

export function updateTotalsCalculations() {
    const allData = getAllData();

    // Safety check: ensure allData exists and is an array
    if (!allData || !Array.isArray(allData)) {
        console.warn("report.js: allData is not available yet, clearing totals");
        clearTotalsRows();
        return;
    }

    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
    const selectedAsins = Array.from(checkedBoxes).map(cb => cb.dataset.asin);

    // Filter allData to only include selected rows
    const selectedData = allData.filter(item => selectedAsins.includes(item.asin));

    if (selectedData.length === 0) {
        clearTotalsRows();
        return;
    }

    // Calculate and display totals for the selected data
    calculateAndDisplayTotals(selectedData);
    calculateAndDisplayHighRoyaltyTotals(selectedData);
}
