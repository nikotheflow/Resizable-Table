import { initResizableTable } from "./ts/resizable-columns";
import { initTableWithToggleableColumns } from './ts/toggleable-columns';

// const tables: HTMLTableElement[] = Array.from(document.querySelectorAll('.table-resizable'));

// tables.forEach(table => {
// 	initResizableTable(table);
// 	initTableWithToggleableColumns(table);
// });

import { initCustomTable } from "./ts/custom-table";

const tables: HTMLTableElement[] = Array.from(document.querySelectorAll('table'));

for (const table of tables) {
	initCustomTable(table);
}