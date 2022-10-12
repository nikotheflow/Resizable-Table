type TTableProperties = {
	columnRatios: TColumnRatios,
	tableWidth: number
};

type TColumnRatios = {
	[key: string]: number
};

export function initResizableTable(table: HTMLTableElement) {
	const tableProperties = getTableProperties(table);

	//browser width change in the background (when other table was open)
	const resized = (getTableWidth(table) !== tableProperties.tableWidth);

	if (resized) {
		resizeTable(table);
	} else {
		setColumnWidths(table, tableProperties);
	}

	createResizeHandlers(table);

	table.addEventListener('mousedown', mousedown);
	window.addEventListener('resize', () => resizeTable(table));

	let startX: number;
	let currentColumn: HTMLTableCellElement;
	let currentColumnWidth: number;
	let nextColumn: HTMLTableCellElement;
	let nextColumnWidth: number;

	function mousedown(event: MouseEvent) {
		if (event.target instanceof HTMLElement && event.target.classList.contains('resize-handle')) {
			startX = event.clientX;

			const targetColumn = event.target.parentElement;

			// set current resizable column
			if (targetColumn instanceof HTMLTableCellElement) {
				currentColumn = targetColumn;
			}

			while (isUnfitResizeCurrentColumn(table, currentColumn)) {
				if (currentColumn.previousElementSibling instanceof HTMLTableCellElement) {
					currentColumn = currentColumn.previousElementSibling;
				}
			}
			currentColumnWidth = currentColumn.clientWidth;

			// set next resizable column
			if (currentColumn.nextElementSibling instanceof HTMLTableCellElement) {
				nextColumn = currentColumn.nextElementSibling;
			}

			while (isUnfitResizeNextColumn(table, nextColumn)) {
				if (nextColumn.nextElementSibling instanceof HTMLTableCellElement) {
					nextColumn = nextColumn.nextElementSibling;
				}
			}
			nextColumnWidth = nextColumn.clientWidth;

			document.addEventListener('mousemove', mousemove);
			document.addEventListener('mouseup', mouseup, {once: true});
		}
	}	

	function mousemove(event: MouseEvent) {
		const deltaX = event.clientX - startX;
		const newCurrentColumnWidth = currentColumnWidth + deltaX;
		const newNextColumnWidth = nextColumnWidth - deltaX;

		const isCorrectNewCurrentColumnWidth = newCurrentColumnWidth > parseFloat(currentColumn.dataset.minWidth);
		const isCorrectNewNextColumnWidth = newNextColumnWidth > parseFloat(nextColumn.dataset.minWidth);
		const isManualResizableColumns = (currentColumn.dataset.manualResizable !== 'false') && (nextColumn.dataset.manualResizable !== 'false');

		if (isCorrectNewCurrentColumnWidth && isCorrectNewNextColumnWidth && isManualResizableColumns) {
			requestAnimationFrame(() => {
				currentColumn.style.width = newCurrentColumnWidth + 'px';
				nextColumn.style.width = newNextColumnWidth + 'px';
			});
		}
	}

	function mouseup() {
		calculateTablePropertiesFromCurrentWidths(table);

		document.removeEventListener('mousemove', mousemove);
	}
}

// Table resizing when changing the browser width
function resizeTable(table: HTMLTableElement) {
	const tableProperties = recalculateTablePropertiesDueToResizing(table);

	setColumnWidths(table, tableProperties);
}

function isUnfitResizeCurrentColumn(table: HTMLTableElement, column: HTMLTableCellElement) {
	const isManualResizable = column.dataset.manualResizable !== 'false';
	const isHidden = column.dataset.shown === 'false';

	const columns = getVisibleColumns(table);
	const isFirst = column === columns[0];

	return (!isManualResizable || isHidden) && !isFirst;
}

function isUnfitResizeNextColumn(table: HTMLTableElement, column: HTMLTableCellElement) {
	const isManualResizable = column.dataset.manualResizable !== 'false';
	const isHidden = column.dataset.shown === 'false';

	const columns = getVisibleColumns(table);
	const isLast = column === columns[columns.length - 1];

	return (!isManualResizable || isHidden) && !isLast;
}

function calculateTablePropertiesFromCurrentWidths(table: HTMLTableElement) {
	const columnRatios: TColumnRatios = {};

	const tableWidth = getTableWidth(table);

	for (const column of getTableColumns(table)) {
		const currentColumnWidth = column.clientWidth;
		const minColumnWidth = parseFloat(column.dataset.minWidth);
		const newColumnWidth = Math.max(currentColumnWidth, minColumnWidth);

		(currentColumnWidth === 0)
				?	columnRatios[column.dataset.id] = 0
				:	columnRatios[column.dataset.id] =	getColumnRatioFromWidth(newColumnWidth, tableWidth);
	}

	saveTableProperties(table, {columnRatios, tableWidth});
}

export function getTableColumns(table: HTMLTableElement) {
	const headersRow = table.querySelector('thead tr');

	return Array.from(headersRow.querySelectorAll('th'));
}


export function getVisibleColumns(table: HTMLTableElement) {
	return getTableColumns(table).filter(column => getComputedStyle(column).display !== 'none');
}

