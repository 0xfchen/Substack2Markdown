import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReadingState } from '../reading-tracker';

// ---------------------------------------------------------------------------
// Helpers – fresh-import the module each test to reset module-level state
// ---------------------------------------------------------------------------

type TrackerModule = typeof import('../reading-tracker');

const mockStorage = new Map<string, string>();

function setupGlobalMocks() {
  mockStorage.clear();

  (global as any).window = {
    localStorage: {
      getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage.set(key, val);
      }),
      removeItem: vi.fn((key: string) => {
        mockStorage.delete(key);
      }),
    },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
  };

  (global as any).CustomEvent = class CustomEvent extends Event {
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      super(type);
      this.detail = init?.detail;
    }
  } as any;

  (global as any).fetch = vi.fn();
}

async function importFresh(): Promise<TrackerModule> {
  vi.resetModules();
  return (await import('../reading-tracker')) as TrackerModule;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reading-tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupGlobalMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (global as any).window;
    delete (global as any).CustomEvent;
    delete (global as any).fetch;
  });

  // -----------------------------------------------------------------------
  // 1. getReadingStatus – unknown slug returns 'pending'
  // -----------------------------------------------------------------------
  describe('getReadingStatus', () => {
    it('returns "pending" for an unknown slug', async () => {
      const mod = await importFresh();
      expect(mod.getReadingStatus('does-not-exist')).toBe('pending');
    });

    it('returns the correct status for a known slug', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('my-article', 'in-progress');
      expect(mod.getReadingStatus('my-article')).toBe('in-progress');
    });
  });

  // -----------------------------------------------------------------------
  // 2. setReadingStatus – stores status, dispatches event, caches
  // -----------------------------------------------------------------------
  describe('setReadingStatus', () => {
    it('stores the status in memory and caches to localStorage', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('article-1', 'in-progress');

      const entry = mod.getReadingEntry('article-1');
      expect(entry).toBeDefined();
      expect(entry!.status).toBe('in-progress');

      // localStorage should have been written
      expect(window.localStorage.setItem).toHaveBeenCalled();
      const stored = mockStorage.get('substack_reading_state_cache_v1');
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed['article-1'].status).toBe('in-progress');
    });

    it('dispatches a CustomEvent with correct detail', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('article-1', 'completed');

      expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
      const event = (window.dispatchEvent as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(event.type).toBe('reading-status-changed');
      expect(event.detail.slug).toBe('article-1');
      expect(event.detail.status).toBe('completed');
      expect(event.detail.state.status).toBe('completed');
    });

    // -------------------------------------------------------------------
    // 3. No-op when status and ratio haven't changed (without force)
    // -------------------------------------------------------------------
    it('no-ops when status and scrollRatio are unchanged', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('slug-a', 'in-progress', { scrollRatio: 0.5 });

      // Reset call counts
      (window.dispatchEvent as ReturnType<typeof vi.fn>).mockClear();
      (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockClear();

      // Same call again – should be a no-op
      mod.setReadingStatus('slug-a', 'in-progress', { scrollRatio: 0.5 });

      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // 4. force: true always updates
    // -------------------------------------------------------------------
    it('updates even when nothing changed when force: true', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('slug-a', 'in-progress', { scrollRatio: 0.5 });

      (window.dispatchEvent as ReturnType<typeof vi.fn>).mockClear();

      mod.setReadingStatus('slug-a', 'in-progress', {
        scrollRatio: 0.5,
        force: true,
      });

      expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('ignores calls with empty slug', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('', 'completed');
      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    it('sets scrollRatio to 1 for completed when no ratio given', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('slug-c', 'completed');
      expect(mod.getReadingEntry('slug-c')!.scrollRatio).toBe(1);
    });

    it('sets scrollRatio to 0 for pending when no ratio given', async () => {
      const mod = await importFresh();
      // First set to in-progress so changing to pending is a status change
      mod.setReadingStatus('slug-d', 'in-progress');
      mod.setReadingStatus('slug-d', 'pending');
      expect(mod.getReadingEntry('slug-d')!.scrollRatio).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 5. toggleReadingStatus – cycle
  // -----------------------------------------------------------------------
  describe('toggleReadingStatus', () => {
    it('cycles pending → in-progress → completed → pending', async () => {
      const mod = await importFresh();

      expect(mod.getReadingStatus('cycle-test')).toBe('pending');

      const s1 = mod.toggleReadingStatus('cycle-test');
      expect(s1).toBe('in-progress');
      expect(mod.getReadingStatus('cycle-test')).toBe('in-progress');

      const s2 = mod.toggleReadingStatus('cycle-test');
      expect(s2).toBe('completed');
      expect(mod.getReadingStatus('cycle-test')).toBe('completed');

      const s3 = mod.toggleReadingStatus('cycle-test');
      expect(s3).toBe('pending');
      expect(mod.getReadingStatus('cycle-test')).toBe('pending');
    });

    it('sets scrollRatio = 0.1 when toggling to in-progress', async () => {
      const mod = await importFresh();
      mod.toggleReadingStatus('slug-toggle');
      expect(mod.getReadingEntry('slug-toggle')!.scrollRatio).toBe(0.1);
    });

    it('sets scrollRatio = 1 when toggling to completed', async () => {
      const mod = await importFresh();
      mod.toggleReadingStatus('slug-toggle'); // -> in-progress
      mod.toggleReadingStatus('slug-toggle'); // -> completed
      expect(mod.getReadingEntry('slug-toggle')!.scrollRatio).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 6. getReadingProgressPercent
  // -----------------------------------------------------------------------
  describe('getReadingProgressPercent', () => {
    it('returns 100 for completed articles', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('done', 'completed');
      expect(mod.getReadingProgressPercent('done')).toBe(100);
    });

    it('returns 0 for pending articles', async () => {
      const mod = await importFresh();
      expect(mod.getReadingProgressPercent('unknown')).toBe(0);
    });

    it('returns 5 for in-progress articles with no/zero scrollRatio', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('started', 'in-progress', { scrollRatio: 0 });
      expect(mod.getReadingProgressPercent('started')).toBe(5);
    });

    it('returns values in 5-95 range for in-progress with scrollRatio', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('mid', 'in-progress', { scrollRatio: 0.5 });
      const pct = mod.getReadingProgressPercent('mid');
      expect(pct).toBeGreaterThanOrEqual(5);
      expect(pct).toBeLessThanOrEqual(95);
      // 0.5 * 20 = 10, round = 10, * 5 = 50
      expect(pct).toBe(50);
    });

    it('clamps to 5 at low ratios', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('low', 'in-progress', { scrollRatio: 0.01 });
      expect(mod.getReadingProgressPercent('low')).toBe(5);
    });

    it('clamps to 95 at high ratios below 1', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('high', 'in-progress', { scrollRatio: 0.99, force: true });
      const pct = mod.getReadingProgressPercent('high');
      expect(pct).toBeLessThanOrEqual(95);
    });
  });

  // -----------------------------------------------------------------------
  // 7. updateReadingProgress – threshold transitions
  // -----------------------------------------------------------------------
  describe('updateReadingProgress', () => {
    it('transitions pending → in-progress at 10% scroll', async () => {
      const mod = await importFresh();
      const result = mod.updateReadingProgress('article-up', 0.10);
      expect(result.statusChanged).toBe(true);
      expect(result.status).toBe('in-progress');
      expect(mod.getReadingStatus('article-up')).toBe('in-progress');
    });

    it('does NOT transition pending → in-progress below 10%', async () => {
      const mod = await importFresh();
      const result = mod.updateReadingProgress('article-up2', 0.05);
      expect(result.statusChanged).toBe(false);
      expect(result.status).toBe('pending');
    });

    it('transitions in-progress → completed at 90% scroll', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('article-prog', 'in-progress', { scrollRatio: 0.5 });
      const result = mod.updateReadingProgress('article-prog', 0.90);
      expect(result.statusChanged).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('returns readCount in the result', async () => {
      const mod = await importFresh();
      const r = mod.updateReadingProgress('art-rc', 0.95);
      expect(typeof r.readCount).toBe('number');
    });

    it('returns percent in the result', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('art-pct', 'in-progress', { scrollRatio: 0.3 });
      const r = mod.updateReadingProgress('art-pct', 0.35);
      expect(r.percent).toBeGreaterThanOrEqual(0);
      expect(r.percent).toBeLessThanOrEqual(100);
    });

    it('acts as a monotonic high-water mark: scrolling up or clicking Top never reduces progress', async () => {
      const mod = await importFresh();
      // Read down to 60%
      const r1 = mod.updateReadingProgress('ratchet-test', 0.60);
      expect(r1.status).toBe('in-progress');
      expect(mod.getReadingEntry('ratchet-test')!.scrollRatio).toBe(0.60);
      expect(r1.percent).toBe(60);

      // Scroll back up to 20% or click Top (0%)
      const r2 = mod.updateReadingProgress('ratchet-test', 0.0);
      expect(r2.status).toBe('in-progress');
      // Progress remains preserved at high-water mark 0.60
      expect(mod.getReadingEntry('ratchet-test')!.scrollRatio).toBe(0.60);
      expect(r2.percent).toBe(60);

      // Read further down to 80%
      const r3 = mod.updateReadingProgress('ratchet-test', 0.80);
      expect(r3.percent).toBe(80);
      expect(mod.getReadingEntry('ratchet-test')!.scrollRatio).toBe(0.80);

      // Scroll to Top again
      const r4 = mod.updateReadingProgress('ratchet-test', 0.05);
      expect(r4.percent).toBe(80);
      expect(mod.getReadingEntry('ratchet-test')!.scrollRatio).toBe(0.80);
    });
  });

  // -----------------------------------------------------------------------
  // 8. getReadCount
  // -----------------------------------------------------------------------
  describe('getReadCount', () => {
    it('returns 0 for unknown slugs', async () => {
      const mod = await importFresh();
      expect(mod.getReadCount('unknown-slug')).toBe(0);
    });

    it('returns 1 after first completion', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('rc-1', 'in-progress');
      mod.setReadingStatus('rc-1', 'completed');
      expect(mod.getReadCount('rc-1')).toBe(1);
    });

    it('preserves count when reset to pending after completion', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('rc-2', 'completed');
      expect(mod.getReadCount('rc-2')).toBe(1);
      mod.setReadingStatus('rc-2', 'pending', { force: true });
      expect(mod.getReadCount('rc-2')).toBe(1);
    });

    it('increments on second completion', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('rc-3', 'completed');
      expect(mod.getReadCount('rc-3')).toBe(1);
      // Reset for re-read
      mod.setReadingStatus('rc-3', 'pending', { force: true });
      mod.setReadingStatus('rc-3', 'in-progress');
      mod.setReadingStatus('rc-3', 'completed');
      expect(mod.getReadCount('rc-3')).toBe(2);
    });

    it('returns 0 for in-progress without prior readCount', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('rc-4', 'in-progress');
      expect(mod.getReadCount('rc-4')).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 9. fetchReadingState – merges server state with local state
  // -----------------------------------------------------------------------
  describe('fetchReadingState', () => {
    it('merges server state into local state', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('local-only', 'in-progress');

      const serverData: ReadingState = {
        'server-article': {
          status: 'completed',
          scrollRatio: 1,
          updatedAt: '2025-01-01',
          readCount: 1,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(serverData),
      });

      const state = await mod.fetchReadingState();
      expect(state['server-article']).toBeDefined();
      expect(state['server-article'].status).toBe('completed');
      // Local-only article should still exist
      expect(state['local-only']).toBeDefined();
      expect(state['local-only'].status).toBe('in-progress');
    });

    it('returns current state when fetch response is not ok', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('existing', 'in-progress');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      });

      const state = await mod.fetchReadingState();
      expect(state['existing']).toBeDefined();
    });

    it('returns current state when fetch throws', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('existing2', 'completed');

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network failure')
      );

      const state = await mod.fetchReadingState();
      expect(state['existing2']).toBeDefined();
      expect(state['existing2'].status).toBe('completed');
    });

    it('prevents concurrent fetches (returns cached on re-enter)', async () => {
      const mod = await importFresh();

      let resolveFirst!: (v: any) => void;
      const firstPromise = new Promise((res) => {
        resolveFirst = res;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        firstPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve({}),
        }))
      );

      const p1 = mod.fetchReadingState();
      const p2 = mod.fetchReadingState(); // should return immediately

      // p2 resolves immediately with in-memory state
      const state2 = await p2;
      expect(state2).toBeDefined();

      resolveFirst(undefined);
      await p1;

      // fetch should only have been called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // 10. flushPendingUpdates – POSTs pending changes
  // -----------------------------------------------------------------------
  describe('flushPendingUpdates', () => {
    it('POSTs accumulated updates to /api/reading-status', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      });

      const mod = await importFresh();
      mod.setReadingStatus('flush-1', 'in-progress');
      mod.setReadingStatus('flush-2', 'completed');

      await mod.flushPendingUpdates();

      // The last call should be the POST (setReadingStatus schedules a
      // setTimeout that also calls flush, but we flush manually first)
      const postCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any) => c[1]?.method === 'POST'
      );
      expect(postCalls.length).toBeGreaterThanOrEqual(1);

      const lastPostCall = postCalls[postCalls.length - 1];
      expect(lastPostCall[0]).toBe('/api/reading-status');
      const body = JSON.parse(lastPostCall[1].body);
      expect(body['flush-1']).toBeDefined();
      expect(body['flush-2']).toBeDefined();
    });

    it('does nothing when there are no pending updates', async () => {
      const mod = await importFresh();
      await mod.flushPendingUpdates();
      // fetch should not have been called with POST
      const postCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any) => c[1]?.method === 'POST'
      );
      expect(postCalls.length).toBe(0);
    });

    it('clears pending updates after flush', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      });

      const mod = await importFresh();
      mod.setReadingStatus('flush-clear', 'completed');
      await mod.flushPendingUpdates();

      // Reset mock
      (global.fetch as ReturnType<typeof vi.fn>).mockClear();

      // Flushing again should not POST
      await mod.flushPendingUpdates();
      const postCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any) => c[1]?.method === 'POST'
      );
      expect(postCalls.length).toBe(0);
    });

    it('is scheduled automatically after setReadingStatus', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      });

      const mod = await importFresh();
      mod.setReadingStatus('auto-flush', 'in-progress');

      // Advance timer past the 1000ms debounce
      await vi.advanceTimersByTimeAsync(1100);

      const postCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: any) => c[1]?.method === 'POST'
      );
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 11. Error resilience
  // -----------------------------------------------------------------------
  describe('error resilience', () => {
    it('handles localStorage.getItem throwing', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('SecurityError');
        }
      );

      // Should not throw – falls back to {}
      const mod = await importFresh();
      expect(mod.getReadingState()).toEqual({});
    });

    it('handles localStorage.setItem throwing (quota exceeded)', async () => {
      const mod = await importFresh();
      (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('QuotaExceededError');
        }
      );

      // Should not throw – silently swallows the error
      expect(() =>
        mod.setReadingStatus('quota-test', 'in-progress')
      ).not.toThrow();

      // State should still be set in memory
      expect(mod.getReadingStatus('quota-test')).toBe('in-progress');
    });

    it('handles corrupt JSON in localStorage', async () => {
      mockStorage.set('substack_reading_state_cache_v1', '{invalid json');

      const mod = await importFresh();
      // Should fall back to empty state
      expect(mod.getReadingState()).toEqual({});
    });

    it('handles fetch rejection gracefully during flush', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network offline')
      );

      const mod = await importFresh();
      mod.setReadingStatus('fail-flush', 'completed');

      // Should not throw
      await expect(mod.flushPendingUpdates()).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Additional edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('loads pre-existing cached state on module init', async () => {
      const preExisting: ReadingState = {
        cached: {
          status: 'completed',
          scrollRatio: 1,
          updatedAt: '2025-06-01',
          readCount: 2,
        },
      };
      mockStorage.set(
        'substack_reading_state_cache_v1',
        JSON.stringify(preExisting)
      );

      const mod = await importFresh();
      expect(mod.getReadingStatus('cached')).toBe('completed');
      expect(mod.getReadCount('cached')).toBe(2);
    });

    it('getReadingEntry returns undefined for unknown slug', async () => {
      const mod = await importFresh();
      expect(mod.getReadingEntry('nope')).toBeUndefined();
    });

    it('setReadingStatus sets completedAt on first completion', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('comp-at', 'completed');
      const entry = mod.getReadingEntry('comp-at');
      expect(entry!.completedAt).toBeDefined();
      expect(typeof entry!.completedAt).toBe('string');
    });

    it('setReadingStatus preserves original completedAt on re-completion', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('comp-at2', 'completed');
      const firstCompletedAt = mod.getReadingEntry('comp-at2')!.completedAt;

      // Reset and re-complete
      mod.setReadingStatus('comp-at2', 'pending', { force: true });
      mod.setReadingStatus('comp-at2', 'completed');
      const secondCompletedAt = mod.getReadingEntry('comp-at2')!.completedAt;

      expect(secondCompletedAt).toBe(firstCompletedAt);
    });

    it('clamps scrollRatio between 0 and 1', async () => {
      const mod = await importFresh();
      mod.setReadingStatus('clamp-hi', 'in-progress', { scrollRatio: 5.0 });
      expect(mod.getReadingEntry('clamp-hi')!.scrollRatio).toBe(1);

      mod.setReadingStatus('clamp-lo', 'in-progress', { scrollRatio: -2.0 });
      expect(mod.getReadingEntry('clamp-lo')!.scrollRatio).toBe(0);
    });

    it('READING_STATUS_CHANGE_EVENT has the correct value', async () => {
      const mod = await importFresh();
      expect(mod.READING_STATUS_CHANGE_EVENT).toBe('reading-status-changed');
    });
  });
});
