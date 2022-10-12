export function initCustomTable(table: HTMLTableElement) {
  const tableRow = table.querySelector('tr');
  const tableRowCells = tableRow?.querySelectorAll('th');

  tableRowCells?.forEach((cell, index) => {
    if (index % 2 === 0) {
      cell.classList.add('hidden');
    };

    if (index % 3 === 0) {
      cell.style.backgroundColor = '#78bdda';
    };
  });
};