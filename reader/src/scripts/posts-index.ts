import {
  fetchReadingState,
  getReadingStatus,
  getReadingProgressPercent,
  getReadCount,
  READING_STATUS_CHANGE_EVENT,
} from './reading-tracker';

const VIEWPORT_BATCH_SIZE = 30; // ~1-1.5 viewport heights of rows

/**
 * Initialize the reading table on the posts index page.
 * Handles status filtering, search, author filtering, sorting,
 * and lazy-loads rows dynamically as the user scrolls down the page.
 */
export function initReadingTable(): void {
  const table = document.querySelector<HTMLTableElement>('[data-reading-table]');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  // Master collection of all rows in the dataset
  const allRows = [...table.querySelectorAll<HTMLTableRowElement>('.article-row')];
  const statusTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-status-filter]')];
  const searchInput = document.querySelector<HTMLInputElement>('[data-reading-search]');
  const authorSelect = document.querySelector<HTMLSelectElement>('[data-author-filter]');
  const emptyState = document.querySelector<HTMLElement>('[data-table-empty]');

  let currentStatusFilter: string = 'all';
  let currentSearch: string = '';
  let currentAuthor: string = 'all';
  let sortColumn: string = 'date';
  let sortAsc: boolean = false; // default newest first

  let filteredRows: HTMLTableRowElement[] = [];
  let renderedCount = 0;

  function appendNextBatch(): void {
    if (!tbody || renderedCount >= filteredRows.length) return;
    const nextEnd = Math.min(renderedCount + VIEWPORT_BATCH_SIZE, filteredRows.length);
    const fragment = document.createDocumentFragment();
    for (let i = renderedCount; i < nextEnd; i++) {
      const row = filteredRows[i];
      row.hidden = false;
      fragment.appendChild(row);
    }
    tbody.appendChild(fragment);
    renderedCount = nextEnd;
  }

  function updateStats(): void {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let totalReads = 0;

    allRows.forEach((row) => {
      const id = row.dataset.rowId;
      if (!id) return;
      const status = getReadingStatus(id);
      const progressPct = getReadingProgressPercent(id);
      const readCount = getReadCount(id);
      totalReads += readCount;

      row.setAttribute('data-current-status', status);
      row.setAttribute('data-read-count', String(readCount));
      row.style.setProperty('--row-progress', `${progressPct}%`);
      row.setAttribute('data-has-progress', progressPct > 0 ? 'true' : 'false');

      if (status === 'completed') completed++;
      else if (status === 'in-progress') inProgress++;
      else pending++;
    });

    const total = allRows.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const elTotal = document.querySelector('[data-stat-total]');
    const elPending = document.querySelector('[data-stat-pending]');
    const elReading = document.querySelector('[data-stat-reading]');
    const elCompleted = document.querySelector('[data-stat-completed]');
    const elReads = document.querySelector('[data-stat-reads]');
    const elPercent = document.querySelector('[data-stat-percent]');
    const elProgressFill = document.querySelector<HTMLElement>('[data-progress-fill]');

    if (elTotal) elTotal.textContent = String(total);
    if (elPending) elPending.textContent = String(pending);
    if (elReading) elReading.textContent = String(inProgress);
    if (elCompleted) elCompleted.textContent = String(completed);
    if (elReads) elReads.textContent = String(totalReads);
    if (elPercent) elPercent.textContent = `${percent}% Completed`;
    if (elProgressFill) elProgressFill.style.width = `${percent}%`;

    // Update badge counts on tabs
    const badgeAll = document.querySelector('[data-badge-all]');
    const badgePending = document.querySelector('[data-badge-pending]');
    const badgeReading = document.querySelector('[data-badge-reading]');
    const badgeCompleted = document.querySelector('[data-badge-completed]');

    if (badgeAll) badgeAll.textContent = String(total);
    if (badgePending) badgePending.textContent = String(pending);
    if (badgeReading) badgeReading.textContent = String(inProgress);
    if (badgeCompleted) badgeCompleted.textContent = String(completed);
  }

  function renderTable(): void {
    filteredRows = allRows.filter((row) => {
      const id = row.dataset.rowId;
      const status = id ? getReadingStatus(id) : 'pending';
      const searchTarget = row.dataset.search || '';
      const author = row.dataset.author || '';

      // Status match
      const matchesStatus =
        currentStatusFilter === 'all' ||
        (currentStatusFilter === 'pending' && status === 'pending') ||
        (currentStatusFilter === 'in-progress' && status === 'in-progress') ||
        (currentStatusFilter === 'completed' && status === 'completed');

      // Author match
      const matchesAuthor = currentAuthor === 'all' || author === currentAuthor;

      // Query match
      const matchesQuery = !currentSearch || searchTarget.includes(currentSearch);

      return matchesStatus && matchesAuthor && matchesQuery;
    });

    tbody!.innerHTML = '';
    renderedCount = 0;
    appendNextBatch();

    // Ensure enough initial content to allow scrolling on large/tall displays
    while (
      renderedCount < filteredRows.length &&
      typeof window !== 'undefined' &&
      document.documentElement.scrollHeight <= window.innerHeight * 1.5
    ) {
      appendNextBatch();
    }

    if (emptyState) {
      emptyState.hidden = filteredRows.length > 0;
    }
  }

  function sortTable(column: string): void {
    if (sortColumn === column) {
      sortAsc = !sortAsc;
    } else {
      sortColumn = column;
      sortAsc = column === 'title' || column === 'author'; // text default asc, status/date/length desc
    }

    allRows.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (column === 'status') {
        const statusOrder: Record<string, number> = { completed: 3, 'in-progress': 2, pending: 1 };
        const statA = statusOrder[a.dataset.currentStatus || 'pending'] || 0;
        const statB = statusOrder[b.dataset.currentStatus || 'pending'] || 0;
        if (statA !== statB) {
          return sortAsc ? statA - statB : statB - statA;
        }
        const countA = Number(a.dataset.readCount || 0);
        const countB = Number(b.dataset.readCount || 0);
        return sortAsc ? countA - countB : countB - countA;
      }
      if (column === 'title') {
        valA = a.dataset.title || '';
        valB = b.dataset.title || '';
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (column === 'author') {
        valA = a.dataset.author || '';
        valB = b.dataset.author || '';
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (column === 'date') {
        valA = a.dataset.date || '';
        valB = b.dataset.date || '';
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (column === 'length') {
        const numA = Number(a.dataset.words || 0);
        const numB = Number(b.dataset.words || 0);
        return sortAsc ? numA - numB : numB - numA;
      }
      return 0;
    });

    renderTable();

    // Update sort indicators
    table?.querySelectorAll<HTMLElement>('.sortable').forEach((th) => {
      const isCurrent = th.dataset.sort === sortColumn;
      const ind = th.querySelector('.sort-indicator');
      if (ind) {
        ind.textContent = isCurrent ? (sortAsc ? '▲' : '▼') : '↕';
      }
      th.classList.toggle('is-sorted', isCurrent);
    });
  }

  // --- Viewport scroll and intersection observer for infinite scroll ---
  function onScroll(): void {
    if (renderedCount >= filteredRows.length) return;
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    if (scrollBottom >= docHeight - 800) {
      appendNextBatch();
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    const sentinel = document.createElement('div');
    sentinel.style.width = '100%';
    sentinel.style.height = '1px';
    sentinel.style.pointerEvents = 'none';
    const container = table.closest('.table-container') || table.parentElement;
    if (container) {
      container.appendChild(sentinel);
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            appendNextBatch();
          }
        },
        { rootMargin: '800px' }
      );
      observer.observe(sentinel);
    }
  }

  // --- Event listeners ---

  statusTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      statusTabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-pressed', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-pressed', 'true');
      currentStatusFilter = tab.dataset.statusFilter || 'all';
      renderTable();
    });
  });

  searchInput?.addEventListener('input', () => {
    currentSearch = searchInput.value.trim().toLowerCase();
    renderTable();
  });

  authorSelect?.addEventListener('change', () => {
    currentAuthor = authorSelect.value;
    renderTable();
  });

  table?.querySelectorAll<HTMLElement>('.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (col) sortTable(col);
    });
  });

  window.addEventListener(READING_STATUS_CHANGE_EVENT, () => {
    updateStats();
    renderTable();
  });

  // Immediate sync from local cache
  updateStats();
  renderTable();

  // Verify after server state is fetched
  fetchReadingState().then(() => {
    updateStats();
    renderTable();
  });
}
