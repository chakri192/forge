// Data Table Component with Sorting and Pagination

export function renderDataTable({
  id = 'forgeDataTable',
  columns = [], // [{ key, label, sortable, render }]
  data = [],
  pageSize = 5,
  currentPage = 1,
  sortKey = '',
  sortDir = 'asc'
}) {
  let sortedData = [...data];

  if (sortKey) {
    sortedData.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (page - 1) * pageSize;
  const pageData = sortedData.slice(startIndex, startIndex + pageSize);

  const headerHtml = columns.map(col => {
    const isSorted = sortKey === col.key;
    const arrow = isSorted ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
    return `
      <th data-col-key="${col.key}" data-sortable="${col.sortable !== false}">
        <div class="flex items-center gap-1.5 cursor-pointer select-none">
          <span>${col.label}</span>
          ${col.sortable !== false ? `<span class="material-symbols-outlined text-xs ${isSorted ? 'text-royal-slate-blue' : 'text-outline'}">${arrow}</span>` : ''}
        </div>
      </th>
    `;
  }).join('');

  const rowsHtml = pageData.length > 0 ? pageData.map(row => `
    <tr>
      ${columns.map(col => `
        <td>${col.render ? col.render(row[col.key], row) : (row[col.key] ?? '')}</td>
      `).join('')}
    </tr>
  `).join('') : `
    <tr>
      <td colspan="${columns.length}" class="text-center py-6 text-outline text-xs">
        No records found.
      </td>
    </tr>
  `;

  return `
    <div class="forge-table-wrapper" id="${id}">
      <table class="forge-table">
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="forge-pagination text-xs text-outline">
        <span>Showing ${pageData.length ? startIndex + 1 : 0} to ${startIndex + pageData.length} of ${data.length} entries</span>
        <div class="flex items-center gap-2">
          <button class="prev-page-btn p-1 rounded hover:bg-white/10 ${page <= 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}" ${page <= 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <span class="font-semibold text-white">Page ${page} of ${totalPages}</span>
          <button class="next-page-btn p-1 rounded hover:bg-white/10 ${page >= totalPages ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}" ${page >= totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function attachDataTableEvents(tableId, { onSort, onPageChange } = {}) {
  const wrapper = document.getElementById(tableId);
  if (!wrapper) return;

  wrapper.querySelectorAll('th[data-col-key]').forEach(th => {
    if (th.dataset.sortable === 'true') {
      th.addEventListener('click', () => {
        const key = th.dataset.colKey;
        document.dispatchEvent(new CustomEvent('forge:table-sort', {
          detail: { tableId, columnKey: key }
        }));
        if (onSort) onSort(key);
      });
    }
  });

  const prevBtn = wrapper.querySelector('.prev-page-btn');
  const nextBtn = wrapper.querySelector('.next-page-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('forge:table-page', {
        detail: { tableId, action: 'prev' }
      }));
      if (onPageChange) onPageChange('prev');
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('forge:table-page', {
        detail: { tableId, action: 'next' }
      }));
      if (onPageChange) onPageChange('next');
    });
  }
}
