import {
	getTableColumns,
	getVisibleColumns,
	getTableProperties,
	setColumnWidths,
	getColumnRatioFromWidth
} from "./resizable-columns";

export function initTableWithToggleableColumns(table: HTMLTableElement) {
	setDataAttributesToCells(table);
	setDataShownToHiddenCells(table);

	createHeadersMenu(table);

	hideColumnsOnLoading(table);

	const headersRow: HTMLTableRowElement = table.querySelector('thead tr');
	headersRow.addEventListener('contextmenu', (e: MouseEvent) => showHeadersMenu(table, e));

	const headersMenu = table.parentElement.querySelector('.headers-menu');
	headersMenu.addEventListener('click', (e: MouseEvent) => toggleColumn(table, e))
}

function createHeadersMenu(table: HTMLTableElement) {
	const columns = getTableColumns(table);
	const menu = document.createElement('ul');
	menu.classList.add('headers-menu', 'hidden');

	columns.forEach((column) => {
		const li = document.createElement('li');
		const label = document.createElement('label');

		const span = document.createElement('span');
		span.classList.add('checkmark');

		const columnId = column.getAttribute('data-id');

		const checkbox = document.createElement('input');
		checkbox.setAttribute('type', 'checkbox');
		checkbox.setAttribute('data-id', columnId);
		checkbox.checked = column.getAttribute('data-shown') === 'true';

		const columnTitle = column.innerText ? column.innerText : columnId.replace(/_/g, " ");
		const text = document.createTextNode(columnTitle);

		label.appendChild(text);
		label.appendChild(checkbox);
		label.appendChild(span);


		li.appendChild(label);
		menu.appendChild(li);
	});

	table.parentElement.insertBefore(menu, table.nextElementSibling);
}

function hideColumnsOnLoading(table: HTMLTableElement) {
	getTableColumns(table)
			.filter(column => column.getAttribute('data-shown') === 'false')
			.forEach(column => hideColumn(table, column.getAttribute('data-id')));
}

function showHeadersMenu(table: HTMLTableElement, e: MouseEvent) {
	const tableWrapper = table.parentElement;
	const headersMenu: HTMLUListElement = tableWrapper.querySelector('.headers-menu');

	const x = e.clientX - tableWrapper.getBoundingClientRect().left;
	const y = e.clientY - tableWrapper.getBoundingClientRect().top;

	tableWrapper.style.position = 'relative';
	headersMenu.style.top = `${y}px`;
	headersMenu.style.left = `${x}px`;

	headersMenu.classList.remove('hidden');

	const documentClickHandler = function(e: MouseEvent) {
		if (e.target instanceof HTMLElement) {
			const isClickedOutside = !headersMenu.contains(e.target);

			if (isClickedOutside) {
				headersMenu.classList.add('hidden');
				document.removeEventListener('click', documentClickHandler);
			}
		}
	}
	document.addEventListener('click', documentClickHandler)

	e.preventDefault();
}

function setDataAttributesToCells(table: HTMLTableElement) {
	const cells = getCells(table);

	const columns = getTableColumns(table);
	const columnIds = columns.map(column => column.getAttribute('data-id'));
	const columnCount = columns.length;

	cells.forEach((cell, index) => {
		const columnId = columnIds[index % columnCount];

		cell.setAttribute('data-id', columnId);
		cell.setAttribute('data-shown', 'true');
	})
}

function setDataShownToHiddenCells(table: HTMLTableElement) {
	const hiddenColumnIds = getHiddenColumnIds(table);

	getCells(table)
			.filter(cell => hiddenColumnIds.includes(cell.getAttribute('data-id')))
			.forEach(cell => cell.setAttribute('data-shown', 'false'));
}

function getCells(table: HTMLTableElement): HTMLTableCellElement[] {
	return Array.from(table.querySelectorAll('th, td'));
}

