/**
 * Column Visibility Module
 * Show/hide table columns functionality
 */

export function setupColumnButtonListeners() {
    const columnToggleWrappers = document.querySelectorAll('.column-toggle-wrapper');
    columnToggleWrappers.forEach(wrapper => {
        const checkbox = wrapper.querySelector('input[type="checkbox"]');
        const columnIndex = parseInt(wrapper.getAttribute('data-column'));

        checkbox.addEventListener('change', function () {
            if (this.checked) {
                showColumn(columnIndex);
                wrapper.classList.remove('hidden');
            } else {
                hideColumn(columnIndex);
                setTimeout(() => {
                    wrapper.classList.add('hidden');
                }, 300);
            }
            saveHiddenColumns();
        });
    });
}

export function hideColumn(columnIndex) {
    const table = document.querySelector('table');
    if (!table) return;

    const headerCell = table.querySelector(`thead th:nth-child(${columnIndex})`);
    if (headerCell) {
        headerCell.classList.add('column-hidden');
    }

    const dataCells = table.querySelectorAll(`tbody td:nth-child(${columnIndex})`);
    dataCells.forEach(cell => {
        cell.classList.add('column-hidden');
    });

    const footerCells = table.querySelectorAll(`tfoot td:nth-child(${columnIndex})`);
    footerCells.forEach(cell => {
        cell.classList.add('column-hidden');
    });

    if (columnIndex >= 5) {
        const filterIndex = columnIndex - 3;
        const filterDiv = document.querySelector(`.filter-container > div:nth-child(${filterIndex})`);
        if (filterDiv) {
            filterDiv.classList.add('column-hidden');
        }
    }
}

export function showColumn(columnIndex) {
    const table = document.querySelector('table');
    if (!table) return;

    const headerCell = table.querySelector(`thead th:nth-child(${columnIndex})`);
    if (headerCell) {
        headerCell.classList.remove('column-hidden');
    }

    const dataCells = table.querySelectorAll(`tbody td:nth-child(${columnIndex})`);
    dataCells.forEach(cell => {
        cell.classList.remove('column-hidden');
    });

    const footerCells = table.querySelectorAll(`tfoot td:nth-child(${columnIndex})`);
    footerCells.forEach(cell => {
        cell.classList.remove('column-hidden');
    });

    if (columnIndex >= 5) {
        const filterIndex = columnIndex - 3;
        const filterDiv = document.querySelector(`.filter-container > div:nth-child(${filterIndex})`);
        if (filterDiv) {
            filterDiv.classList.remove('column-hidden');
        }
    }
}

export function showAllColumns() {
    const columnToggleWrappers = document.querySelectorAll('.column-toggle-wrapper');
    columnToggleWrappers.forEach(wrapper => {
        const columnIndex = parseInt(wrapper.getAttribute('data-column'));
        const checkbox = wrapper.querySelector('input[type="checkbox"]');

        showColumn(columnIndex);
        checkbox.checked = true;
        wrapper.classList.remove('hidden');
    });

    localStorage.removeItem('nicheIntelHiddenColumns');
}

export function updateColumnToggleState(columnIndex, isHidden) {
    const wrapper = document.querySelector(`.column-toggle-wrapper[data-column="${columnIndex}"]`);
    if (!wrapper) return;

    const checkbox = wrapper.querySelector('input[type="checkbox"]');

    if (isHidden) {
        checkbox.checked = false;
        wrapper.classList.add('hidden');
    } else {
        checkbox.checked = true;
        wrapper.classList.remove('hidden');
    }
}

export function saveHiddenColumns() {
    const hiddenColumns = [];
    const columnToggleWrappers = document.querySelectorAll('.column-toggle-wrapper');

    columnToggleWrappers.forEach(wrapper => {
        const checkbox = wrapper.querySelector('input[type="checkbox"]');
        const columnIndex = parseInt(wrapper.getAttribute('data-column'));

        if (!checkbox.checked) {
            hiddenColumns.push(columnIndex);
        }
    });

    localStorage.setItem('nicheIntelHiddenColumns', JSON.stringify(hiddenColumns));
}

export function loadHiddenColumns() {
    const hiddenColumns = JSON.parse(localStorage.getItem('nicheIntelHiddenColumns') || '[]');
    hiddenColumns.forEach(columnIndex => {
        hideColumn(columnIndex);
        updateColumnToggleState(columnIndex, true);
    });
}
