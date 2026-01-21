/**
 * ASIN Focus Module
 * Focus on specific ASIN functionality
 */

import {
    getFocusedAsinRow, setFocusedAsinRow,
    getOriginalRowPosition, setOriginalRowPosition
} from './state.js';

export function setupAsinFocus() {
    const asinInput = document.getElementById('asinFocusInput');
    const clearIcon = document.getElementById('clearAsinInput');
    const notFoundMessage = document.getElementById('asinNotFound');

    if (!asinInput || !clearIcon || !notFoundMessage) return;

    asinInput.addEventListener('input', function () {
        const value = this.value.trim().toUpperCase();

        clearIcon.style.display = value ? 'block' : 'none';
        notFoundMessage.style.display = 'none';

        if (value.length === 10) {
            focusOnAsin(value);
        } else if (value.length < 10) {
            clearAsinFocus();
        }
    });

    clearIcon.addEventListener('click', function () {
        asinInput.value = '';
        clearIcon.style.display = 'none';
        notFoundMessage.style.display = 'none';
        clearAsinFocus();
    });
}

export function focusOnAsin(asin) {
    const notFoundMessage = document.getElementById('asinNotFound');

    const asinLinks = document.querySelectorAll('.asin-cell a');
    let targetRow = null;

    for (const link of asinLinks) {
        if (link.textContent.trim() === asin) {
            targetRow = link.closest('tr');
            break;
        }
    }

    if (!targetRow) {
        notFoundMessage.style.display = 'block';
        clearAsinFocus();
        return;
    }

    notFoundMessage.style.display = 'none';
    clearAsinFocus();

    const tbody = targetRow.parentNode;
    const allRows = Array.from(tbody.children);
    setOriginalRowPosition({
        row: targetRow,
        index: allRows.indexOf(targetRow),
        nextSibling: targetRow.nextSibling
    });

    targetRow.classList.add('focused-asin-row');
    tbody.insertBefore(targetRow, tbody.firstChild);
    setFocusedAsinRow(targetRow);

    console.log(`ASIN ${asin} focused and moved to top`);
}

export function clearAsinFocus() {
    const focusedRow = getFocusedAsinRow();
    const originalPosition = getOriginalRowPosition();

    if (!focusedRow || !originalPosition) return;

    focusedRow.classList.remove('focused-asin-row');

    const tbody = focusedRow.parentNode;
    if (originalPosition.nextSibling) {
        tbody.insertBefore(focusedRow, originalPosition.nextSibling);
    } else {
        tbody.appendChild(focusedRow);
    }

    setFocusedAsinRow(null);
    setOriginalRowPosition(null);

    console.log('ASIN focus cleared');
}
