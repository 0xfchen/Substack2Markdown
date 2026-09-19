import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadTableState,
  saveTableState,
  resolveTargetSlug,
  calculateInitialRenderCount,
  compareRows,
  matchesRow,
  calculateScrollTarget,
  initReadingTable,
  POSTS_TABLE_STATE_KEY,
  type TableViewState,
  type RowSortFields,
} from '../posts-index';

describe('posts-index state caching and row restoration', () => {
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    mockStorage.clear();

    (global as any).window = {
      sessionStorage: {
        getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage.set(key, val);
        }),
        removeItem: vi.fn((key: string) => {
          mockStorage.delete(key);
        }),
        clear: vi.fn(() => {
          mockStorage.clear();
        }),
      },
      location: {
        hash: '',
        pathname: '/',
        search: '',
      },
    };
    (global as any).sessionStorage = (global as any).window.sessionStorage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (global as any).window;
    delete (global as any).sessionStorage;
  });

  describe('loadTableState() and saveTableState()', () => {
    it('returns null when no session state is cached', () => {
      expect(loadTableState()).toBeNull();
    });

    it('saves and loads valid state within 2 hours', () => {
      const state: TableViewState = {
        renderedCount: 90,
        scrollY: 1450,
        statusFilter: 'in-progress',
        search: 'machine learning',
        author: 'Gergely Orosz',
        sortColumn: 'title',
        sortAsc: true,
        timestamp: Date.now() - 5000,
      };

      saveTableState(state);
      expect(mockStorage.has(POSTS_TABLE_STATE_KEY)).toBe(true);

      const loaded = loadTableState();
      expect(loaded).toEqual(state);
    });

    it('discards and removes expired state older than 2 hours', () => {
      const expiredState: TableViewState = {
        renderedCount: 60,
        scrollY: 800,
        statusFilter: 'completed',
        search: '',
        author: 'all',
        sortColumn: 'date',
        sortAsc: false,
        timestamp: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
      };

      mockStorage.set(POSTS_TABLE_STATE_KEY, JSON.stringify(expiredState));

      const loaded = loadTableState();
      expect(loaded).toBeNull();
      expect(mockStorage.has(POSTS_TABLE_STATE_KEY)).toBe(false);
    });

    it('handles JSON parse corruption gracefully by returning null', () => {
      mockStorage.set(POSTS_TABLE_STATE_KEY, 'invalid-json{[');
      expect(loadTableState()).toBeNull();
    });
  });

  describe('resolveTargetSlug()', () => {
    it('extracts slug from hash starting with #row-', () => {
      expect(resolveTargetSlug('#row-my-cool-post', null)).toBe('my-cool-post');
    });

    it('decodes URI encoded slug from hash', () => {
      expect(resolveTargetSlug('#row-post%20slug%2Ftest', null)).toBe('post slug/test');
    });

    it('falls back to storedSlug when hash is empty', () => {
      expect(resolveTargetSlug('', 'saved-slug-123')).toBe('saved-slug-123');
    });

    it('does not fall back to storedSlug when explicit non-row hash is present', () => {
      expect(resolveTargetSlug('#main-content', 'saved-slug-123')).toBe('');
      expect(resolveTargetSlug('#content', 'saved-slug-123')).toBe('');
      expect(resolveTargetSlug('#irrelevant', 'saved-slug-123')).toBe('');
    });

    it('returns empty string if neither hash nor storedSlug are present', () => {
      expect(resolveTargetSlug('', null)).toBe('');
      expect(resolveTargetSlug('', '')).toBe('');
    });
  });

  describe('calculateInitialRenderCount()', () => {
    it('returns default batch size (30) when no saved count exists', () => {
      expect(calculateInitialRenderCount(undefined, 200, 30)).toBe(30);
    });

    it('returns saved count when greater than default batch', () => {
      expect(calculateInitialRenderCount(95, 200, 30)).toBe(95);
    });

    it('caps saved count to total available rows', () => {
      expect(calculateInitialRenderCount(150, 80, 30)).toBe(80);
    });

    it('caps default batch to total available rows if total is smaller than batch', () => {
      expect(calculateInitialRenderCount(undefined, 15, 30)).toBe(15);
    });

    it('expands initial count to cover targetIndex + 10 when targetIndex is beyond batch', () => {
      expect(calculateInitialRenderCount(undefined, 200, 30, 45)).toBe(55);
      expect(calculateInitialRenderCount(30, 200, 30, 75)).toBe(85);
    });

    it('caps targetIndex expansion to total available rows', () => {
      expect(calculateInitialRenderCount(undefined, 60, 30, 55)).toBe(60);
    });
  });

  describe('compareRows()', () => {
    const rowA: RowSortFields = {
      status: 'completed',
      readCount: 2,
      title: 'Alpha Post',
      author: 'Alice',
      date: '2026-01-15',
      words: 1200,
    };

    const rowB: RowSortFields = {
      status: 'pending',
      readCount: 0,
      title: 'Beta Post',
      author: 'Bob',
      date: '2026-03-20',
      words: 2500,
    };

    it('sorts by status ascending and descending', () => {
      // status order: completed (3) > in-progress (2) > pending (1)
      expect(compareRows(rowA, rowB, 'status', true)).toBeGreaterThan(0);
      expect(compareRows(rowA, rowB, 'status', false)).toBeLessThan(0);
    });

    it('sorts by title alphabetically ascending and descending', () => {
      expect(compareRows(rowA, rowB, 'title', true)).toBeLessThan(0);
      expect(compareRows(rowA, rowB, 'title', false)).toBeGreaterThan(0);
    });

    it('sorts by author alphabetically ascending and descending', () => {
      expect(compareRows(rowA, rowB, 'author', true)).toBeLessThan(0);
      expect(compareRows(rowA, rowB, 'author', false)).toBeGreaterThan(0);
    });

    it('sorts by date ascending and descending', () => {
      expect(compareRows(rowA, rowB, 'date', true)).toBeLessThan(0);
      expect(compareRows(rowA, rowB, 'date', false)).toBeGreaterThan(0);
    });

    it('sorts by word length ascending and descending', () => {
      expect(compareRows(rowA, rowB, 'length', true)).toBeLessThan(0);
      expect(compareRows(rowA, rowB, 'length', false)).toBeGreaterThan(0);
    });
  });

  describe('matchesRow()', () => {
    const baseOptions = {
      statusFilter: 'all',
      searchQuery: '',
      authorFilter: 'all',
    };

    it('matches any row when filters are default', () => {
      expect(matchesRow('pending', 'clean code by uncle bob', 'Robert Martin', baseOptions)).toBe(true);
      expect(matchesRow('completed', 'system design bytebytego', 'Alex Xu', baseOptions)).toBe(true);
    });

    it('filters strictly by status', () => {
      const opts = { ...baseOptions, statusFilter: 'in-progress' };
      expect(matchesRow('in-progress', 'title', 'Author', opts)).toBe(true);
      expect(matchesRow('pending', 'title', 'Author', opts)).toBe(false);
      expect(matchesRow('completed', 'title', 'Author', opts)).toBe(false);
    });

    it('filters strictly by author', () => {
      const opts = { ...baseOptions, authorFilter: 'Alex Xu' };
      expect(matchesRow('pending', 'system design', 'Alex Xu', opts)).toBe(true);
      expect(matchesRow('pending', 'pragmatic engineer', 'Gergely Orosz', opts)).toBe(false);
    });

    it('filters by search query case-insensitively', () => {
      const opts = { ...baseOptions, searchQuery: 'redis' };
      expect(matchesRow('pending', 'deep dive into REDIS internals', 'Author', opts)).toBe(true);
      expect(matchesRow('pending', 'kafka fundamentals', 'Author', opts)).toBe(false);
    });

    it('matches when all combined criteria are satisfied', () => {
      const opts = {
        statusFilter: 'completed',
        searchQuery: 'architecture',
        authorFilter: 'Martin Fowler',
      };
      expect(
        matchesRow('completed', 'software architecture guide', 'Martin Fowler', opts)
      ).toBe(true);
      expect(
        matchesRow('pending', 'software architecture guide', 'Martin Fowler', opts)
      ).toBe(false);
    });
  });

  describe('calculateScrollTarget()', () => {
    it('prioritizes savedScrollY over element bounding rect', () => {
      const target = calculateScrollTarget(1200, 450, 0, 80);
      expect(target).toBe(1200);
    });

    it('clamps savedScrollY to 0 when negative', () => {
      const target = calculateScrollTarget(-50);
      expect(target).toBe(0);
    });

    it('computes scroll target from target element rect top and current window scroll with header offset', () => {
      // Element is at rect.top = 300, current scroll = 200, header offset = 80
      // target = 200 + 300 - 80 = 420
      const target = calculateScrollTarget(undefined, 300, 200, 80);
      expect(target).toBe(420);
    });

    it('clamps element scroll target to 0 when near the very top', () => {
      // Element at rect.top = 30, current scroll = 0, header offset = 80 -> clamp to 0
      const target = calculateScrollTarget(undefined, 30, 0, 80);
      expect(target).toBe(0);
    });

    it('returns null when neither savedScrollY nor targetRectTop are available', () => {
      expect(calculateScrollTarget()).toBeNull();
    });
  });

  describe('initReadingTable() resilience', () => {
    it('gracefully exits without throwing when document or table is absent', () => {
      delete (global as any).document;
      expect(() => initReadingTable()).not.toThrow();
    });
  });
});