function getHiddenColumnIds(table: HTMLTableElement) {
	const columns = getTableColumns(table);
	const columnRatios = getTableProperties(table).columnRatios;

	const hiddenColumnIds: string[] = [];

	for (const column of columns) {
		const columnId = column.getAttribute('data-id');

		if (columnRatios[columnId] === 0) {
			hiddenColumnIds.push(columnId);
		}
	}

	return hiddenColumnIds;
}

function toggleColumn(table: HTMLTableElement, e: MouseEvent) {
	if (e.target instanceof HTMLInputElement && e.target.getAttribute('data-id')) {
		const columnId = e.target.getAttribute('data-id');

		e.target.checked ? showColumn(table, columnId) : hideColumn(table, columnId);

		const tableProperties = recalculateTablePropertiesDueToToggleColumn(table, columnId);
		setColumnWidths(table, tableProperties);
	}
}


function showColumn(table: HTMLTableElement, id: string) {
	const cells = getCells(table);

	cells
			.filter(cell => cell.getAttribute('data-id') === id)
			.forEach(cell => {
				cell.classList.remove('hidden');
				cell.setAttribute('data-shown', 'true');
			});

	lockOrUnlockCheckboxes(table);
}

function hideColumn(table: HTMLTableElement, id: string) {
	const cells = getCells(table);

	cells
			.filter(cell => cell.getAttribute('data-id') === id)
			.forEach(cell => {
				cell.classList.add('hidden');
				cell.setAttribute('data-shown', 'false');
			});

	lockOrUnlockCheckboxes(table);
}

function lockOrUnlockCheckboxes(table: HTMLTableElement) {
	const visibleResizableColumns = getVisibleColumns(table)
			.filter(column => column.getAttribute('data-auto-resizable') === 'true');

	for (const column of visibleResizableColumns) {
		const columnId = column.getAttribute('data-id');
		const columnCheckbox = document.querySelector(`[type=checkbox][data-id='${columnId}']`);

		if (visibleResizableColumns.length === 1) {
			columnCheckbox.setAttribute('disabled', 'true');
		} else if (visibleResizableColumns.length > 1) {
			columnCheckbox.removeAttribute('disabled');
		}
	}
}
// Get recalculated ratios when column hides or shows
function recalculateTablePropertiesDueToToggleColumn(table: HTMLTableElement, id: string) {
	const tableProperties = getTableProperties(table);
	const columnRatios = tableProperties.columnRatios;

	const columns = getTableColumns(table);

	const targetColumn = columns.find(column => column.getAttribute('data-id') === id);
	const targetColumnId = targetColumn.getAttribute('data-id');
	const targetColumnMinWidth = parseFloat(targetColumn.getAttribute('data-min-width'));

	const isShownTargetColumn = targetColumn.getAttribute('data-shown') === 'true';

	if (isShownTargetColumn) {
		const targetColumnMinRatio = getColumnRatioFromWidth(targetColumnMinWidth, tableProperties.tableWidth);
		columnRatios[targetColumnId] = targetColumnMinRatio;

		let columnRatiosSum = columns.reduce((acc, column) => acc + columnRatios[column.getAttribute('data-id')], 0);

		while (columnRatiosSum > 100) {
			const maxColumnId = Object.keys(columnRatios)
					.reduce((prevKey, curKey) => columnRatios[prevKey] > columnRatios[curKey] ? prevKey : curKey);

			const changeRatioStep = 0.1;

			columnRatios[maxColumnId] -= changeRatioStep;
			columnRatiosSum -= changeRatioStep;
		}
	} else {
		const visibleResizableColumnsExceptTarget = getVisibleColumns(table)
				.filter(column => column.getAttribute('data-auto-resizable') === 'true')
				.filter(column => column !== targetColumn);

		for (const column of visibleResizableColumnsExceptTarget) {
			const columnId = column.getAttribute('data-id');

			columnRatios[columnId] += columnRatios[targetColumnId] / visibleResizableColumnsExceptTarget.length;
		}

		columnRatios[targetColumnId] = 0;
	}

	tableProperties.columnRatios = columnRatios;

	return tableProperties;
}