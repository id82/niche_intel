/**
 * Export Module
 * CSV export and clipboard functionality
 */

import { getSearchKeyword } from './state.js';

export function setupExportHandlers() {
    const exportButton = document.getElementById('exportData');
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            exportToCSV();
        });
        exportButton.style.display = 'inline-block';
    }

    const copyAsinsButton = document.getElementById('copyAsins');
    if (copyAsinsButton) {
        copyAsinsButton.addEventListener('click', () => {
            copyAsinsToClipboard();
        });
    }
}

export function copyAsinsToClipboard() {
    console.log("report.js: Copying ASINs to clipboard");

    const copyAsinsButton = document.getElementById('copyAsins');

    // Get ASIN links only from visible rows
    const asinLinks = document.querySelectorAll('tr:not([style*="display: none"]) .asin-cell a');
    if (asinLinks.length === 0) {
        alert('No ASINs found to copy');
        return;
    }

    const asins = Array.from(asinLinks).map(link => link.textContent.trim());
    const asinText = asins.join('\n');

    navigator.clipboard.writeText(asinText).then(() => {
        const originalText = copyAsinsButton.textContent;
        copyAsinsButton.textContent = 'Copied!';
        setTimeout(() => {
            copyAsinsButton.textContent = originalText;
        }, 2000);
        console.log("report.js: Successfully copied ASINs to clipboard");
    }).catch(err => {
        console.error('Failed to copy ASINs:', err);
        try {
            const textArea = document.createElement('textarea');
            textArea.value = asinText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            const originalText = copyAsinsButton.textContent;
            copyAsinsButton.textContent = 'Copied!';
            setTimeout(() => {
                copyAsinsButton.textContent = originalText;
            }, 2000);
        } catch (fallbackErr) {
            console.error('Fallback copy method also failed:', fallbackErr);
            alert('Failed to copy ASINs to clipboard');
        }
    });
}

export function exportToCSV() {
    console.log("report.js: Exporting data to CSV");

    const table = document.querySelector('table');
    if (!table) {
        alert('No data to export');
        return;
    }

    const csvData = [];

    const customHeaders = [
        'ASIN', 'Cover', 'Title & Author', 'List Price', 'Discount Price', 'Reviews',
        'Avg Rating', 'Review Images', 'Formats', 'BSR', 'Days on Market', 'Length',
        'Large Trim', 'A+ Modules', 'UGC Videos', 'Editorial Reviews', 'Royalty/Book',
        'Royalty/Month', 'Publisher'
    ];
    csvData.push(customHeaders.join(','));

    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = [];

        cells.forEach((cell, index) => {
            // Skip Select and Type columns
            if (index === 0 || index === 1) return;

            let cellText = '';

            if (index === 2 && cell.querySelector('a')) {
                cellText = cell.querySelector('a').textContent.trim();
            }
            else if (index === 3 && cell.querySelector('img')) {
                cellText = cell.querySelector('img').src || '';
            }
            else if (index === 4 && cell.querySelector('.title')) {
                const title = cell.querySelector('.title').textContent.trim();
                const author = cell.querySelector('.author');
                cellText = author ? `${title} by ${author.textContent.trim()}` : title;
            }
            else if (index === 5) {
                const cellHTML = cell.innerHTML;
                let listPrice = '';
                let discountPrice = '';

                if (cellHTML.includes('<br>')) {
                    const parts = cellHTML.split('<br>');
                    if (parts.length >= 2) {
                        listPrice = parts[0].replace(/\$/, '').trim();
                        const match = parts[1].match(/\$(\d+\.?\d*)/);
                        if (match) discountPrice = match[1];
                    }
                } else {
                    const priceText = cell.textContent.trim();
                    if (priceText !== 'N/A') {
                        listPrice = priceText.replace(/\$/, '');
                    }
                }

                rowData.push(listPrice);
                rowData.push(discountPrice);
                return;
            }
            else if (index === 17 || index === 18) {
                cellText = cell.textContent.trim().replace(/\$/, '').replace(/,/g, '');
                if (cellText === 'N/A') cellText = '';
            }
            else {
                cellText = cell.textContent.trim();
            }

            if (cellText.includes(',') || cellText.includes('"') || cellText.includes('\n')) {
                cellText = '"' + cellText.replace(/"/g, '""') + '"';
            }

            rowData.push(cellText);
        });

        csvData.push(rowData.join(','));
    });

    const csvContent = csvData.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedKeyword = getSearchKeyword() ? getSearchKeyword().replace(/[^a-zA-Z0-9_-]/g, '_') : 'analysis';
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `${sanitizedKeyword}_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log("report.js: CSV export completed");
}
