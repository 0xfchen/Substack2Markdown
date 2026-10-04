# Reading Time Quick Filter and Coffee Break Mode

## Goal

1. **Primary Goal**: Add a reading time dropdown filter to the reader home page (`/`) allowing readers to instantly filter articles by estimated read duration (`< 5 min`, `5–15 min`, `16–30 min`, `30+ min`).
2. **Secondary Goals**:
   - **Multi-Filter Composition**: Harmoniously compose with existing status tabs (`All / To Read / Reading / Done`), author selection, and full-text search without performance degradation.
   - **Session & Navigation Persistence**: Persist the active reading time filter in `sessionStorage` alongside `TableViewState` so returning from an article preserves the user's filtered view.
   - **Zero Schema Change**: Leverage the already computed `estMinutes` (`Math.max(1, Math.round(words / 200))`) from frontmatter and serialize it as a `data-minutes` attribute on table rows.

---

## Background & Architecture

The reader home page currently displays the estimated reading duration in the "Read Time" table column (computed as $\approx 200$ words per minute). While users can sort by article length, there is no way to **filter** by reading time.

When a user has only a 5-minute coffee break or a 15-minute commute, browsing through hundreds of 30+ minute deep-dive essays creates cognitive friction. Providing categorized time buckets empowers readers to immediately discover articles matching their available time window.

### Reading Duration Buckets

| Filter Key | Label | Range | Target Use Case |
| :--- | :--- | :--- | :--- |
| `all` | Any Length | All durations | Default / unfiltered library view |
| `quick` | ☕ Quick (< 5 min) | $1 \le \text{minutes} < 5$ | Quick coffee breaks & announcements |
| `medium` | 📖 Medium (5–15 min) | $5 \le \text{minutes} \le 15$ | Short commutes & focused standard essays |
| `long` | 📚 Long (16–30 min) | $16 \le \text{minutes} \le 30$ | In-depth case studies & technical guides |
| `deep` | 🧠 Deep Dive (30+ min) | $\text{minutes} > 30$ | Architecture deep dives & exhaustive teardowns |

---

## Proposed Changes

### 1. Reader Index Markup (`reader/src/pages/index.astro`)

- **Add Time Filter Dropdown**: In `.search-filter-row`, add a `<select class="filter-select" data-time-filter aria-label="Filter by Read Time">` containing options for `all`, `quick`, `medium`, `long`, and `deep`.
- **Add `data-minutes` Attribute**: On each `<tr class="article-row">`, add `data-minutes={row.estMinutes}` for clean, typed integer access in client scripts without regex scraping.

```html
<select class="filter-select" data-time-filter aria-label="Filter by Read Time">
  <option value="all">Any Length</option>
  <option value="quick">☕ Quick (&lt; 5 min)</option>
  <option value="medium">📖 Medium (5–15 min)</option>
  <option value="long">📚 Long (16–30 min)</option>
  <option value="deep">🧠 Deep Dive (30+ min)</option>
</select>
```

### 2. Client-Side Filter Engine (`reader/src/scripts/posts-index.ts`)

- **Update `TableViewState` Interface**:
  ```typescript
  export interface TableViewState {
    renderedCount: number;
    scrollY: number;
    statusFilter: string;
    search: string;
    author: string;
    timeFilter?: string;
    sortColumn: string;
    sortAsc: boolean;
    timestamp: number;
  }
  ```
- **Update `RowFilterOptions` Interface**:
  ```typescript
  export interface RowFilterOptions {
    statusFilter: string;
    searchQuery: string;
    authorFilter: string;
    timeFilter?: string;
  }
  ```
- **Time Category Predicate Function**:
  ```typescript
  export function matchesTimeCategory(minutes: number, timeFilter?: string): boolean {
    if (!timeFilter || timeFilter === 'all') return true;
    if (timeFilter === 'quick') return minutes < 5;
    if (timeFilter === 'medium') return minutes >= 5 && minutes <= 15;
    if (timeFilter === 'long') return minutes > 15 && minutes <= 30;
    if (timeFilter === 'deep') return minutes > 30;
    return true;
  }
  ```
- **Update `matchesRow()`**:
  Incorporate `minutes: number` and evaluate `matchesTimeCategory(minutes, options.timeFilter)`.
- **DOM Integration in `initReadingTable()`**:
  - Query `const timeSelect = document.querySelector<HTMLSelectElement>('[data-time-filter]');`.
  - Restore state from `savedState?.timeFilter || 'all'`.
  - Register `change` event listener on `timeSelect` to update `currentTimeFilter`, trigger `applyFilters()`, and persist state.

### 3. Unit Tests (`reader/src/scripts/__tests__/posts-index.test.ts`)

- Test `matchesTimeCategory()` across boundary conditions:
  - `quick`: 1, 4 (true), 5 (false).
  - `medium`: 5, 10, 15 (true), 4, 16 (false).
  - `long`: 16, 25, 30 (true), 15, 31 (false).
  - `deep`: 31, 60 (true), 30 (false).
  - `all` or empty: always true.
- Test `matchesRow()` with combined filter states (status + author + search + time).

---

## Verification Plan

### Automated Tests
```bash
# 1. Run reader Vitest test suite
nvs use lts
cd reader
pnpm test

# 2. Type checking and Astro build diagnostics
pnpm check
pnpm build
```

### Manual Verification
1. Launch the dev server: `pnpm dev` inside `reader/`.
2. Open `http://localhost:4321/`.
3. Select `☕ Quick (< 5 min)`: Verify only posts with 1–4 min read time are visible.
4. Select `🧠 Deep Dive (30+ min)`: Verify only long essays appear.
5. Combine with an Author filter (e.g. `Gergely Orosz`) and a Status Tab (e.g. `To Read`): Confirm all filters compose with `AND` logic.
6. Click into an article, then click "Back to Library": Confirm the selected time filter and scroll position are restored seamlessly from `sessionStorage`.