export function getTableWidth(table: HTMLTableElement) {
	return Math.max(table.parentElement.clientWidth, getMinTableWidth(table));
}

// Get current minimal table width (sum of the fixed column widths
// and resizable column minimal widths)
function getMinTableWidth(table: HTMLTableElement) {
	const visibleColumns = getVisibleColumns(table);

	const fixedColumns = visibleColumns.filter(column => column.dataset.autoResizable === 'false');
	const fixedColumnWidthsSum = fixedColumns.reduce((acc, column) => acc + column.clientWidth, 0);

	const resizableColumns = visibleColumns.filter(column => column.dataset.autoResizable === 'true');
	const resizableColumnMinWidthsSum = resizableColumns.reduce((acc, column) => acc + parseFloat(column.dataset.minWidth), 0);

	return fixedColumnWidthsSum + resizableColumnMinWidthsSum;
}

// Get recalculated ratios depending on the type of column (fixed or resizable) when the browser width is changing
function recalculateTablePropertiesDueToResizing(table: HTMLTableElement) {
	const columns = getVisibleColumns(table);
	const newTableWidth = getTableWidth(table);
	const tableProperties = getTableProperties(table);

	const columnRatios = tableProperties.columnRatios;

	const resizableColumns = columns.filter(column => column.dataset.autoResizable === 'true');
	const resizableColumnRatiosSum = resizableColumns.reduce((acc, column) => acc + columnRatios[column.dataset.id], 0);

	const fixedColumns = columns.filter(column => column.dataset.autoResizable === 'false');
	let newFixedColumnRatiosSum = 0;

	const oldTableWidth = tableProperties.tableWidth;
	tableProperties.tableWidth = newTableWidth;

	for (const column of fixedColumns) {
		columnRatios[column.dataset.id] =	roundTo(columnRatios[column.dataset.id] * oldTableWidth / newTableWidth, 10);
		newFixedColumnRatiosSum =	newFixedColumnRatiosSum + columnRatios[column.dataset.id];
	}

	const newResizableColumnRatiosSum = 100 - newFixedColumnRatiosSum;

	for (const column of resizableColumns) {
		const columnMinWidth = parseFloat(column.dataset.minWidth);

		if (column.clientWidth > columnMinWidth) {
			columnRatios[column.dataset.id] =	roundTo(columnRatios[column.dataset.id] * newResizableColumnRatiosSum / resizableColumnRatiosSum, 10);
		} else {
			columnRatios[column.dataset.id] =	roundTo(columnMinWidth / newTableWidth * 100, 10);
		}
	}

	tableProperties.columnRatios = columnRatios;

	return tableProperties;
}

export function setColumnWidths(table: HTMLTableElement, tableProperties: TTableProperties) {
	const tableWidth = getTableWidth(table);
	const columnRatios = tableProperties.columnRatios;

	for (const column of getTableColumns(table)) {
		const columnWidth = getColumnWidthFromRatio(columnRatios[column.dataset.id], tableWidth);

		requestAnimationFrame(() => {column.style.width = `${columnWidth}px`});
	}

	saveTableProperties(table, tableProperties);
}

function createResizeHandlers(table: HTMLTableElement) {
	const columns = getTableColumns(table);
	columns.forEach((column, index) => {
		const isNotLast = index < columns.length - 1;

		if (isNotLast) {
			appendResizeHandle(column);
		}
	});
}

function appendResizeHandle(column: HTMLTableCellElement) {
	const resizeHandle = document.createElement('span');
	resizeHandle.classList.add('resize-handle');
	column.appendChild(resizeHandle);
}

function getLocalStorageKeyForTable(table: HTMLTableElement) {
	const pathnameId = window.location.pathname.replace(/\d/g, '');
	return `tableProperties-${table.id}-${pathnameId}`;
}

export function getTableProperties(table: HTMLTableElement): TTableProperties {
	const localStorageKey = getLocalStorageKeyForTable(table);
	let savedTablePropertiesJSON = localStorage.getItem(localStorageKey);

	if (savedTablePropertiesJSON === null) {
		calculateTablePropertiesFromCurrentWidths(table);

		savedTablePropertiesJSON = localStorage.getItem(localStorageKey);
	}

	const columnRatios: TColumnRatios = JSON.parse(savedTablePropertiesJSON).columnRatios;
	const tableWidth = parseFloat(JSON.parse(savedTablePropertiesJSON).tableWidth);

	return {columnRatios, tableWidth};
}

function saveTableProperties(table: HTMLTableElement, tableProperties: TTableProperties) {
	const localStorageKey = getLocalStorageKeyForTable(table);
	localStorage.setItem(localStorageKey, JSON.stringify(tableProperties));
}

function getColumnWidthFromRatio(columnRatio: number, tableWidth: number) {
	return roundTo(columnRatio * tableWidth / 100, 10);
}

export function getColumnRatioFromWidth(columnWidth: number, tableWidth: number) {
	return roundTo(columnWidth / tableWidth * 100, 10);
}

export function roundTo(number: number, precision: number) {
	return parseFloat(number.toFixed(precision));
}